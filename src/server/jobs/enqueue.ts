import crypto from "crypto";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { AD_STYLES, MAX_VARIATIONS, VIDEO_DURATIONS, generationCost, getPreset } from "@/lib/catalog";
import { applyCredits } from "@/server/billing/credits";
import { buildVariations } from "@/server/generation/variations";
import { toBrandContext, toCreatorContext, toProductContext } from "./context";
import type { CreativeJobInput } from "./types";
import { kickWorker } from "./inline";

export const GenerationRequestSchema = z.object({
  productId: z.string().min(1),
  presetId: z.string().min(1),
  /** One or more creators. Variations rotate through them ("vary the AI model"). */
  creatorIds: z.array(z.string()).max(10).default([]),
  count: z.number().int().min(1).max(MAX_VARIATIONS).default(1),
  quality: z.enum(["standard", "high"]).default("standard"),
  aspect: z.enum(["1:1", "4:5", "9:16"]).default("4:5"),
  platform: z.string().default("tiktok"),
  durationSec: z.number().int().refine((d) => (VIDEO_DURATIONS as readonly number[]).includes(d), "Unsupported duration").default(15),
  styleId: z.string().default("authentic"),
  sourceCreativeId: z.string().optional(),
});

export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;

export class GenerationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function createGenerationJobs(opts: { workspaceId: string; userId: string; request: GenerationRequest }) {
  const { workspaceId, userId, request: r } = opts;
  const preset = getPreset(r.presetId);
  if (!preset) throw new GenerationError(400, "Unknown creative format");

  const product = await db.product.findFirst({ where: { id: r.productId, workspaceId } });
  if (!product) throw new GenerationError(404, "Product not found");

  const creators = r.creatorIds.length
    ? await db.creator.findMany({ where: { id: { in: r.creatorIds }, OR: [{ workspaceId }, { workspaceId: null }] } })
    : [];
  if (preset.needsCreator && creators.length === 0) throw new GenerationError(400, "Choose an AI creator for this format");
  // keep the user's selection order
  const orderedCreators = r.creatorIds.map((id) => creators.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);

  const brandKit = await db.brandKit.findUnique({ where: { workspaceId } });
  const style = AD_STYLES.find((s) => s.id === r.styleId) ?? AD_STYLES[0];
  const batchId = crypto.randomUUID();
  const variations = buildVariations({ presetId: preset.id, count: r.count, baseSeed: `${product.id}:${batchId}`, tone: style.tone });
  const unitCost = generationCost({ kind: preset.kind, quality: r.quality, durationSec: r.durationSec, count: 1 });
  const aspect = preset.kind === "video" ? (r.platform === "meta_feed" ? "4:5" : "9:16") : r.aspect;

  const productCtx = toProductContext(product);
  const brandCtx = toBrandContext(brandKit);

  const jobs = await db.$transaction(async (tx) => {
    const created = [];
    for (const variation of variations) {
      const creator = orderedCreators.length ? orderedCreators[variation.index % orderedCreators.length] : null;
      const input: CreativeJobInput = {
        presetId: preset.id,
        product: productCtx,
        creator: preset.needsCreator && creator ? toCreatorContext(creator) : null,
        brand: brandCtx,
        variation,
        options: {
          quality: r.quality,
          aspect,
          platform: r.platform,
          durationSec: preset.kind === "video" ? r.durationSec : 0,
          styleId: style.id,
          styleTone: style.tone,
        },
        sourceCreativeId: r.sourceCreativeId,
      };
      const job = await tx.generationJob.create({
        data: {
          workspaceId,
          userId,
          type: preset.kind,
          preset: preset.id,
          input: toJson(input),
          creditsCost: unitCost,
          batchId,
        },
      });
      await applyCredits(tx, { workspaceId, delta: -unitCost, reason: "generation", jobId: job.id });
      created.push(job);
    }
    return created;
  });

  kickWorker();
  return { batchId, jobIds: jobs.map((j) => j.id), creditsUsed: unitCost * jobs.length };
}

export async function enqueueProductAnalysis(workspaceId: string, productId: string) {
  await db.generationJob.create({
    data: { workspaceId, type: "analyze_product", input: toJson({ productId }), creditsCost: 0 },
  });
  kickWorker();
}
