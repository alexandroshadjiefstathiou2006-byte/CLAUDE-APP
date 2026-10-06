/**
 * Calls every real provider once with a tiny request and prints the outcome or the classified error.
 * Use it to check keys / network / model names before running scripts/live-test.ts.
 *   npx tsx scripts/provider-probe.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { OpenAIImageProvider } from "@/server/ai/providers/openai-image";
import { GoogleImageProvider } from "@/server/ai/providers/google-image";
import { GoogleVeoProvider } from "@/server/ai/providers/google-veo";
import { FalVideoProvider } from "@/server/ai/providers/fal-video";
import { ElevenLabsVoiceProvider } from "@/server/ai/providers/elevenlabs-voice";
import { AnthropicScriptProvider } from "@/server/ai/providers/anthropic-script";
import { describeError } from "@/server/ai/errors";
import { toProviderImage } from "@/server/ai/media";

async function main() {
  const product = await toProviderImage({ data: readFileSync(process.argv[2] ?? "test-assets/09163_00.jpg"), mimeType: "image/jpeg" }, 512);
  const meta = { title: "probe", presetLabel: "probe", product: null, creator: null, location: "studio", camera: "50mm" };
  const vreq = { prompt: "Slow camera orbit around the shirt.", keyframe: product, productImage: product, aspect: "9:16" as const, durationSec: 8, meta: { ...meta, product: null as never } };
  const probes: [string, () => Promise<unknown>][] = [
    ["openai image", () => new OpenAIImageProvider().generate({ prompt: "Studio photo of this shirt.", productImage: product, aspect: "1:1", quality: "standard", meta })],
    ["google image", () => new GoogleImageProvider().generate({ prompt: "Studio photo of this shirt.", productImage: product, aspect: "1:1", quality: "standard", meta })],
    ["google veo", () => new GoogleVeoProvider().submit(vreq)],
    ["fal video", () => new FalVideoProvider().submit(vreq)],
    ["elevenlabs", () => new ElevenLabsVoiceProvider().synthesize({ text: "Okay, this shirt fits so well." })],
    ["anthropic", () => new AnthropicScriptProvider().analyzeProduct({ id: "x", name: "Polo", description: "", category: "apparel", imageUrl: "", colors: [] }, product)],
  ];
  for (const [name, run] of probes) {
    const t = Date.now();
    try {
      const r = (await run()) as { status?: string; files?: { data: Buffer }[] } | null;
      console.log(`✅ ${name}: OK in ${Date.now() - t}ms`, r && "status" in r ? `${r.status} ${r.files?.[0]?.data.length ?? ""}` : "");
    } catch (e) {
      const d = describeError(e);
      console.log(`❌ ${name}: [${d.code}${d.retryable ? ", retryable" : ""}] ${d.detail.split("\n")[0].slice(0, 230)}\n   user sees: "${d.userMessage}"`);
    }
  }
}
main();
