/**
 * fal.ai image-to-video provider (queue API). Default model: Kling image-to-video.
 * API key: FAL_KEY (set VIDEO_PROVIDER=fal). Model: FAL_VIDEO_MODEL.
 *
 * For talking-head formats, swap in a lip-sync / avatar vendor behind the same interface —
 * VideoRequest already carries the script and the voiceover audio.
 */
import type { ProviderResult, VideoGenerationProvider, VideoRequest } from "../types";

const model = () => process.env.FAL_VIDEO_MODEL || "fal-ai/kling-video/v2.1/standard/image-to-video";

function headers() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

export class FalVideoProvider implements VideoGenerationProvider {
  readonly name = "fal";

  async submit(req: VideoRequest): Promise<ProviderResult> {
    const imageUrl = `data:${req.productImage.mimeType};base64,${req.productImage.data.toString("base64")}`;
    const res = await fetch(`https://queue.fal.run/${model()}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        prompt: req.prompt.slice(0, 2400),
        image_url: imageUrl,
        duration: req.durationSec > 7 ? "10" : "5",
        aspect_ratio: req.aspect,
      }),
    });
    if (!res.ok) throw new Error(`fal submit error ${res.status}: ${(await res.text()).slice(0, 500)}`);
    const json = (await res.json()) as { request_id: string };
    return { status: "pending", providerJobId: json.request_id, progress: 10 };
  }

  async poll(requestId: string, req: VideoRequest): Promise<ProviderResult> {
    const base = `https://queue.fal.run/${model().split("/").slice(0, 2).join("/")}/requests/${requestId}`;
    const status = await fetch(`${base}/status`, { headers: headers() });
    if (!status.ok) throw new Error(`fal status error ${status.status}`);
    const s = (await status.json()) as { status: string };
    if (s.status !== "COMPLETED") return { status: "pending", providerJobId: requestId, progress: s.status === "IN_PROGRESS" ? 60 : 20 };

    const result = await fetch(base, { headers: headers() });
    if (!result.ok) throw new Error(`fal result error ${result.status}`);
    const json = (await result.json()) as { video?: { url: string } };
    if (!json.video?.url) throw new Error("fal returned no video");
    const video = await fetch(json.video.url);
    return {
      status: "completed",
      files: [{ data: Buffer.from(await video.arrayBuffer()), mimeType: "video/mp4", durationSec: req.durationSec, width: 1080, height: 1920 }],
    };
  }
}
