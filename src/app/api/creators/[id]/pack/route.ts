import { z } from "zod/v4";
import { apiHandler } from "@/server/auth";
import { IDENTITY_PACK_KINDS } from "@/server/creators/identity";
import { generatePack } from "@/server/creators/service";
import { creatorResponse } from "@/server/creators/http";

const Body = z.object({ kinds: z.array(z.enum(IDENTITY_PACK_KINDS)).min(1).optional() });

/** Regenerate the identity pack (all angles, or the listed ones) from the master reference. */
export const POST = apiHandler(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { kinds } = Body.parse(await req.json().catch(() => ({})));
  return creatorResponse(() => generatePack(ctx.workspace.id, ctx.user.id, id, kinds ?? IDENTITY_PACK_KINDS), 202);
});
