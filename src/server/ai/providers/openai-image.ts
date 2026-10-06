/**
 * OpenAI gpt-image-1 image provider using the *edits* endpoint so the product photo is used as a
 * reference (much higher product fidelity than text-to-image).
 * API key: OPENAI_API_KEY (set IMAGE_PROVIDER=openai).
 */
import type { ImageGenerationProvider, ImageRequest, ProviderResult } from "../types";

const SIZES: Record<string, string> = { "1:1": "1024x1024", "4:5": "1024x1536", "9:16": "1024x1536" };

export class OpenAIImageProvider implements ImageGenerationProvider {
  readonly name = "openai";

  async generate(req: ImageRequest): Promise<ProviderResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");

    const form = new FormData();
    form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
    form.append("prompt", `${req.prompt}\n\nAvoid: ${req.negativePrompt ?? ""}`);
    form.append("size", SIZES[req.aspect] ?? "1024x1536");
    form.append("quality", req.quality === "high" ? "high" : "medium");
    form.append("input_fidelity", "high");
    const ext = req.productImage.mimeType.split("/")[1] ?? "png";
    form.append("image[]", new Blob([new Uint8Array(req.productImage.data)], { type: req.productImage.mimeType }), `product.${ext}`);
    for (const [i, ref] of (req.creatorReferences ?? []).entries()) {
      if (ref.mimeType === "image/svg+xml") continue; // illustrated stock avatars aren't useful references
      form.append("image[]", new Blob([new Uint8Array(ref.data)], { type: ref.mimeType }), `creator-${i}.png`);
    }

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI image error ${res.status}: ${(await res.text()).slice(0, 500)}`);
    const json = (await res.json()) as { data: { b64_json: string }[] };
    const [w, h] = (SIZES[req.aspect] ?? "1024x1536").split("x").map(Number);
    return {
      status: "completed",
      files: json.data.map((d) => ({ data: Buffer.from(d.b64_json, "base64"), mimeType: "image/png", width: w, height: h })),
    };
  }
}
