/**
 * Provider registry — the ONLY place that knows which vendor implements which capability.
 * To add a vendor: implement the interface in ./providers and add a case here.
 */
import type { ImageGenerationProvider, ScriptGenerationProvider, VideoGenerationProvider, VoiceGenerationProvider } from "./types";
import { MockScriptProvider } from "./providers/mock-script";
import { MockImageProvider, MockVideoProvider, MockVoiceProvider } from "./providers/mock-media";
import { AnthropicScriptProvider } from "./providers/anthropic-script";
import { OpenAIImageProvider } from "./providers/openai-image";
import { FalVideoProvider } from "./providers/fal-video";
import { ElevenLabsVoiceProvider } from "./providers/elevenlabs-voice";
import { GoogleImageProvider } from "./providers/google-image";
import { GoogleVeoProvider } from "./providers/google-veo";
import { ProviderError } from "./errors";

const cache = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

export function scriptProvider(): ScriptGenerationProvider {
  const id = process.env.SCRIPT_PROVIDER || "mock";
  return once(`script:${id}`, () => (id === "anthropic" ? new AnthropicScriptProvider() : new MockScriptProvider()));
}

export function imageProvider(): ImageGenerationProvider {
  if (testOverrides.image) return testOverrides.image;
  const id = process.env.IMAGE_PROVIDER || "mock";
  const inner = once(`image:${id}`, () => (id === "openai" ? new OpenAIImageProvider() : id === "google" ? new GoogleImageProvider() : new MockImageProvider()));
  return testFaults.imageFailures > 0 ? flakyImage(inner) : inner;
}

/**
 * Fault injection for the live test harness (scripts/live-test.ts) — makes the next N image
 * calls fail with a retryable upstream error so retry/refund behaviour can be verified for real.
 */
export const testFaults = { imageFailures: 0 };

/** Test-only: replace the image provider (e.g. a capturing stub) to inspect provider requests. */
export const testOverrides: { image: ImageGenerationProvider | null } = { image: null };
function flakyImage(inner: ImageGenerationProvider): ImageGenerationProvider {
  return {
    name: inner.name,
    estimatedCostUsd: inner.estimatedCostUsd,
    async generate(req) {
      if (testFaults.imageFailures > 0) {
        testFaults.imageFailures--;
        throw new ProviderError(inner.name, "upstream", "Injected test failure (HTTP 503 simulated)");
      }
      return inner.generate(req);
    },
  };
}

export function videoProvider(): VideoGenerationProvider {
  const id = process.env.VIDEO_PROVIDER || "mock";
  return once(`video:${id}`, () => (id === "fal" ? new FalVideoProvider() : id === "google" ? new GoogleVeoProvider() : new MockVideoProvider()));
}

export function voiceProvider(): VoiceGenerationProvider {
  const id = process.env.VOICE_PROVIDER || "mock";
  return once(`voice:${id}`, () => (id === "elevenlabs" ? new ElevenLabsVoiceProvider() : new MockVoiceProvider()));
}

export function providerSummary() {
  return {
    script: process.env.SCRIPT_PROVIDER || "mock",
    image: process.env.IMAGE_PROVIDER || "mock",
    video: process.env.VIDEO_PROVIDER || "mock",
    voice: process.env.VOICE_PROVIDER || "mock",
  };
}
