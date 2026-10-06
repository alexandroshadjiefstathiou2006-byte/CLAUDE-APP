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

export function referenceBlock(opts: { identityRefs: number; productOnly: boolean; hasProduct?: boolean }) {
  const hasProduct = opts.hasProduct ?? true;
  const lines = ["REFERENCE IMAGES:"];
  if (hasProduct) {
    lines.push(
      "- Image 1 is the EXACT product. Reproduce this exact item: same color, same logo/text (same letters, font, size, placement), same graphics and prints, same shape, seams, trims and proportions. Treat it as a photograph of the real item that must appear unchanged in the new scene.",
    );
  }
  if (opts.identityRefs > 0) {
    const first = hasProduct ? 2 : 1;
    const range = opts.identityRefs === 1 ? `Image ${first} shows` : `Images ${first}–${first + opts.identityRefs - 1} show`;
    lines.push(
      `- ${range} the model's identity (same fictional person from different angles). Keep exactly the same face, facial structure, skin tone, eye color, hair, and body type. Use them ONLY for the person's identity — ignore their clothing, background and lighting.`,
    );
  }
  if (!opts.productOnly && hasProduct) lines.push("- The model wears/holds the product from image 1, fitted naturally to their body with realistic folds and drape.");
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
  return `MODEL: ${c.identityPrompt}. ${c.age} years old, ${c.bodyType} build, ${c.hair} hair${c.eyes ? `, ${c.eyes} eyes` : ""}, ${c.style} personal style.`;
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
  /** Number of identity reference images attached after the product image. */
  identityRefs?: number;
}) {
  const { preset, product, creator, brand, variation } = opts;
  const withModel = preset.needsCreator && !!creator;
  return [
    `Create a ${preset.scene}.`,
    `Setting: ${variation.location}. Camera: ${variation.camera}. Vertical/feed composition, aspect ratio ${opts.aspect}.`,
    referenceBlock({ identityRefs: withModel ? (opts.identityRefs ?? 0) : 0, productOnly: !withModel }),
    withModel ? creatorBlock(creator) : "",
    productFidelityBlock(product),
    brandBlock(brand),
    "Style: photorealistic, shot on a real camera, natural skin texture, realistic fabric texture and lighting. The product must be clearly visible and in focus. No added text, captions, watermarks or borders.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const FICTIONAL =
  "This is a FICTIONAL person created for advertising. They must not resemble any real celebrity, influencer, public figure or real individual.";

function describePerson(c: CreatorContext) {
  return [
    `${c.identityPrompt}`,
    `${c.age} years old, ${c.bodyType} build`,
    `${c.hair} hair`,
    c.eyes ? `${c.eyes} eyes` : "",
    c.personality ? `personality that reads as ${c.personality}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Text-only prompt to create a creator's identity portrait (legacy single-portrait path). */
export function buildCreatorPortraitPrompt(c: CreatorContext) {
  return buildCandidatePrompt(c, 0);
}

const CANDIDATE_VARIATIONS = [
  "soft window daylight, light warm-grey background",
  "even studio softbox light, off-white background",
  "natural overcast daylight, muted sage background",
  "golden-hour light from the side, warm beige background",
  "bright diffused light, light blue-grey background",
  "soft daylight, pale stone background",
];

/** Candidate portraits: same written identity, different fictional faces to choose from. */
export function buildCandidatePrompt(c: CreatorContext, variant: number) {
  return [
    `Photorealistic head-and-shoulders portrait photograph of a fictional ${c.gender === "nonbinary" ? "person" : c.gender === "female" ? "woman" : "man"}: ${describePerson(c)}.`,
    c.style ? `Wears a simple plain top that fits a ${c.style} style (no logos, no text).` : "Wears a plain fitted crew-neck top (no logos, no text).",
    `Looking straight at the camera, relaxed natural expression. ${CANDIDATE_VARIATIONS[variant % CANDIDATE_VARIATIONS.length]}.`,
    "Real photograph quality: natural skin texture with pores, no beauty filter, no retouching artifacts, sharp focus on the eyes, 85mm lens.",
    FICTIONAL,
    "No text, no watermark, no borders, single person only.",
  ].join(" ");
}

const PACK_DIRECTIONS: Record<string, string> = {
  front: "front-facing head-and-shoulders portrait, looking directly at the camera, neutral relaxed face, even soft light",
  three_quarter: "three-quarter view portrait, head turned about 45 degrees to the left, eyes toward the camera, soft light",
  side: "side profile portrait, head turned 90 degrees to the left, clean profile of the face and hairline",
  smiling: "front-facing portrait with a natural, genuine open smile showing teeth, eyes slightly crinkled",
  neutral: "front-facing portrait with a calm neutral expression, mouth closed, looking at the camera",
};

/** Identity pack: the chosen person from fixed angles/expressions, conditioned on the master image. */
export function buildIdentityPackPrompt(c: CreatorContext, kind: string) {
  return [
    "Image 1 is the identity reference of a fictional person. Create a new photograph of EXACTLY the same person — identical face, facial proportions, skin tone, eye color, hair color, hairstyle and hairline.",
    `Shot: ${PACK_DIRECTIONS[kind] ?? PACK_DIRECTIONS.front}.`,
    `Person: ${describePerson(c)}.`,
    "Same plain top as in the reference, plain light-grey studio background, soft even daylight.",
    "Real photograph quality, natural skin texture, no beauty filter, sharp focus.",
    FICTIONAL,
    "No text, no watermark, single person only.",
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
  identityRefs: number;
}) {
  const withModel = opts.preset.needsCreator && !!opts.creator;
  return [
    `Create the opening frame of a vertical 9:16 ${opts.preset.label} social media video, looking like a real smartphone video still (not a studio photo).`,
    `Location: ${opts.variation.location}.`,
    opts.firstScene ? `Shot: ${opts.firstScene.shot}. ${opts.firstScene.action}.` : "",
    referenceBlock({ identityRefs: withModel ? opts.identityRefs : 0, productOnly: !withModel }),
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
