import { Package, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { ProductCard } from "@/components/cards";

export default async function ProductsPage() {
  const { workspace } = await requireContext();
  const products = await db.product.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { creatives: true } } },
  });
  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Your product library. Upload once, create unlimited content."
        actions={<ButtonLink href="/app/products/new"><Plus className="h-4 w-4" /> Add Product</ButtonLink>}
      />
      {products.length === 0 ? (
        <EmptyState icon={<Package className="h-5 w-5" />} title="No products yet" body="Add a product photo to start generating creatives. Shopify import is coming soon." action={<ButtonLink href="/app/products/new">+ Add Product</ButtonLink>} />
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </>
  );
}
