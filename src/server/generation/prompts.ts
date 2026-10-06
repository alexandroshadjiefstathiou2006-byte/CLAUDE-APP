/**
 * Prompt construction. Users never write prompts — the system composes them from
 * product fidelity constraints + creator identity + creative format + brand kit + variation.
 *
 * Reference-image models (gpt-image-1 edits, Gemini image) receive the ORIGINAL product photo as
 * image #1 and, when available, a creator identity portrait as image #2. The prompt tells the model
 * exactly how to use each image — this matters more for fidelity than any amount of description.
 */
import type { BrandContext, CreatorContext, ProductContext, Scene, VariationSpec } from "@/server/ai/types";
import type { PhotoPreset, VideoPreset } from "@/lib/catalog";

export function referenceBlock(opts: { hasCreatorRef: boolean; productOnly: boolean }) {
  const lines = [
    "REFERENCE IMAGES:",
    "- Image 1 is the EXACT product. Reproduce this exact item: same color, same logo/text (same letters, font, size, placement), same graphics and prints, same shape, seams, trims and proportions. Treat it as a photograph of the real item that must appear unchanged in the new scene.",
  ];
  if (opts.hasCreatorRef) {
    lines.push("- Image 2 shows the model's identity. Keep the same face, skin tone, hair and body type. Use it ONLY for the person's identity — ignore its clothing, background and lighting.");
  }
  if (!opts.productOnly) lines.push("- The model wears/holds the product from image 1, fitted naturally to their body with realistic folds and drape.");
  return lines.join("\n");
}

export function productFidelityBlock(p: ProductContext) {
  const a = p.analysis;
  const lines = [
    `PRODUCT: ${p.name}.`,
    a?.summary ? `Description: ${a.summary}` : p.description ? `Description: ${p.description}` : "",
    a?.colors?.length ? `Exact colors: ${a.colors.map((c) => `${c.name} ${c.hex}`).join(", ")}.` : "",
    a?.materials?.length ? `Materials: ${a.materials.join(", ")}.` : "",
    a?.logos?.length ? `Logos/text (must stay legible, identical, correctly spelled, same placement): ${a.logos.join("; ")}.` : "",
    a?.graphics?.length ? `Graphics/patterns (reproduce exactly, no redesign): ${a.graphics.join("; ")}.` : "",
    a?.fit ? `Fit/shape: ${a.fit}.` : "",
    ...(a?.fidelityNotes ?? []).map((n) => `Constraint: ${n}`),
    "Do not alter, recolor, simplify, mirror, add or remove any logo, text, print, seam or design detail of the product.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function creatorBlock(c: CreatorContext | null | undefined) {
  if (!c) return "";
  return `MODEL: ${c.identityPrompt}. ${c.age} years old, ${c.bodyType} build, ${c.hair} hair, ${c.style} personal style.`;
}

export function brandBlock(b: BrandContext | null | undefined) {
  if (!b || (!b.brandName && !b.toneOfVoice && !b.colors.length)) return "";
  return [
    `BRAND: ${b.brandName}.`,
    b.toneOfVoice ? `Brand mood: ${b.toneOfVoice}.` : "",
    b.colors.length ? `Brand palette may appear subtly in the set/styling (never on the product itself): ${b.colors.join(", ")}.` : "",
    b.targetCustomer ? `Target customer: ${b.targetCustomer}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildPhotoPrompt(opts: {
  preset: PhotoPreset;
  product: ProductContext;
  creator?: CreatorContext | null;
  brand?: BrandContext | null;
  variation: VariationSpec;
  aspect: string;
  hasCreatorRef?: boolean;
}) {
  const { preset, product, creator, brand, variation } = opts;
  const withModel = preset.needsCreator && !!creator;
  return [
    `Create a ${preset.scene}.`,
    `Setting: ${variation.location}. Camera: ${variation.camera}. Vertical/feed composition, aspect ratio ${opts.aspect}.`,
    referenceBlock({ hasCreatorRef: withModel && !!opts.hasCreatorRef, productOnly: !withModel }),
    withModel ? creatorBlock(creator) : "",
    productFidelityBlock(product),
    brandBlock(brand),
    "Style: photorealistic, shot on a real camera, natural skin texture, realistic fabric texture and lighting. The product must be clearly visible and in focus. No added text, captions, watermarks or borders.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Text-only prompt to create a creator's identity portrait (used as the face reference later). */
export function buildCreatorPortraitPrompt(c: CreatorContext) {
  return [
    `Photorealistic head-and-shoulders portrait photo of ${c.identityPrompt}, ${c.age} years old, ${c.bodyType} build, ${c.hair} hair.`,
    "Neutral relaxed expression with a slight smile, looking at camera, plain light-grey studio background, soft even daylight, plain fitted black crew-neck t-shirt.",
    "Natural skin texture, real photograph, no makeup filter, no text, no watermark.",
  ].join(" ");
}

export const NEGATIVE_PROMPT =
  "distorted logo, misspelled text, altered print, wrong color, extra limbs, deformed hands, plastic skin, cartoon, CGI, watermark, low resolution";

/** Prompt for the video keyframe: the hero frame the clip starts from. */
export function buildKeyframePrompt(opts: {
  preset: VideoPreset;
  product: ProductContext;
  creator?: CreatorContext | null;
  brand?: BrandContext | null;
  variation: VariationSpec;
  firstScene?: Scene;
  hasCreatorRef: boolean;
}) {
  const withModel = opts.preset.needsCreator && !!opts.creator;
  return [
    `Create the opening frame of a vertical 9:16 ${opts.preset.label} social media video, looking like a real smartphone video still (not a studio photo).`,
    `Location: ${opts.variation.location}.`,
    opts.firstScene ? `Shot: ${opts.firstScene.shot}. ${opts.firstScene.action}.` : "",
    referenceBlock({ hasCreatorRef: withModel && opts.hasCreatorRef, productOnly: !withModel }),
    withModel ? creatorBlock(opts.creator) : "",
    productFidelityBlock(opts.product),
    "Natural indoor/outdoor light, authentic creator vibe, product clearly visible. No text or captions in the image.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildVideoPrompt(opts: {
  preset: VideoPreset;
  product: ProductContext;
  creator?: CreatorContext | null;
  brand?: BrandContext | null;
  variation: VariationSpec;
  scenes: Scene[];
  /** Include dialogue for providers that generate speech natively (Veo 3). */
  dialogue?: string | null;
  clipSeconds: number;
}) {
  const { preset, scenes } = opts;
  const motion = scenes.map((s) => s.action).slice(0, 3).join(", then ");
  return [
    `Vertical 9:16 ${preset.label} video, ${opts.clipSeconds} seconds, filmed handheld on a smartphone like an authentic TikTok/Reels creator video. The video starts exactly from the provided image.`,
    `Action: ${motion}.`,
    opts.dialogue
      ? `The person speaks directly to the camera in a natural, casual voice and says: "${opts.dialogue}" Lip movements match the speech. Natural room ambience, no music.`
      : "No speech.",
    `Keep the product exactly as in the starting image: same color, logo, text and graphics throughout — no morphing or warping of the product.`,
    preset.needsCreator ? `Keep the same person throughout. ${creatorBlock(opts.creator)}` : "",
    "Realistic motion and hands, natural lighting, no on-screen text, no captions, no watermark.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Pick the spoken words that fit into one clip (≈2.5 words/second). */
export function dialogueForClip(scenes: Scene[], hook: string, clipSeconds: number) {
  const maxWords = Math.floor(clipSeconds * 2.5);
  const lines = [hook, ...scenes.slice(1).map((s) => s.line).filter((l): l is string => !!l)];
  const words: string[] = [];
  for (const line of lines) {
    const w = line.split(/\s+/);
    if (words.length + w.length > maxWords) break;
    words.push(...w);
  }
  return words.length ? words.join(" ") : hook.split(/\s+/).slice(0, maxWords).join(" ");
}
