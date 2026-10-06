/**
 * Prompt construction. Users never write prompts — the system composes them from
 * product fidelity constraints + creator identity + creative format + brand kit + variation.
 */
import type { BrandContext, CreatorContext, ProductContext, VariationSpec } from "@/server/ai/types";
import type { PhotoPreset, VideoPreset } from "@/lib/catalog";

export function productFidelityBlock(p: ProductContext) {
  const a = p.analysis;
  const lines = [
    `PRODUCT (must match the reference image exactly): ${p.name}.`,
    a?.summary ? `Description: ${a.summary}` : p.description ? `Description: ${p.description}` : "",
    a?.colors?.length ? `Exact colors: ${a.colors.map((c) => `${c.name} ${c.hex}`).join(", ")}.` : "",
    a?.materials?.length ? `Materials: ${a.materials.join(", ")}.` : "",
    a?.logos?.length ? `Logos (keep exact shape, position, color, legibility): ${a.logos.join("; ")}.` : "",
    a?.graphics?.length ? `Graphics/patterns (reproduce exactly, no redesign): ${a.graphics.join("; ")}.` : "",
    a?.fit ? `Fit/shape: ${a.fit}.` : "",
    ...(a?.fidelityNotes ?? []).map((n) => `Constraint: ${n}`),
    "Do not alter, recolor, simplify, add or remove any logo, text, print, seam or design detail of the product.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function creatorBlock(c: CreatorContext | null | undefined) {
  if (!c) return "";
  return `MODEL (keep identity consistent across all images): ${c.identityPrompt}. ${c.age} years old, ${c.bodyType} build, ${c.hair} hair, ${c.style} personal style.`;
}

export function brandBlock(b: BrandContext | null | undefined) {
  if (!b || (!b.brandName && !b.toneOfVoice && !b.colors.length)) return "";
  return [
    `BRAND: ${b.brandName}.`,
    b.toneOfVoice ? `Brand mood: ${b.toneOfVoice}.` : "",
    b.colors.length ? `Use brand palette accents subtly in styling/set: ${b.colors.join(", ")}.` : "",
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
}) {
  const { preset, product, creator, brand, variation } = opts;
  return [
    `${preset.scene}.`,
    `Setting: ${variation.location}. Camera: ${variation.camera}. Aspect ratio ${opts.aspect}.`,
    creatorBlock(preset.needsCreator ? creator : null),
    productFidelityBlock(product),
    brandBlock(brand),
    "Photorealistic, natural skin texture, realistic fabric drape and lighting, no text overlays, no watermarks.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const NEGATIVE_PROMPT =
  "distorted logo, misspelled text, altered print, wrong color, extra limbs, deformed hands, plastic skin, cartoon, CGI, watermark, low resolution";

export function buildVideoPrompt(opts: {
  preset: VideoPreset;
  product: ProductContext;
  creator?: CreatorContext | null;
  brand?: BrandContext | null;
  variation: VariationSpec;
  scenesSummary: string;
}) {
  return [
    `${opts.preset.label} short-form vertical video, shot on a smartphone, authentic social media creator look.`,
    `Location: ${opts.variation.location}. Camera: ${opts.variation.camera}.`,
    `Shot sequence: ${opts.scenesSummary}`,
    creatorBlock(opts.preset.needsCreator ? opts.creator : null),
    productFidelityBlock(opts.product),
    brandBlock(opts.brand),
    "Natural motion, realistic hands interacting with the product, no warping of logos or prints.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
