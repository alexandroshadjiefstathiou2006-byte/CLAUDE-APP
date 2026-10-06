/**
 * Claude-powered script, hook and product-analysis provider.
 * API key: ANTHROPIC_API_KEY (set SCRIPT_PROVIDER=anthropic).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type {
  PhotoConcept,
  ProductAnalysis,
  ProductContext,
  ScriptGenerationProvider,
  ScriptRequest,
  UGCScript,
} from "../types";
import { getPreset } from "@/lib/catalog";
import { brandBlock, creatorBlock, NEGATIVE_PROMPT } from "@/server/generation/prompts";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const AnalysisSchema = z.object({
  summary: z.string(),
  productType: z.string().describe("short singular noun, e.g. hoodie, jeans, dress"),
  colors: z.array(z.object({ name: z.string(), hex: z.string() })),
  materials: z.array(z.string()),
  logos: z.array(z.string()).describe("each logo: content, color, exact placement"),
  graphics: z.array(z.string()).describe("prints, patterns, graphics with placement"),
  fit: z.string(),
  fidelityNotes: z.array(z.string()).describe("hard constraints an image model must respect to reproduce this product exactly"),
  sellingPoints: z.array(z.string()),
});

const SceneSchema = z.object({
  order: z.number().int(),
  title: z.string(),
  shot: z.string(),
  action: z.string(),
  line: z.string().optional(),
  overlay: z.string().optional(),
  durationSec: z.number(),
});

const ScriptSchema = z.object({
  hook: z.string(),
  script: z.string(),
  scenes: z.array(SceneSchema),
  caption: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  tone: z.string(),
});

const ConceptSchema = z.object({ title: z.string(), caption: z.string() });

const SYSTEM = `You are the creative director of an AI creative studio for e-commerce fashion brands.
You write short-form social ads (TikTok, Reels, Shorts, Meta) that feel like real creators made them:
specific, conversational, never salesy-corporate, never generic. You never invent product features that
are not supported by the product information. Hooks must stop the scroll in the first 2 seconds.`;

export class AnthropicScriptProvider implements ScriptGenerationProvider {
  readonly name = "anthropic";
  private client = new Anthropic();

  private async parse<T extends z.ZodType>(schema: T, content: Anthropic.MessageParam["content"], effort: "low" | "medium" = "low") {
    const response = await this.client.messages.parse(
      {
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(schema), effort },
        // Server-side fallback if a request is declined by safety classifiers.
        fallbacks: "default",
      },
      { headers: { "anthropic-beta": "server-side-fallback-2026-07-01" } },
    );
    if (response.stop_reason === "refusal") throw new Error("The script model declined this request");
    if (!response.parsed_output) throw new Error(`Script model returned no structured output (${response.stop_reason})`);
    return response.parsed_output as z.infer<T>;
  }

  async analyzeProduct(product: ProductContext, image: { data: Buffer; mimeType: string }): Promise<ProductAnalysis> {
    const mediaType = (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(image.mimeType) ? image.mimeType : "image/png") as
      | "image/png"
      | "image/jpeg"
      | "image/webp"
      | "image/gif";
    return this.parse(AnalysisSchema, [
      { type: "image", source: { type: "base64", media_type: mediaType, data: image.data.toString("base64") } },
      {
        type: "text",
        text: `Analyze this product photo for an AI image pipeline that must reproduce the product EXACTLY.
Product name: ${product.name}
Seller description: ${product.description || "(none)"}
Extract exact colors (with hex), materials, every logo and graphic with its placement, the fit/shape, and
fidelity constraints. Also list 3-5 customer-facing selling points grounded in what is visible or stated.`,
      },
    ]);
  }

  async generateUGCScript(req: ScriptRequest): Promise<UGCScript> {
    const preset = getPreset(req.presetId);
    const structure = preset && preset.kind === "video" ? preset.structure : [];
    const talking = preset && preset.kind === "video" ? preset.talking : true;
    return this.parse(
      ScriptSchema,
      `Write a ${req.durationSec}-second ${preset?.label ?? "UGC ad"} for ${req.platform}.

PRODUCT: ${req.product.name}
${req.product.analysis ? `Analysis: ${JSON.stringify(req.product.analysis)}` : `Description: ${req.product.description}`}
${creatorBlock(req.creator)}
${brandBlock(req.brand)}

Tone: ${req.styleTone}
Hook angle for this variation: ${req.variation.hookAngle}
Location: ${req.variation.location}
CTA to use (rephrase naturally): ${req.variation.cta}
Scene skeleton: ${structure.join(" → ")}
${talking ? "The creator speaks to camera; every scene needs a natural spoken line." : "No dialogue; use on-screen overlay text only."}
${req.avoidHooks?.length ? `Do NOT reuse or paraphrase these hooks: ${req.avoidHooks.join(" | ")}` : ""}

Scene durations must sum to ${req.durationSec}. Keep spoken lines short enough to say in the scene duration.`,
    );
  }

  async generatePhotoConcept(req: Omit<ScriptRequest, "platform" | "durationSec">): Promise<PhotoConcept> {
    const preset = getPreset(req.presetId);
    const res = await this.parse(
      ConceptSchema,
      `Give a short library title (max 6 words) and a social caption (max 20 words) for a ${preset?.label} photo of
${req.product.name} at ${req.variation.location}. Tone: ${req.styleTone}. ${brandBlock(req.brand)}`,
    );
    return { title: res.title, caption: res.caption, prompt: "", negativePrompt: NEGATIVE_PROMPT };
  }
}
