/**
 * fal.ai image-to-video provider (queue API). Default model: Kling 2.1 standard image-to-video.
 * No native audio — talking formats get an ElevenLabs voiceover stored alongside the clip.
 *
 * Env: VIDEO_PROVIDER=fal, FAL_KEY, FAL_VIDEO_MODEL
 * Network: queue.fal.run (+ fal media CDN for downloads, e.g. v3.fal.media)
 */
import type { ProviderResult, VideoGenerationProvider, VideoRequest } from "../types";
import { httpError, ProviderError, providerFetch } from "../errors";

const NAME = "fal";
const model = () => process.env.FAL_VIDEO_MODEL || "fal-ai/kling-video/v2.1/standard/image-to-video";

function headers() {
  const key = process.env.FAL_KEY;
  if (!key) throw new ProviderError(NAME, "config", "FAL_KEY is not set");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

/** We store fal's own status/response URLs (from the submit response) as the provider job id. */
interface FalHandle { requestId: string; statusUrl: string; responseUrl: string }

export class FalVideoProvider implements VideoGenerationProvider {
  readonly name = NAME;
  readonly nativeAudio = false;
  readonly durationOptions = [5, 10];
  readonly estimatedCostUsdPerSecond = 0.056; // Kling 2.1 standard ≈ $0.28 / 5s

  async submit(req: VideoRequest): Promise<ProviderResult> {
    const res = await providerFetch(NAME, `https://queue.fal.run/${model()}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        prompt: req.prompt.slice(0, 2400),
        image_url: `data:${req.keyframe.mimeType};base64,${req.keyframe.data.toString("base64")}`,
        duration: String(req.durationSec >= 10 ? 10 : 5),
        aspect_ratio: req.aspect,
        negative_prompt: "blur, distort, low quality, warped logo, morphing text",
      }),
      timeoutMs: 60_000,
    });
    const text = await res.text();
    if (!res.ok) throw httpError(NAME, res.status, text, { contentPolicy: /nsfw|safety|content/i });
    const j = JSON.parse(text) as { request_id?: string; status_url?: string; response_url?: string };
    if (!j.request_id) throw new ProviderError(NAME, "bad_output", `No request_id: ${text.slice(0, 300)}`);
    const base = `https://queue.fal.run/${model().split("/").slice(0, 2).join("/")}/requests/${j.request_id}`;
    const handle: FalHandle = { requestId: j.request_id, statusUrl: j.status_url ?? `${base}/status`, responseUrl: j.response_url ?? base };
    return { status: "pending", providerJobId: JSON.stringify(handle), progress: 40 };
  }

  async poll(providerJobId: string, req: VideoRequest): Promise<ProviderResult> {
    const h = JSON.parse(providerJobId) as FalHandle;
    const status = await providerFetch(NAME, h.statusUrl, { headers: headers(), timeoutMs: 30_000 });
    const sText = await status.text();
    if (!status.ok) throw httpError(NAME, status.status, sText);
    const s = JSON.parse(sText) as { status: string };
    if (s.status !== "COMPLETED") return { status: "pending", providerJobId, progress: s.status === "IN_PROGRESS" ? 70 : 50 };

    const result = await providerFetch(NAME, h.responseUrl, { headers: headers(), timeoutMs: 30_000 });
    const rText = await result.text();
    if (!result.ok) throw httpError(NAME, result.status, rText, { contentPolicy: /nsfw|safety|content/i });
    const json = JSON.parse(rText) as { video?: { url: string } };
    if (!json.video?.url) throw new ProviderError(NAME, "bad_output", `No video in result: ${rText.slice(0, 300)}`);
    const video = await providerFetch(NAME, json.video.url);
    if (!video.ok) throw httpError(NAME, video.status, await video.text());
    return { status: "completed", files: [{ data: Buffer.from(await video.arrayBuffer()), mimeType: "video/mp4", durationSec: req.durationSec, width: 1080, height: 1920 }] };
  }
}
