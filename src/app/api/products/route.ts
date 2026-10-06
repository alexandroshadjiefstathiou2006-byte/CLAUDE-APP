import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { apiHandler } from "@/server/auth";
import { enqueueProductAnalysis } from "@/server/jobs/enqueue";
import { assertOwnFile } from "@/server/validation";
import { ProductBody } from "@/server/schemas";


export const GET = apiHandler(async (ctx) => {
  const products = await db.product.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { creatives: true } } },
  });
  return { products };
});

export const POST = apiHandler(async (ctx, req: Request) => {
  const body = ProductBody.parse(await req.json());
  assertOwnFile(body.imageUrl, ctx.workspace.id);
  assertOwnFile(body.logoUrl, ctx.workspace.id);
  const product = await db.product.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: body.name,
      description: body.description,
      category: body.category,
      productUrl: body.productUrl || null,
      imageUrl: body.imageUrl,
      logoUrl: body.logoUrl || null,
      colors: toJson(body.colors),
    },
  });
  await enqueueProductAnalysis(ctx.workspace.id, product.id);
  return { product };
});
