import { db } from "@/lib/db";
import { apiHandler, HttpError } from "@/server/auth";

/** Duplicate a creative record (e.g. to rename/organize a copy). Media is shared, no credits used. */
export const POST = apiHandler(async (ctx, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const src = await db.creative.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
  if (!src) throw new HttpError(404, "Creative not found");
  const { id: _id, jobId: _jobId, createdAt: _c, ...rest } = src;
  const creative = await db.creative.create({ data: { ...rest, title: `${src.title} (copy)`, favorite: false } });
  return { creative };
});
