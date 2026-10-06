import { db } from "@/lib/db";
import { apiHandler } from "@/server/auth";

export const GET = apiHandler(async (ctx, req: Request) => {
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "all";
  const productId = url.searchParams.get("productId") ?? undefined;
  const where = {
    workspaceId: ctx.workspace.id,
    ...(productId ? { productId } : {}),
    ...(filter === "photos" ? { kind: "photo" } : {}),
    ...(filter === "videos" ? { kind: "video" } : {}),
    ...(filter === "favorites" ? { favorite: true } : {}),
    ...(filter === "ugc" ? { tags: { contains: '"ugc"' } } : {}),
    ...(filter === "ads" ? { tags: { contains: '"ad"' } } : {}),
  };
  const creatives = await db.creative.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { product: { select: { id: true, name: true } }, creator: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return { creatives };
});
