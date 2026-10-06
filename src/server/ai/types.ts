/**
 * AI provider abstraction. The application only talks to these interfaces;
 * concrete vendors live in ./providers and are selected in ./registry.ts.
 */

/* ── Domain context passed into every provider ─────────────────── */

export interface ProductAnalysis {
  summary: string;
  productType: string;
  colors: { name: string; hex: string }[];
  materials: string[];
  logos: string[];
  graphics: string[];
  fit: string;
  /** Hard constraints the generation must respect, e.g. "white chest logo stays left side". */
  fidelityNotes: string[];
  sellingPoints: string[];
}

export interface ProductContext {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  logoUrl?: string | null;
  colors: string[];
  analysis?: ProductAnalysis | null;
}

export interface CreatorContext {
  id: string;
  name: string;
  gender: string;
  age: number;
  appearance: string;
  bodyType: string;
  hair: string;
  style: string;
  location: string;
  identityPrompt: string;
  seed: number;
  avatarUrl: string;
  referenceImages: string[];
  voiceId?: string | null;
}

export interface BrandContext {
  brandName: string;
  colors: string[];
  fonts: string;
  toneOfVoice: string;
  targetCustomer: string;
  logoUrl?: string | null;
}

/** What differs between variations of the same generation. */
export interface VariationSpec {
  index: number;
  seed: number;
  location: string;
  camera: string;
  hookAngle: string;
  tone: string;
  cta: string;
}

export interface Scene {
  order: number;
  title: string;
  shot: string; // camera / framing
  action: string; // what happens on screen
  line?: string; // spoken line (if talking)
  overlay?: string; // on-screen caption text
  durationSec: number;
}

export interface UGCScript {
  hook: string;
  script: string;
  scenes: Scene[];
  caption: string;
  cta: string;
  hashtags: string[];
  tone: string;
}

export interface PhotoConcept {
  title: string;
  prompt: string;
  negativePrompt: string;
  caption: string;
}

/* ── Provider results ──────────────────────────────────────────── */

export interface GeneratedFile {
  data: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export type ProviderResult =
  | { status: "completed"; files: GeneratedFile[]; thumbnail?: GeneratedFile }
  | { status: "pending"; providerJobId: string; progress?: number };

/* ── Provider interfaces ───────────────────────────────────────── */

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  /** Product photo — the primary reference. Providers MUST condition on it for fidelity. */
  productImage: { data: Buffer; mimeType: string };
  /** Optional identity references for the creator (face consistency). */
  creatorReferences?: { data: Buffer; mimeType: string }[];
  aspect: "1:1" | "4:5" | "9:16";
  quality: "standard" | "high";
  seed?: number;
  /** Extra context mock/preview renderers can use. */
  meta: { title: string; presetLabel: string; product: ProductContext; creator?: CreatorContext | null; location: string; camera: string };
}

export interface ImageGenerationProvider {
  readonly name: string;
  generate(req: ImageRequest): Promise<ProviderResult>;
}

export interface VideoRequest {
  prompt: string;
  script?: UGCScript | null;
  /** Start frame / product reference. */
  productImage: { data: Buffer; mimeType: string };
  /** Voiceover audio for talking formats (lip-sync providers use it). */
  voiceover?: { data: Buffer; mimeType: string } | null;
  aspect: "9:16" | "4:5" | "1:1";
  durationSec: number;
  seed?: number;
  meta: { title: string; presetLabel: string; product: ProductContext; creator?: CreatorContext | null; location: string };
}

export interface VideoGenerationProvider {
  readonly name: string;
  /** Start generation. May complete synchronously or return a pending provider job id. */
  submit(req: VideoRequest): Promise<ProviderResult>;
  /** Poll a pending provider job. */
  poll(providerJobId: string, req: VideoRequest): Promise<ProviderResult>;
}

export interface VoiceRequest {
  text: string;
  voiceId?: string | null;
  style?: string;
}

export interface VoiceGenerationProvider {
  readonly name: string;
  synthesize(req: VoiceRequest): Promise<{ data: Buffer; mimeType: string } | null>;
}

export interface ScriptRequest {
  product: ProductContext;
  creator?: CreatorContext | null;
  brand?: BrandContext | null;
  presetId: string;
  styleTone: string;
  platform: string;
  durationSec: number;
  variation: VariationSpec;
  /** Hooks already used in this batch — avoid repeating. */
  avoidHooks?: string[];
}

export interface ScriptGenerationProvider {
  readonly name: string;
  analyzeProduct(product: ProductContext, image: { data: Buffer; mimeType: string }): Promise<ProductAnalysis>;
  generateUGCScript(req: ScriptRequest): Promise<UGCScript>;
  generatePhotoConcept(req: Omit<ScriptRequest, "platform" | "durationSec">): Promise<PhotoConcept>;
}
