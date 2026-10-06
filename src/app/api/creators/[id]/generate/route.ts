import { z } from "zod/v4";
import { apiHandler } from "@/server/auth";
import { generateCandidates } from "@/server/creators/service";
import { creatorResponse } from "@/server/creators/http";

const Body = z.object({ count: z.number().int().min(1).max(6).default(4) });

/** "Generate Creator": queue candidate portraits to choose from. */
export const POST = apiHandler(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { count } = Body.parse(await req.json().catch(() => ({})));
  return creatorResponse(() => generateCandidates(ctx.workspace.id, ctx.user.id, id, count), 202);
});
