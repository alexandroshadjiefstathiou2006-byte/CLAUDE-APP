/**
 * OpenAI GPT Image provider (images/edits endpoint) — the product photo is sent as a reference
 * image, never described in text only. `input_fidelity=high` preserves faces/logos from inputs.
 *
 * Env: IMAGE_PROVIDER=openai, OPENAI_API_KEY, OPENAI_IMAGE_MODEL (default gpt-image-1)
 * Network: api.openai.com must be allowed.
 */
import { referenceImages, type ImageGenerationProvider, type ImageRequest, type ProviderResult } from "../types";
import { httpError, ProviderError, providerFetch } from "../errors";
import { imageSize } from "../media";

const SIZES: Record<string, string> = { "1:1": "1024x1024", "4:5": "1024x1536", "9:16": "1024x1536" };
const NAME = "openai";

export class OpenAIImageProvider implements ImageGenerationProvider {
  readonly name = NAME;
  // gpt-image-1 list prices (1024x1536): medium ≈ $0.063, high ≈ $0.25, plus input image tokens.
  readonly estimatedCostUsd = { standard: 0.07, high: 0.26 };

  async generate(req: ImageRequest): Promise<ProviderResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new ProviderError(NAME, "config", "OPENAI_API_KEY is not set");
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const size = SIZES[req.aspect] ?? "1024x1536";
    // Order matters: the prompt refers to "image 1" (product) and the identity images after it.
    const images = referenceImages(req);

    let res: Response;
    if (images.length === 0) {
      res = await providerFetch(NAME, "https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: req.prompt, size, quality: req.quality === "high" ? "high" : "medium", n: 1 }),
      });
    } else {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", req.prompt);
      form.append("size", size);
      form.append("quality", req.quality === "high" ? "high" : "medium");
      form.append("input_fidelity", "high");
      form.append("n", "1");
      images.forEach((img, i) => form.append("image[]", new Blob([new Uint8Array(img.data)], { type: img.mimeType }), `${i + 1}-${img.kind}.png`));
      res = await providerFetch(NAME, "https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
    }
    const text = await res.text();
    if (!res.ok) throw httpError(NAME, res.status, text, { contentPolicy: /moderation|safety|content_policy|policy_violation/i });

    let json: { data?: { b64_json?: string; url?: string }[] };
    try {
      json = JSON.parse(text);
    } catch {
      throw new ProviderError(NAME, "bad_output", `Non-JSON response: ${text.slice(0, 300)}`);
    }
    const first = json.data?.[0];
    let data: Buffer | null = null;
    if (first?.b64_json) data = Buffer.from(first.b64_json, "base64");
    else if (first?.url) data = Buffer.from(await (await fetch(first.url)).arrayBuffer());
    if (!data?.length) throw new ProviderError(NAME, "bad_output", `No image in response: ${text.slice(0, 300)}`);
    const { width, height } = await imageSize(data);
    return { status: "completed", files: [{ data, mimeType: "image/png", width, height }] };
  }
}
