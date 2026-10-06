/** Mock image / video / voice providers — render branded SVG previews, no API keys needed. */
import type {
  ImageGenerationProvider,
  ImageRequest,
  ProviderResult,
  VideoGenerationProvider,
  VideoRequest,
  VoiceGenerationProvider,
} from "../types";
import { renderPhotoPreviewSvg, renderVideoPreviewSvg } from "@/server/render/svg";
import { toDataUri } from "@/server/storage";

const dataUri = (f: { data: Buffer; mimeType: string }) => `data:${f.mimeType};base64,${f.data.toString("base64")}`;

async function avatarUri(url?: string | null) {
  if (!url) return null;
  try {
    return await toDataUri(url);
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockImageProvider implements ImageGenerationProvider {
  readonly name = "mock";
  async generate(req: ImageRequest): Promise<ProviderResult> {
    await sleep(1200 + Math.random() * 1500); // feel like a real generation
    const svg = renderPhotoPreviewSvg({
      productDataUri: dataUri(req.productImage),
      creatorAvatarDataUri: await avatarUri(req.meta.creator?.avatarUrl),
      creatorName: req.meta.creator?.name,
      title: req.meta.title,
      presetLabel: req.meta.presetLabel,
      location: req.meta.location,
      camera: req.meta.camera,
      aspect: req.aspect,
      seed: req.seed ?? 1,
    });
    const [w, h] = req.aspect === "1:1" ? [1080, 1080] : req.aspect === "9:16" ? [1080, 1920] : [1080, 1350];
    return { status: "completed", files: [{ data: Buffer.from(svg), mimeType: "image/svg+xml", width: w, height: h }] };
  }
}

/** Simulates an async provider: first submit returns "pending", the worker polls until done. */
export class MockVideoProvider implements VideoGenerationProvider {
  readonly name = "mock";
  async submit(): Promise<ProviderResult> {
    return { status: "pending", providerJobId: `mock_${Date.now()}`, progress: 30 };
  }
  async poll(providerJobId: string, req: VideoRequest): Promise<ProviderResult> {
    const startedAt = Number(providerJobId.split("_")[1] ?? 0);
    if (Date.now() - startedAt < 4000) return { status: "pending", providerJobId, progress: 70 };
    const svg = renderVideoPreviewSvg({
      productDataUri: dataUri(req.productImage),
      creatorAvatarDataUri: await avatarUri(req.meta.creator?.avatarUrl),
      creatorName: req.meta.creator?.name,
      presetLabel: req.meta.presetLabel,
      scenes: req.script?.scenes ?? [{ title: req.meta.presetLabel, durationSec: req.durationSec }],
      seed: req.seed ?? 1,
    });
    return {
      status: "completed",
      files: [{ data: Buffer.from(svg), mimeType: "image/svg+xml", width: 1080, height: 1920, durationSec: req.durationSec }],
    };
  }
}

export class MockVoiceProvider implements VoiceGenerationProvider {
  readonly name = "mock";
  async synthesize() {
    return null; // no audio in mock mode — the storyboard preview shows captions instead
  }
}
