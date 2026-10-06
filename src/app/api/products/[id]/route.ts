import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { apiHandler, HttpError } from "@/server/auth";
import { enqueueProductAnalysis } from "@/server/jobs/enqueue";
import { assertOwnFile } from "@/server/validation";
import { ProductBody } from "@/server/schemas";

type Params = { params: Promise<{ id: string }> };

async function load(workspaceId: string, id: string) {
  const product = await db.product.findFirst({ where: { id, workspaceId } });
  if (!product) throw new HttpError(404, "Product not found");
  return product;
}

export const GET = apiHandler(async (ctx, _req: Request, { params }: Params) => {
  return { product: await load(ctx.workspace.id, (await params).id) };
});

export const PATCH = apiHandler(async (ctx, req: Request, { params }: Params) => {
  const existing = await load(ctx.workspace.id, (await params).id);
  const raw = (await req.json()) as Record<string, unknown>;
  const parsed = ProductBody.partial().parse(raw);
  // only apply fields the client actually sent (schema defaults must not overwrite data)
  const body = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in raw)) as Partial<typeof parsed>;
  assertOwnFile(body.imageUrl, ctx.workspace.id);
  assertOwnFile(body.logoUrl, ctx.workspace.id);
  const imageChanged = body.imageUrl && body.imageUrl !== existing.imageUrl;
  const product = await db.product.update({
    where: { id: existing.id },
    data: {
      ...body,
      productUrl: body.productUrl === "" ? null : body.productUrl,
      colors: body.colors ? toJson(body.colors) : undefined,
      ...(imageChanged ? { analysis: null, analysisStatus: "pending" } : {}),
    },
  });
  if (imageChanged) await enqueueProductAnalysis(ctx.workspace.id, product.id);
  return { product };
});

export const DELETE = apiHandler(async (ctx, _req: Request, { params }: Params) => {
  const product = await load(ctx.workspace.id, (await params).id);
  await db.product.delete({ where: { id: product.id } });
  return { ok: true };
});
