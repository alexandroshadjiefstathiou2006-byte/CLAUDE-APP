/**
 * Google Gemini image provider ("Nano Banana" family) via the Gemini API generateContent endpoint.
 * The product photo (and creator identity portrait) are sent as inline image parts — the model
 * edits/composes from the real product rather than from a text description.
 *
 * Env: IMAGE_PROVIDER=google, GEMINI_API_KEY,
 *   GEMINI_IMAGE_MODEL / GEMINI_IMAGE_SIZE       standard photos (default gemini-nano-banana-2.1, 1K)
 *   GEMINI_IMAGE_MODEL_HQ / GEMINI_IMAGE_SIZE_HQ high-quality photos (default gemini-3-pro-image, 2K)
 * Network: generativelanguage.googleapis.com
 * Docs (checked 2026-11-06): aistudio.google.com/docs/image-generation?generate-content=true.
 * generateContent is "legacy" but fully supported; gemini-2.5-flash-image shuts down 2027-03-15.
 */
import { referenceImages, type ImageGenerationProvider, type ImageRequest, type ProviderResult } from "../types";
import { httpError, ProviderError, providerFetch } from "../errors";
import { imageSize } from "../media";

const NAME = "google";
const BASE = "https://generativelanguage.googleapis.com/v1";

interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean; inlineData?: { mimeType: string; data: string } }[] } }[];
  promptFeedback?: { blockReason?: string };
}

export function geminiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new ProviderError(NAME, "config", "GEMINI_API_KEY is not set");
  return key;
}

export class GoogleImageProvider implements ImageGenerationProvider {
  readonly name = NAME;
  // Output price per image (2026-11 pricing page): nano-banana-2.1 1K $0.034, gemini-3-pro-image 2K $0.134.
  readonly estimatedCostUsd = { standard: 0.035, high: 0.135 };

  async generate(req: ImageRequest): Promise<ProviderResult> {
    const high = req.quality === "high";
    const model = high ? process.env.GEMINI_IMAGE_MODEL_HQ || "gemini-3-pro-image" : process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
    const outputSize = high ? process.env.GEMINI_IMAGE_SIZE_HQ || "2K" : process.env.GEMINI_IMAGE_SIZE || "1K";
    // Each image is preceded by a short label so the model knows which is the product and
    // which are identity references (and which angle each identity image shows).
    const images = referenceImages(req);
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            ...images.flatMap((img, i) => [
              { text: `Image ${i + 1}: ${img.role === "product" ? "PRODUCT reference — reproduce this exact item" : `IDENTITY reference of the person (${img.kind.replace("_", " ")})`}` },
              { inlineData: { mimeType: img.mimeType, data: img.data.toString("base64") } },
            ]),
            { text: req.prompt },
          ],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: req.aspect, imageSize: outputSize } },
    };
    const res = await providerFetch(NAME, `${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw httpError(NAME, res.status, text, { contentPolicy: /SAFETY|PROHIBITED|blocked/i });

    const json = JSON.parse(text) as GeminiResponse;
    if (json.promptFeedback?.blockReason) throw new ProviderError(NAME, "content_policy", `Prompt blocked: ${json.promptFeedback.blockReason}`);
    const cand = json.candidates?.[0];
    // Skip draft "thought" images and take the last real one, which is the final output.
    const part = cand?.content?.parts?.filter((p) => p.inlineData?.data && !p.thought).at(-1);
    if (!part?.inlineData) {
      const reason = cand?.finishReason ?? "unknown";
      const said = cand?.content?.parts?.map((p) => p.text).filter(Boolean).join(" ").slice(0, 300);
      if (/SAFETY|PROHIBITED|BLOCKLIST|IMAGE_SAFETY/i.test(reason)) throw new ProviderError(NAME, "content_policy", `finishReason=${reason} ${said ?? ""}`);
      throw new ProviderError(NAME, "bad_output", `No image returned (finishReason=${reason}) ${said ?? ""}`);
    }
    const data = Buffer.from(part.inlineData.data, "base64");
    const { width, height } = await imageSize(data);
    return { status: "completed", files: [{ data, mimeType: part.inlineData.mimeType || "image/png", width, height }] };
  }
}
