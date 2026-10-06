import type { BrandContext, CreatorContext, ProductContext, UGCScript, VariationSpec } from "@/server/ai/types";
import type { Quality } from "@/lib/catalog";

/** Immutable snapshot stored on the job, so it's reproducible and independent of later edits. */
export interface CreativeJobInput {
  presetId: string;
  product: ProductContext;
  creator: CreatorContext | null;
  brand: BrandContext | null;
  variation: VariationSpec;
  options: {
    quality: Quality;
    aspect: "1:1" | "4:5" | "9:16";
    platform: string;
    durationSec: number;
    styleId: string;
    styleTone: string;
  };
  sourceCreativeId?: string;
}

export interface AnalyzeJobInput {
  productId: string;
}

export interface VideoJobState {
  script?: UGCScript;
  prompt?: string;
  voiceUrl?: string | null;
}

export type JobStatus = "queued" | "generating" | "processing" | "completed" | "failed";
export const TERMINAL: JobStatus[] = ["completed", "failed"];
