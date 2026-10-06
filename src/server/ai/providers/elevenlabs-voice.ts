/**
 * ElevenLabs text-to-speech provider for UGC voiceovers (used with video providers that have
 * no native audio, e.g. fal/Kling).
 * Env: VOICE_PROVIDER=elevenlabs, ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_VOICE_ID
 * Network: api.elevenlabs.io
 */
import type { VoiceGenerationProvider, VoiceRequest } from "../types";
import { httpError, ProviderError, providerFetch } from "../errors";

const NAME = "elevenlabs";

export class ElevenLabsVoiceProvider implements VoiceGenerationProvider {
  readonly name = NAME;

  async synthesize(req: VoiceRequest) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new ProviderError(NAME, "config", "ELEVENLABS_API_KEY is not set");
    const voiceId = req.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const res = await providerFetch(NAME, `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: req.text, model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2" }),
      timeoutMs: 60_000,
    });
    if (!res.ok) throw httpError(NAME, res.status, await res.text());
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length < 500) throw new ProviderError(NAME, "bad_output", `Audio only ${data.length} bytes`);
    return { data, mimeType: "audio/mpeg" };
  }
}
