import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export class InsufficientCreditsError extends Error {
  constructor(public needed: number, public available: number) {
    super(`Not enough credits: need ${needed}, have ${available}`);
  }
}

/**
 * Apply a credit change atomically: append to the ledger and update the cached balance.
 * Debits use a conditional update so concurrent requests can never overdraw.
 */
export async function applyCredits(
  tx: Tx,
  opts: { workspaceId: string; delta: number; reason: string; jobId?: string; externalRef?: string },
) {
  if (opts.delta < 0) {
    const res = await tx.workspace.updateMany({
      where: { id: opts.workspaceId, creditBalance: { gte: -opts.delta } },
      data: { creditBalance: { increment: opts.delta } },
    });
    if (res.count === 0) {
      const ws = await tx.workspace.findUniqueOrThrow({ where: { id: opts.workspaceId } });
      throw new InsufficientCreditsError(-opts.delta, ws.creditBalance);
    }
  } else {
    await tx.workspace.update({ where: { id: opts.workspaceId }, data: { creditBalance: { increment: opts.delta } } });
  }
  const ws = await tx.workspace.findUniqueOrThrow({ where: { id: opts.workspaceId }, select: { creditBalance: true } });
  return tx.creditLedger.create({
    data: {
      workspaceId: opts.workspaceId,
      delta: opts.delta,
      reason: opts.reason,
      jobId: opts.jobId,
      externalRef: opts.externalRef,
      balanceAfter: ws.creditBalance,
    },
  });
}

/** Grant credits once per external reference (e.g. a Stripe invoice). Safe to call repeatedly. */
export async function grantCreditsOnce(workspaceId: string, amount: number, reason: string, externalRef: string) {
  const existing = await db.creditLedger.findUnique({ where: { externalRef } });
  if (existing) return existing;
  return db.$transaction((tx) => applyCredits(tx, { workspaceId, delta: amount, reason, externalRef }));
}

/** Refund the credits a failed job consumed. Idempotent per job. */
export async function refundJob(jobId: string) {
  const job = await db.generationJob.findUnique({ where: { id: jobId } });
  if (!job || job.creditsCost <= 0) return;
  await db.$transaction(async (tx) => {
    const already = await tx.creditLedger.findFirst({ where: { jobId, reason: "refund" } });
    if (already) return;
    await applyCredits(tx, { workspaceId: job.workspaceId, delta: job.creditsCost, reason: "refund", jobId });
  });
}
