import { db } from "@/lib/db";
import { apiHandler } from "@/server/auth";
import { CreatorAttributes, createDraftCreator } from "@/server/creators/service";
import { creatorResponse } from "@/server/creators/http";

/** ?active=1 → only creators with a finished identity (for the create wizard). */
export const GET = apiHandler(async (ctx, req: Request) => {
  const activeOnly = new URL(req.url).searchParams.get("active") === "1";
  const creators = await db.creator.findMany({
    where: { OR: [{ workspaceId: null }, { workspaceId: ctx.workspace.id }], ...(activeOnly ? { status: "active" } : {}) },
    orderBy: [{ isBrandCreator: "desc" }, { createdAt: "asc" }],
  });
  return { creators };
});

/** Create a draft brand creator (Step 1 of the Creator Identity Generator). */
export const POST = apiHandler(async (ctx, req: Request) => {
  const attrs = CreatorAttributes.parse(await req.json());
  return creatorResponse(async () => ({ creator: await createDraftCreator(ctx.workspace.id, attrs) }), 201);
});
