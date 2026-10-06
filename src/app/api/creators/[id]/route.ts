import { db } from "@/lib/db";
import { apiHandler, HttpError } from "@/server/auth";
import { CreatorAttributes, creatorIdentityState, updateCreator } from "@/server/creators/service";
import { creatorResponse } from "@/server/creators/http";
import { kickWorker } from "@/server/jobs/inline";

type Params = { params: Promise<{ id: string }> };

/** Identity state: creator, candidates, master, identity pack, portrait job statuses. */
export const GET = apiHandler(async (ctx, _req: Request, { params }: Params) => {
  kickWorker();
  const { id } = await params;
  return creatorResponse(() => creatorIdentityState(ctx.workspace.id, id));
});

export const PATCH = apiHandler(async (ctx, req: Request, { params }: Params) => {
  const { id } = await params;
  const attrs = CreatorAttributes.partial().parse(await req.json());
  return creatorResponse(async () => ({ creator: await updateCreator(ctx.workspace.id, id, attrs) }));
});

export const DELETE = apiHandler(async (ctx, _req: Request, { params }: Params) => {
  const { id } = await params;
  const creator = await db.creator.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
  if (!creator) throw new HttpError(404, "Creator not found (stock creators can't be deleted)");
  await db.creator.delete({ where: { id } }); // references cascade; past creatives keep their media
  return { ok: true };
});
