/**
 * Template-based script generator. Used when no LLM key is configured, so the whole
 * product works offline. Produces genuinely varied hooks/scripts per variation.
 */
import type {
  PhotoConcept,
  ProductAnalysis,
  ProductContext,
  ScriptGenerationProvider,
  ScriptRequest,
  UGCScript,
  Scene,
} from "../types";
import { getPreset } from "@/lib/catalog";
import { pick, seededRandom } from "@/lib/utils";
import { NEGATIVE_PROMPT } from "@/server/generation/prompts";

const HOOKS: Record<string, string[]> = {
  surprise: [
    "Okay, I wasn't expecting this {item} to fit this well...",
    "I did not think a {item} could look this good on me.",
    "Okay, these might be my new favorite {items}.",
  ],
  pov: [
    "POV: you finally found a {item} that actually fits.",
    "POV: your {item} gets more compliments than you do.",
    "POV: you stopped settling for basic {items}.",
  ],
  problem: [
    "If your {items} always lose their shape after one wash, watch this.",
    "Stop buying {items} that look nothing like the photos.",
    "I was so tired of {items} that felt cheap after a month.",
  ],
  search_ended: [
    "I've been looking for a {item} like this forever.",
    "The search for the perfect {item} is officially over.",
    "I tried 7 different {items} before I found this one.",
  ],
  social_proof: [
    "Everyone keeps asking me where my {item} is from, so here you go.",
    "This {item} has 2,000+ five-star reviews and now I get why.",
    "My friends made me post this {item}.",
  ],
  comparison: [
    "$200 {item} vs this one — honestly I can't tell the difference.",
    "I compared this {item} to the designer one I own...",
    "Cheap {item} vs this {item}: let's talk about it.",
  ],
  question: [
    "Is this the most comfortable {item} on the internet?",
    "Why did nobody tell me about this {item} sooner?",
    "Can a {item} actually change your whole outfit? Yes.",
  ],
  storytime: [
    "So I wore this {item} to brunch and three people stopped me.",
    "Storytime: how this {item} saved my whole trip.",
    "I bought this {item} on a whim and now I own it in every color.",
  ],
  objection: [
    "I almost didn't buy this {item} because of the price. Big mistake.",
    "I thought this {item} would be another overhyped buy. I was wrong.",
    "Don't buy this {item}... unless you want to wear it every day.",
  ],
  listicle: [
    "3 reasons this {item} lives in my rotation now.",
    "5 ways I style this {item} — number 3 is my favorite.",
    "Things nobody tells you about this {item}: a thread.",
  ],
};

const BENEFITS = [
  "the fabric feels super soft but still structured",
  "the fit is relaxed without looking sloppy",
  "the color is exactly like the photos",
  "it holds its shape even after washing",
  "it goes with literally everything I own",
  "the details look way more expensive than it is",
];

function itemNames(p: ProductContext) {
  const type = (p.analysis?.productType || p.name.split(" ").slice(-1)[0] || "piece").toLowerCase();
  const plural = type.endsWith("s") ? type : `${type}s`;
  return { item: type, items: plural };
}

function fill(t: string, p: ProductContext) {
  const { item, items } = itemNames(p);
  return t.replaceAll("{items}", items).replaceAll("{item}", item);
}

export class MockScriptProvider implements ScriptGenerationProvider {
  readonly name = "mock";

  async analyzeProduct(product: ProductContext): Promise<ProductAnalysis> {
    const text = `${product.name} ${product.description}`.toLowerCase();
    const known = ["hoodie", "jeans", "t-shirt", "tee", "dress", "jacket", "sneakers", "shirt", "sweater", "skirt", "shorts", "bag", "cap", "leggings", "coat"];
    const type = known.find((k) => text.includes(k)) ?? product.name.split(" ").slice(-1)[0]?.toLowerCase() ?? "product";
    const colorWords: Record<string, string> = {
      black: "#111111", white: "#F5F5F5", grey: "#8A8A8A", gray: "#8A8A8A", navy: "#1F2A44", blue: "#2F5DA8",
      red: "#C0392B", green: "#2E7D4F", beige: "#D9C7A7", cream: "#F1E8D6", brown: "#6B4A2E", pink: "#E8A1B5", olive: "#6B6B3A",
    };
    const colors = Object.entries(colorWords)
      .filter(([w]) => text.includes(w))
      .map(([name, hex]) => ({ name, hex }));
    const materials = ["cotton", "fleece", "denim", "linen", "wool", "leather", "polyester", "silk", "nylon"].filter((m) => text.includes(m));
    return {
      summary: product.description || product.name,
      productType: type,
      colors: colors.length ? colors : product.colors.map((hex) => ({ name: hex, hex })),
      materials,
      logos: text.includes("logo") ? ["Brand logo as shown in reference image"] : [],
      graphics: text.includes("print") || text.includes("graphic") ? ["Print/graphic as shown in reference image"] : [],
      fit: text.includes("oversized") ? "oversized" : text.includes("slim") ? "slim fit" : "regular fit",
      fidelityNotes: ["Match the reference photo exactly: color, proportions, logo placement and all visible details."],
      sellingPoints: BENEFITS.slice(0, 3),
    };
  }

  async generateUGCScript(req: ScriptRequest): Promise<UGCScript> {
    const rand = seededRandom(req.variation.seed);
    const preset = getPreset(req.presetId);
    const pool = HOOKS[req.variation.hookAngle] ?? HOOKS.surprise;
    const candidates = pool.map((h) => fill(h, req.product)).filter((h) => !req.avoidHooks?.includes(h));
    const hook = candidates.length ? pick(candidates, rand) : fill(pick(pool, rand), req.product);

    const structure = preset && preset.kind === "video" ? preset.structure : ["Hook", "Demo", "Detail", "CTA"];
    const talking = preset && preset.kind === "video" ? preset.talking : true;
    const per = Math.max(1, Math.round(req.durationSec / structure.length));
    const benefits = [...BENEFITS].sort(() => rand() - 0.5);
    const { item } = itemNames(req.product);

    const scenes: Scene[] = structure.map((title, i) => {
      const isFirst = i === 0;
      const isLast = i === structure.length - 1;
      const line = !talking
        ? undefined
        : isFirst
          ? hook
          : isLast
            ? `${req.variation.cta}.`
            : i === 1
              ? `So I got the ${req.product.name} and honestly ${benefits[0]}.`
              : `Look at this — ${benefits[i % benefits.length]}.`;
      return {
        order: i + 1,
        title,
        shot: isFirst ? "Handheld selfie, face close to camera" : isLast ? "Medium shot, product in frame" : pick(["Close-up on product", "Mirror shot", "Tripod medium shot", "Over-the-shoulder"], rand),
        action: sceneAction(title, item, req.creator?.name),
        line,
        overlay: isFirst ? hook : isLast ? req.variation.cta : benefits[i % benefits.length],
        durationSec: per,
      };
    });

    const script = scenes.map((s) => s.line).filter(Boolean).join(" ");
    return {
      hook,
      script: script || scenes.map((s) => s.overlay).join(" · "),
      scenes,
      caption: `${hook} ✨ ${req.product.name}${req.brand?.brandName ? ` by ${req.brand.brandName}` : ""}`,
      cta: req.variation.cta,
      hashtags: ["#fashion", `#${item.replace(/\W/g, "")}`, "#ootd", req.platform === "tiktok" ? "#tiktokmademebuyit" : "#reels"],
      tone: req.styleTone,
    };
  }

  async generatePhotoConcept(req: Omit<ScriptRequest, "platform" | "durationSec">): Promise<PhotoConcept> {
    const preset = getPreset(req.presetId);
    return {
      title: `${preset?.label ?? "Photo"} · ${req.variation.location}`,
      prompt: "",
      negativePrompt: NEGATIVE_PROMPT,
      caption: `${req.product.name} — ${req.variation.location}`,
    };
  }
}

function sceneAction(title: string, item: string, name?: string) {
  const who = name ?? "Creator";
  const t = title.toLowerCase();
  if (t.includes("hook")) return `${who} talks straight to camera, holding the ${item}`;
  if (t.includes("pick")) return `${who} picks up the ${item} and shows it to camera`;
  if (t.includes("put") || t.includes("try")) return `${who} puts on the ${item}`;
  if (t.includes("close") || t.includes("detail") || t.includes("macro")) return `Close-up on fabric, logo and details of the ${item}`;
  if (t.includes("walk")) return `${who} walks toward camera wearing the ${item}`;
  if (t.includes("open") || t.includes("package")) return `${who} opens the package and reveals the ${item}`;
  if (t.includes("cta") || t.includes("verdict") || t.includes("recommend")) return `${who} points to camera / link, final look with the ${item}`;
  if (t.includes("reveal") || t.includes("hero")) return `Hero reveal of the ${item} with light sweep`;
  return `${who} shows the ${item} — ${title.toLowerCase()}`;
}
