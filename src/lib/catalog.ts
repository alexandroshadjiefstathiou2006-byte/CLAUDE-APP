/**
 * Creative catalog — the single source of truth for what users can create and what it costs.
 * Used by the UI (wizard, pricing labels) and by the worker (prompt building, credit debits).
 * Tweak pricing here; nothing else needs to change.
 */

export type CreativeKind = "photo" | "video";

export interface PhotoPreset {
  id: string;
  kind: "photo";
  label: string;
  description: string;
  /** Does this format feature a human creator? */
  needsCreator: boolean;
  /** Scene direction injected into the image prompt. */
  scene: string;
  locations: string[];
  cameras: string[];
  accent: string; // UI gradient
}

export interface VideoPreset {
  id: string;
  kind: "video";
  label: string;
  description: string;
  needsCreator: boolean;
  /** Is the creator speaking to camera (needs voice + lip-sync)? */
  talking: boolean;
  /** Scene skeleton the script generator fills in. */
  structure: string[];
  locations: string[];
  accent: string;
  tags: string[];
}

export const PHOTO_PRESETS: PhotoPreset[] = [
  {
    id: "studio",
    kind: "photo",
    label: "Studio Product Photo",
    description: "Clean e-commerce shot on a seamless backdrop.",
    needsCreator: false,
    scene: "professional studio product photograph on a seamless backdrop, soft diffused key light, subtle shadow, e-commerce hero image",
    locations: ["seamless warm grey backdrop", "pure white cyclorama", "soft beige paper backdrop", "pastel gradient backdrop"],
    cameras: ["straight-on 50mm", "45-degree three-quarter angle", "top-down flat lay", "low hero angle"],
    accent: "from-zinc-200 to-zinc-50",
  },
  {
    id: "lifestyle",
    kind: "photo",
    label: "Lifestyle Photo",
    description: "Your product styled in a real-life setting.",
    needsCreator: false,
    scene: "editorial lifestyle photograph, product naturally styled in a lived-in setting, natural window light, shallow depth of field",
    locations: ["sunlit Scandinavian apartment", "cafe table by the window", "bedroom with linen sheets", "concrete loft with plants"],
    cameras: ["35mm candid", "50mm detail", "overhead flat lay", "close-up texture shot"],
    accent: "from-amber-200 to-orange-50",
  },
  {
    id: "model",
    kind: "photo",
    label: "Model Wearing Product",
    description: "Your AI creator wearing the product, catalog-ready.",
    needsCreator: true,
    scene: "fashion e-commerce photograph of the model wearing the product, full outfit visible, confident natural pose",
    locations: ["minimal studio", "city sidewalk", "neutral interior with arched doorway", "rooftop at golden hour"],
    cameras: ["full-body 85mm", "three-quarter body", "waist-up portrait", "walking mid-stride"],
    accent: "from-violet-200 to-fuchsia-50",
  },
  {
    id: "mirror_selfie",
    kind: "photo",
    label: "Mirror Selfie",
    description: "Authentic phone mirror selfie — perfect UGC look.",
    needsCreator: true,
    scene: "authentic smartphone mirror selfie, phone partially covering face, slightly imperfect framing, real bedroom or fitting room, iPhone photo quality",
    locations: ["bedroom full-length mirror", "store fitting room", "hallway mirror", "bathroom mirror with warm light"],
    cameras: ["phone held at chest", "phone held high", "slight tilt", "close mirror crop"],
    accent: "from-pink-200 to-rose-50",
  },
  {
    id: "streetwear",
    kind: "photo",
    label: "Streetwear",
    description: "Urban, gritty, hype-brand energy.",
    needsCreator: true,
    scene: "streetwear editorial photograph, urban environment, flash photography look, bold attitude",
    locations: ["graffiti alley", "subway platform", "parking garage at night", "skate park"],
    cameras: ["low angle wide 24mm", "direct flash portrait", "motion blur walking", "crouched pose"],
    accent: "from-slate-300 to-slate-50",
  },
  {
    id: "luxury",
    kind: "photo",
    label: "Luxury",
    description: "High-end campaign aesthetic.",
    needsCreator: true,
    scene: "luxury fashion campaign photograph, refined styling, dramatic soft light, magazine quality",
    locations: ["marble hotel lobby", "Parisian balcony", "modernist villa", "art gallery"],
    cameras: ["85mm portrait", "full-body editorial", "seated pose", "over-the-shoulder"],
    accent: "from-stone-300 to-amber-50",
  },
  {
    id: "fitness",
    kind: "photo",
    label: "Fitness",
    description: "Active, energetic, in-motion.",
    needsCreator: true,
    scene: "athletic lifestyle photograph, mid-workout energy, natural sweat, dynamic pose",
    locations: ["modern gym", "outdoor running track", "yoga studio", "boxing gym"],
    cameras: ["action shot", "three-quarter body", "low angle power pose", "candid between sets"],
    accent: "from-lime-200 to-emerald-50",
  },
  {
    id: "beach",
    kind: "photo",
    label: "Beach",
    description: "Sun, sand and summer vibes.",
    needsCreator: true,
    scene: "summer beach lifestyle photograph, warm sunlight, relaxed vacation mood",
    locations: ["sandy beach at golden hour", "beach club", "coastal boardwalk", "rocky cove"],
    cameras: ["wide environmental", "candid walking", "seated on sand", "backlit portrait"],
    accent: "from-sky-200 to-cyan-50",
  },
  {
    id: "outdoor",
    kind: "photo",
    label: "Outdoor",
    description: "Nature, adventure and fresh air.",
    needsCreator: true,
    scene: "outdoor lifestyle photograph in nature, soft overcast light, adventurous mood",
    locations: ["forest trail", "mountain overlook", "wildflower field", "lakeside dock"],
    cameras: ["wide environmental", "three-quarter body", "candid laughing", "walking away look back"],
    accent: "from-green-200 to-teal-50",
  },
  {
    id: "instagram",
    kind: "photo",
    label: "Instagram-style",
    description: "Feed-ready, trendy, creator aesthetic.",
    needsCreator: true,
    scene: "trendy Instagram creator photo, candid but curated, film-like color grade, 4:5 feed composition",
    locations: ["brunch spot", "city crosswalk", "boutique hotel room", "flower market"],
    cameras: ["candid 35mm", "photo dump style", "outfit check from below", "detail close-up"],
    accent: "from-orange-200 to-pink-50",
  },
];

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: "ugc_ad",
    kind: "video",
    label: "UGC Ad",
    description: "Creator-style ad with hook, demo and CTA.",
    needsCreator: true,
    talking: true,
    structure: ["Hook to camera", "Picks up product", "Puts it on / uses it", "Close-up detail", "Reaction & benefit", "CTA"],
    locations: ["bedroom", "living room", "car", "kitchen"],
    accent: "from-violet-300 to-indigo-50",
    tags: ["ugc", "ad"],
  },
  {
    id: "product_showcase",
    kind: "video",
    label: "Product Showcase",
    description: "Cinematic product B-roll, no talking.",
    needsCreator: false,
    talking: false,
    structure: ["Hero reveal", "Slow orbit", "Fabric / detail macro", "Styled context", "End card"],
    locations: ["studio", "minimal set", "textured backdrop"],
    accent: "from-zinc-300 to-zinc-50",
    tags: ["ad"],
  },
  {
    id: "talking_head",
    kind: "video",
    label: "Talking Head",
    description: "Creator talks to camera about the product.",
    needsCreator: true,
    talking: true,
    structure: ["Hook", "Problem", "Product intro", "Benefits", "CTA"],
    locations: ["bedroom", "home office", "car", "walk-and-talk street"],
    accent: "from-blue-200 to-sky-50",
    tags: ["ugc"],
  },
  {
    id: "unboxing",
    kind: "video",
    label: "Unboxing",
    description: "The excitement of opening the package.",
    needsCreator: true,
    talking: true,
    structure: ["Package on table", "Opening", "First look reaction", "Try on / feel", "Verdict"],
    locations: ["bedroom floor", "kitchen counter", "desk"],
    accent: "from-amber-200 to-yellow-50",
    tags: ["ugc"],
  },
  {
    id: "grwm",
    kind: "video",
    label: "Get Ready With Me",
    description: "Morning routine story featuring your product.",
    needsCreator: true,
    talking: true,
    structure: ["Morning intro", "Choosing outfit", "Putting product on", "Final look", "Heading out"],
    locations: ["bedroom", "bathroom vanity", "walk-in closet"],
    accent: "from-pink-200 to-rose-50",
    tags: ["ugc"],
  },
  {
    id: "outfit_showcase",
    kind: "video",
    label: "Outfit Showcase",
    description: "Outfit transitions and styling ideas.",
    needsCreator: true,
    talking: false,
    structure: ["Before", "Transition", "Outfit 1", "Outfit 2", "Detail", "Final pose"],
    locations: ["bedroom mirror", "hallway", "street"],
    accent: "from-fuchsia-200 to-purple-50",
    tags: ["ugc", "ad"],
  },
  {
    id: "walking",
    kind: "video",
    label: "Walking / Fashion",
    description: "Runway-style walk in a great location.",
    needsCreator: true,
    talking: false,
    structure: ["Wide establishing", "Walking toward camera", "Detail tracking shot", "Turn & look back"],
    locations: ["city street", "beach boardwalk", "hotel corridor", "park path"],
    accent: "from-stone-300 to-stone-50",
    tags: ["ad"],
  },
  {
    id: "testimonial",
    kind: "video",
    label: "Testimonial",
    description: "Honest review from a happy customer.",
    needsCreator: true,
    talking: true,
    structure: ["Credibility hook", "Before experience", "What changed", "Proof / detail", "Recommendation"],
    locations: ["living room", "car", "kitchen"],
    accent: "from-emerald-200 to-green-50",
    tags: ["ugc", "ad"],
  },
  {
    id: "problem_solution",
    kind: "video",
    label: "Problem → Solution",
    description: "Name the pain, reveal the fix.",
    needsCreator: true,
    talking: true,
    structure: ["Problem hook", "Agitate", "Reveal product", "Demonstrate", "Result & CTA"],
    locations: ["bedroom", "street", "gym"],
    accent: "from-red-200 to-orange-50",
    tags: ["ugc", "ad"],
  },
  {
    id: "tiktok_ad",
    kind: "video",
    label: "TikTok-style Ad",
    description: "Fast cuts, native captions, trend energy.",
    needsCreator: true,
    talking: true,
    structure: ["Pattern-interrupt hook", "Quick demo cuts", "Text-overlay benefits", "Social proof", "CTA"],
    locations: ["bedroom", "street", "car", "store"],
    accent: "from-cyan-200 to-teal-50",
    tags: ["ugc", "ad"],
  },
];

export const ALL_PRESETS = [...PHOTO_PRESETS, ...VIDEO_PRESETS];
export const getPreset = (id: string) => ALL_PRESETS.find((p) => p.id === id);

export const AD_STYLES = [
  { id: "authentic", label: "Authentic UGC", tone: "casual, genuine, slightly unpolished, like a real customer" },
  { id: "excited", label: "Excited / Hype", tone: "high-energy, enthusiastic, fast-paced" },
  { id: "calm", label: "Calm & Aesthetic", tone: "soft-spoken, aesthetic, ASMR-adjacent, slow" },
  { id: "funny", label: "Funny / Relatable", tone: "humorous, self-aware, relatable" },
  { id: "premium", label: "Premium", tone: "confident, refined, understated luxury" },
  { id: "educational", label: "Educational", tone: "informative, specific, detail-oriented" },
] as const;

export const PLATFORMS = [
  { id: "tiktok", label: "TikTok", aspect: "9:16" },
  { id: "reels", label: "Instagram Reels", aspect: "9:16" },
  { id: "shorts", label: "YouTube Shorts", aspect: "9:16" },
  { id: "meta_feed", label: "Meta Feed", aspect: "4:5" },
] as const;

export const PHOTO_ASPECTS = [
  { id: "4:5", label: "4:5 Feed" },
  { id: "1:1", label: "1:1 Square" },
  { id: "9:16", label: "9:16 Story" },
] as const;


/* ── Credit pricing ─────────────────────────────────────────────── */

export const CREDIT_COSTS = {
  photoStandard: 1,
  photoHigh: 2,
  /** credits per second of video */
  videoPerSecond: 1,
};

export type Quality = "standard" | "high";

export function photoCost(quality: Quality) {
  return quality === "high" ? CREDIT_COSTS.photoHigh : CREDIT_COSTS.photoStandard;
}

export function videoCost(durationSec: number) {
  return Math.ceil(durationSec * CREDIT_COSTS.videoPerSecond);
}

export function generationCost(opts: { kind: CreativeKind; quality?: Quality; durationSec?: number; count: number }) {
  const unit = opts.kind === "photo" ? photoCost(opts.quality ?? "standard") : videoCost(opts.durationSec ?? 15);
  return unit * opts.count;
}

export const MAX_VARIATIONS = 10;
