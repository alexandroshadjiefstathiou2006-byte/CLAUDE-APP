import { z } from "zod/v4";
import { db } from "@/lib/db";
import { apiHandler, HttpError } from "@/server/auth";

type Params = { params: Promise<{ id: string }> };

async function load(workspaceId: string, id: string) {
  const creative = await db.creative.findFirst({ where: { id, workspaceId } });
  if (!creative) throw new HttpError(404, "Creative not found");
  return creative;
}

const Patch = z.object({ title: z.string().trim().min(1).max(140).optional(), favorite: z.boolean().optional() });

export const PATCH = apiHandler(async (ctx, req: Request, { params }: Params) => {
  const creative = await load(ctx.workspace.id, (await params).id);
  const body = Patch.parse(await req.json());
  return { creative: await db.creative.update({ where: { id: creative.id }, data: body }) };
});

export const DELETE = apiHandler(async (ctx, _req: Request, { params }: Params) => {
  const creative = await load(ctx.workspace.id, (await params).id);
  await db.creative.delete({ where: { id: creative.id } });
  // Files are kept: duplicates may share the same media. A storage GC job can sweep orphans.
  return { ok: true };
});
