import type { VariationSpec } from "@/server/ai/types";
import { getPreset } from "@/lib/catalog";
import { hashString } from "@/lib/utils";

/** Creative angles a hook can take. Variations cycle through these so each ad tests something different. */
export const HOOK_ANGLES = [
  "surprise",
  "pov",
  "problem",
  "search_ended",
  "social_proof",
  "comparison",
  "question",
  "storytime",
  "objection",
  "listicle",
] as const;

export const CTAS = [
  "Tap the link to grab yours",
  "Shop now before it sells out",
  "Link in bio — trust me",
  "Get yours today",
  "Try it risk-free",
  "Your size is still in stock — for now",
];

const DEFAULT_CAMERAS = ["handheld selfie angle", "tripod medium shot", "close-up", "wide establishing", "over-the-shoulder"];

/**
 * Build N deliberately different variation specs.
 * Each axis is offset by a different stride so variations don't all change in lock-step.
 */
export function buildVariations(opts: { presetId: string; count: number; baseSeed: string; tone: string }): VariationSpec[] {
  const preset = getPreset(opts.presetId);
  const locations = preset?.locations ?? ["studio"];
  const cameras = preset && preset.kind === "photo" ? preset.cameras : DEFAULT_CAMERAS;
  const seed0 = hashString(opts.baseSeed);
  const offset = seed0 % 97;

  return Array.from({ length: opts.count }, (_, i) => {
    const k = i + offset;
    return {
      index: i,
      seed: (seed0 + i * 7919) >>> 0,
      location: locations[k % locations.length],
      camera: cameras[(k * 3 + 1) % cameras.length],
      hookAngle: HOOK_ANGLES[k % HOOK_ANGLES.length],
      tone: opts.tone,
      cta: CTAS[(k * 5 + 2) % CTAS.length],
    };
  });
}
