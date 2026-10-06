/**
 * Google Gemini image provider ("Nano Banana" family) via the Gemini API generateContent endpoint.
 * The product photo (and creator identity portrait) are sent as inline image parts — the model
 * edits/composes from the real product rather than from a text description.
 *
 * Env: IMAGE_PROVIDER=google, GEMINI_API_KEY, GEMINI_IMAGE_MODEL (default gemini-2.5-flash-image)
 * Network: generativelanguage.googleapis.com
 */
import { referenceImages, type ImageGenerationProvider, type ImageRequest, type ProviderResult } from "../types";
import { httpError, ProviderError, providerFetch } from "../errors";
import { imageSize } from "../media";

const NAME = "google";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] } }[];
  promptFeedback?: { blockReason?: string };
}

export function geminiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new ProviderError(NAME, "config", "GEMINI_API_KEY is not set");
  return key;
}

export class GoogleImageProvider implements ImageGenerationProvider {
  readonly name = NAME;
  // gemini-2.5-flash-image: ~$0.039 per output image (1290 output tokens @ $30/M) + small input cost.
  readonly estimatedCostUsd = { standard: 0.04, high: 0.04 };

  async generate(req: ImageRequest): Promise<ProviderResult> {
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
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
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: req.aspect } },
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
    const part = cand?.content?.parts?.find((p) => p.inlineData?.data);
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
