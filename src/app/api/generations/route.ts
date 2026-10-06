import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiHandler } from "@/server/auth";
import { InsufficientCreditsError } from "@/server/billing/credits";
import { createGenerationJobs, GenerationError, GenerationRequestSchema } from "@/server/jobs/enqueue";
import { kickWorker } from "@/server/jobs/inline";

/** Create generation jobs. Returns immediately — the client polls GET for status. */
export const POST = apiHandler(async (ctx, req: Request) => {
  const request = GenerationRequestSchema.parse(await req.json());
  try {
    const result = await createGenerationJobs({ workspaceId: ctx.workspace.id, userId: ctx.user.id, request });
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Not enough credits", needed: err.needed, available: err.available }, { status: 402 });
    }
    if (err instanceof GenerationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
});

/** Poll job status: ?ids=a,b,c  or  ?active=1 for all in-flight jobs. */
export const GET = apiHandler(async (ctx, req: Request) => {
  kickWorker();
  const url = new URL(req.url);
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean).slice(0, 50);
  const active = url.searchParams.get("active") === "1";
  const jobs = await db.generationJob.findMany({
    where: {
      workspaceId: ctx.workspace.id,
      type: { in: ["photo", "video"] },
      ...(ids ? { id: { in: ids } } : active ? { status: { in: ["queued", "generating", "processing"] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, type: true, preset: true, status: true, progress: true, error: true, batchId: true, createdAt: true,
      creative: { select: { id: true, title: true, kind: true, mediaUrl: true, thumbnailUrl: true, mimeType: true } },
    },
  });
  const balance = (await db.workspace.findUnique({ where: { id: ctx.workspace.id }, select: { creditBalance: true } }))?.creditBalance;
  return { jobs, creditBalance: balance };
});
