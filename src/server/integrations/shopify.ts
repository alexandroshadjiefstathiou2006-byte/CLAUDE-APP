/**
 * Shopify integration (architecture scaffold — not wired to the UI yet).
 *
 * Planned flow:
 *  1. OAuth install (/api/integrations/shopify/install → callback) stores an `Integration` row
 *     { provider: "shopify", externalId: shopDomain, accessToken }.
 *  2. `importShopifyProducts` pulls products via the Admin GraphQL API and upserts `Product`
 *     rows keyed by (workspaceId, source="shopify", externalId) — re-running is safe.
 *  3. `products/update` webhooks call the same upsert to keep the catalog in sync.
 *  4. Each imported product gets a "Create Ads" button → /app/create?product=<id>.
 */
import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { storage } from "@/server/storage";
import { enqueueProductAnalysis } from "@/server/jobs/enqueue";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-07";

interface ShopifyProductNode {
  id: string;
  title: string;
  descriptionHtml: string;
  onlineStoreUrl: string | null;
  productType: string;
  featuredImage: { url: string } | null;
  variants: { nodes: { id: string; title: string; price: string; sku: string | null }[] };
}

const QUERY = `query Products($cursor: String) {
  products(first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title descriptionHtml onlineStoreUrl productType
      featuredImage { url }
      variants(first: 50) { nodes { id title price sku } }
    }
  }
}`;

async function shopifyGraphql<T>(shop: string, token: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
  const json = (await res.json()) as { data: T; errors?: unknown };
  if (json.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors).slice(0, 300)}`);
  return json.data;
}

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function importShopifyProducts(workspaceId: string, integrationId: string) {
  const integration = await db.integration.findFirstOrThrow({ where: { id: integrationId, workspaceId, provider: "shopify" } });
  let cursor: string | null = null;
  let imported = 0;
  do {
    const data: { products: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ShopifyProductNode[] } } =
      await shopifyGraphql(integration.externalId, integration.accessToken, { cursor });
    for (const p of data.products.nodes) {
      if (!p.featuredImage) continue;
      const existing = await db.product.findFirst({ where: { workspaceId, source: "shopify", externalId: p.id } });
      // copy the image into our storage so AI providers always have the bytes
      const img = existing?.imageUrl ?? (await copyImage(workspaceId, p.featuredImage.url));
      const fields = {
        name: p.title,
        description: stripHtml(p.descriptionHtml).slice(0, 4000),
        category: p.productType || "apparel",
        productUrl: p.onlineStoreUrl,
        variants: toJson(p.variants.nodes),
      };
      if (existing) {
        await db.product.update({ where: { id: existing.id }, data: fields });
      } else {
        const created = await db.product.create({ data: { ...fields, workspaceId, imageUrl: img, source: "shopify", externalId: p.id } });
        await enqueueProductAnalysis(workspaceId, created.id);
      }
      imported++;
    }
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  await db.integration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date() } });
  return { imported };
}

async function copyImage(workspaceId: string, url: string) {
  const { data, mimeType } = await storage().read(url);
  return (await storage().put({ folder: `ws/${workspaceId}/products`, data, mimeType })).url;
}
