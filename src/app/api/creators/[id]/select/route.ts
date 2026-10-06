import { z } from "zod/v4";
import { apiHandler } from "@/server/auth";
import { selectMaster } from "@/server/creators/service";
import { creatorResponse } from "@/server/creators/http";

const Body = z.object({ referenceId: z.string().min(1) });

/** Select a candidate as the master identity reference and queue the identity pack. */
export const POST = apiHandler(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { referenceId } = Body.parse(await req.json());
  return creatorResponse(() => selectMaster(ctx.workspace.id, ctx.user.id, id, referenceId), 202);
});
