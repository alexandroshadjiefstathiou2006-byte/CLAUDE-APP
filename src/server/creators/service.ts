/**
 * Creator Identity Generator — server workflow.
 *
 *   draft creator (attributes) → generate N candidate portraits → brand selects one
 *   → it becomes the MASTER identity reference → identity pack (front, 3/4, side, smiling, neutral)
 *   is generated from the master → creator is "active" and usable in product generation.
 *
 * All portraits run as async jobs (type "creator_portrait") on the normal queue, are charged
 * like standard photos and are refunded automatically on failure.
 */
import { z } from "zod/v4";
import type { Creator } from "@prisma/client";
import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { photoCost } from "@/lib/catalog";
import { applyCredits } from "@/server/billing/credits";
import { kickWorker } from "@/server/jobs/inline";
import type { CreatorPortraitJobInput } from "@/server/jobs/types";
import { storage } from "@/server/storage";
import { buildIdentityText, CANDIDATE_COUNT, fictionalViolation, IDENTITY_PACK_KINDS, newIdentityId, renderMockPortrait } from "./identity";

export class CreatorError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const CreatorAttributes = z.object({
  name: z.string().trim().min(1).max(40),
  age: z.number().int().min(18).max(80),
  gender: z.enum(["female", "male", "nonbinary"]),
  appearance: z.string().trim().min(3).max(240),
  hair: z.string().trim().min(1).max(80),
  eyes: z.string().trim().max(60).default(""),
  bodyType: z.string().trim().min(1).max(40),
  style: z.string().trim().min(1).max(40),
  personality: z.string().trim().max(200).default(""),
  niche: z.string().trim().max(120).default(""),
  location: z.string().trim().max(60).default(""),
  bio: z.string().trim().max(300).default(""),
});
export type CreatorAttributesInput = z.infer<typeof CreatorAttributes>;

const batchKey = (creatorId: string) => `creator:${creatorId}`;

function assertFictional(a: Partial<CreatorAttributesInput>) {
  const v = fictionalViolation({ name: a.name, appearance: a.appearance, hair: a.hair, eyes: a.eyes, personality: a.personality, niche: a.niche, bio: a.bio });
  if (v) throw new CreatorError(400, v);
}

async function loadOwned(workspaceId: string, creatorId: string) {
  const creator = await db.creator.findFirst({ where: { id: creatorId, workspaceId } });
  if (!creator) throw new CreatorError(404, "Creator not found (stock creators can't be edited)");
  return creator;
}

/** Step 1: save the brand's definition as a draft creator with a persistent identity id. */
export async function createDraftCreator(workspaceId: string, attrs: CreatorAttributesInput) {
  assertFictional(attrs);
  const identityId = newIdentityId();
  const placeholder = renderMockPortrait(attrs, { kind: "front", variant: 0 }).replace(/<rect x="16" y="16"[^>]*\/><text[^>]*>[^<]*<\/text>/, "");
  const { url } = await storage().put({ folder: `ws/${workspaceId}/creators/${identityId}`, data: Buffer.from(placeholder), mimeType: "image/svg+xml" });
  return db.creator.create({
    data: {
      workspaceId,
      identityId,
      status: "draft",
      ...attrs,
      categories: toJson(attrs.niche ? [attrs.niche] : []),
      identityPrompt: buildIdentityText(attrs),
      seed: Math.floor(Math.random() * 1_000_000),
      avatarUrl: url,
      isBrandCreator: true,
    },
  });
}

export async function updateCreator(workspaceId: string, creatorId: string, attrs: Partial<CreatorAttributesInput>) {
  const creator = await loadOwned(workspaceId, creatorId);
  assertFictional(attrs);
  const merged = { ...creator, ...attrs };
  return db.creator.update({
    where: { id: creator.id },
    data: { ...attrs, identityPrompt: buildIdentityText(merged), ...(attrs.niche !== undefined ? { categories: toJson(attrs.niche ? [attrs.niche] : []) } : {}) },
  });
}

/** Queue portrait jobs, debiting credits atomically (refunded per job on failure). */
async function queuePortraits(opts: { workspaceId: string; userId: string; creator: Creator; items: Omit<CreatorPortraitJobInput, "creatorId">[] }) {
  const unit = photoCost("standard");
  const jobs = await db.$transaction(async (tx) => {
    const created = [];
    for (const item of opts.items) {
      const input: CreatorPortraitJobInput = { creatorId: opts.creator.id, ...item };
      const job = await tx.generationJob.create({
        data: { workspaceId: opts.workspaceId, userId: opts.userId, type: "creator_portrait", preset: item.kind, input: toJson(input), creditsCost: unit, batchId: batchKey(opts.creator.id) },
      });
      await applyCredits(tx, { workspaceId: opts.workspaceId, delta: -unit, reason: "generation", jobId: job.id });
      created.push(job);
    }
    return created;
  });
  kickWorker();
  return { jobIds: jobs.map((j) => j.id), creditsUsed: unit * jobs.length };
}

/** Step 2: generate candidate portraits to choose from. */
export async function generateCandidates(workspaceId: string, userId: string, creatorId: string, count = CANDIDATE_COUNT) {
  const creator = await loadOwned(workspaceId, creatorId);
  const previous = await db.creatorReference.count({ where: { creatorId, kind: "candidate" } });
  return queuePortraits({
    workspaceId,
    userId,
    creator,
    items: Array.from({ length: count }, (_, i) => ({ kind: "candidate" as const, variant: previous + i })),
  });
}

/** Step 3: the selected candidate becomes the master identity reference; the identity pack is queued. */
export async function selectMaster(workspaceId: string, userId: string, creatorId: string, referenceId: string) {
  const creator = await loadOwned(workspaceId, creatorId);
  const candidate = await db.creatorReference.findFirst({ where: { id: referenceId, creatorId, kind: "candidate" } });
  if (!candidate) throw new CreatorError(404, "Candidate not found");
  await db.$transaction([
    db.creatorReference.updateMany({ where: { creatorId, kind: { in: ["master", ...IDENTITY_PACK_KINDS] } }, data: { active: false } }),
    db.creatorReference.create({
      data: { creatorId, kind: "master", url: candidate.url, mimeType: candidate.mimeType, prompt: candidate.prompt, provider: candidate.provider, seed: candidate.seed, variant: candidate.variant, active: true },
    }),
    db.creator.update({ where: { id: creatorId }, data: { status: "active", avatarUrl: candidate.url, seed: candidate.seed ?? creator.seed } }),
  ]);
  return generatePack(workspaceId, userId, creatorId);
}

/** Step 4 (or regenerate): identity pack conditioned on the master reference. */
export async function generatePack(workspaceId: string, userId: string, creatorId: string, kinds: readonly (typeof IDENTITY_PACK_KINDS)[number][] = IDENTITY_PACK_KINDS) {
  const creator = await loadOwned(workspaceId, creatorId);
  const master = await db.creatorReference.findFirst({ where: { creatorId, kind: "master", active: true } });
  if (!master) throw new CreatorError(400, "Select a master portrait first");
  return queuePortraits({ workspaceId, userId, creator, items: kinds.map((kind, i) => ({ kind, variant: i })) });
}

/** Everything the identity UI needs: creator, references, and the status of portrait jobs. */
export async function creatorIdentityState(workspaceId: string, creatorId: string) {
  const creator = await db.creator.findFirst({ where: { id: creatorId, OR: [{ workspaceId }, { workspaceId: null }] } });
  if (!creator) throw new CreatorError(404, "Creator not found");
  const [references, jobs] = await Promise.all([
    db.creatorReference.findMany({ where: { creatorId }, orderBy: { createdAt: "asc" } }),
    db.generationJob.findMany({
      where: { workspaceId, batchId: batchKey(creatorId), type: "creator_portrait" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, preset: true, status: true, progress: true, error: true, createdAt: true },
    }),
  ]);
  return {
    creator,
    candidates: references.filter((r) => r.kind === "candidate").reverse(),
    master: references.filter((r) => r.kind === "master" && r.active).pop() ?? null,
    pack: references.filter((r) => r.active && (IDENTITY_PACK_KINDS as readonly string[]).includes(r.kind)),
    jobs,
    pending: jobs.filter((j) => !["completed", "failed"].includes(j.status)),
  };
}
