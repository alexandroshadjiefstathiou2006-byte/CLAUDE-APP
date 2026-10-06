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
  const id = process.env.IMAGE_PROVIDER || "mock";
  return once(`image:${id}`, () => (id === "openai" ? new OpenAIImageProvider() : new MockImageProvider()));
}

export function videoProvider(): VideoGenerationProvider {
  const id = process.env.VIDEO_PROVIDER || "mock";
  return once(`video:${id}`, () => (id === "fal" ? new FalVideoProvider() : new MockVideoProvider()));
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
