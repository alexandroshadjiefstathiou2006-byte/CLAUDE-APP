/**
 * Google Veo image-to-video provider (Gemini API long-running operations).
 * Veo 3 generates synchronized audio, including the creator's speech, from the prompt — this is
 * what makes talking-to-camera UGC possible without a separate lip-sync vendor.
 *
 * Env: VIDEO_PROVIDER=google, GEMINI_API_KEY,
 *      GOOGLE_VIDEO_MODEL (default veo-3.0-fast-generate-001), VEO_DURATIONS (default "8")
 * Network: generativelanguage.googleapis.com
 */
import type { ProviderResult, VideoGenerationProvider, VideoRequest } from "../types";
import { httpError, ProviderError, providerFetch } from "../errors";
import { geminiKey } from "./google-image";

const NAME = "google-veo";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

interface Operation {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: { uri?: string } }[];
      raiMediaFilteredCount?: number;
      raiMediaFilteredReasons?: string[];
    };
  };
}

export class GoogleVeoProvider implements VideoGenerationProvider {
  readonly name = NAME;
  readonly nativeAudio = true;
  readonly durationOptions = (process.env.VEO_DURATIONS || "8").split(",").map(Number).filter(Boolean);
  // Veo 3 Fast ≈ $0.15/s with audio; Veo 3 standard ≈ $0.40/s.
  readonly estimatedCostUsdPerSecond = /fast/.test(process.env.GOOGLE_VIDEO_MODEL || "veo-3.0-fast-generate-001") ? 0.15 : 0.4;

  private model() {
    return process.env.GOOGLE_VIDEO_MODEL || "veo-3.0-fast-generate-001";
  }

  async submit(req: VideoRequest): Promise<ProviderResult> {
    const parameters: Record<string, unknown> = { aspectRatio: req.aspect === "9:16" ? "9:16" : "16:9", personGeneration: "allow_adult" };
    if (this.durationOptions.length > 1) parameters.durationSeconds = req.durationSec;
    const res = await providerFetch(NAME, `${BASE}/models/${this.model()}:predictLongRunning`, {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: req.prompt, image: { bytesBase64Encoded: req.keyframe.data.toString("base64"), mimeType: req.keyframe.mimeType } }],
        parameters,
      }),
      timeoutMs: 60_000,
    });
    const text = await res.text();
    if (!res.ok) throw httpError(NAME, res.status, text, { contentPolicy: /safety|responsible ai|blocked|prohibited/i });
    const op = JSON.parse(text) as Operation;
    if (!op.name) throw new ProviderError(NAME, "bad_output", `No operation name: ${text.slice(0, 300)}`);
    return { status: "pending", providerJobId: op.name, progress: 45 };
  }

  async poll(operationName: string, req: VideoRequest): Promise<ProviderResult> {
    const res = await providerFetch(NAME, `${BASE}/${operationName}`, { headers: { "x-goog-api-key": geminiKey() }, timeoutMs: 30_000 });
    const text = await res.text();
    if (!res.ok) throw httpError(NAME, res.status, text);
    const op = JSON.parse(text) as Operation;
    if (!op.done) return { status: "pending", providerJobId: operationName, progress: 70 };
    if (op.error) {
      const policy = /safety|responsible|filtered|prohibited/i.test(op.error.message);
      throw new ProviderError(NAME, policy ? "content_policy" : "upstream", `Operation error ${op.error.code}: ${op.error.message}`, { retryable: !policy && op.error.code >= 500 });
    }
    const gvr = op.response?.generateVideoResponse;
    const uri = gvr?.generatedSamples?.[0]?.video?.uri;
    if (!uri) {
      if (gvr?.raiMediaFilteredCount) throw new ProviderError(NAME, "content_policy", `Filtered: ${(gvr.raiMediaFilteredReasons ?? []).join("; ")}`);
      throw new ProviderError(NAME, "bad_output", `Operation done but no video: ${text.slice(0, 500)}`);
    }
    const video = await providerFetch(NAME, uri, { headers: { "x-goog-api-key": geminiKey() }, redirect: "follow" });
    if (!video.ok) throw httpError(NAME, video.status, await video.text());
    const data = Buffer.from(await video.arrayBuffer());
    if (data.length < 1000) throw new ProviderError(NAME, "bad_output", `Downloaded video is only ${data.length} bytes`);
    return { status: "completed", files: [{ data, mimeType: "video/mp4", durationSec: req.durationSec, width: 720, height: 1280 }] };
  }
}
