/**
 * ElevenLabs text-to-speech provider for UGC voiceovers.
 * API key: ELEVENLABS_API_KEY (set VOICE_PROVIDER=elevenlabs).
 */
import type { VoiceGenerationProvider, VoiceRequest } from "../types";

export class ElevenLabsVoiceProvider implements VoiceGenerationProvider {
  readonly name = "elevenlabs";

  async synthesize(req: VoiceRequest) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
    const voiceId = req.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: req.text, model_id: "eleven_multilingual_v2" }),
    });
    if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { data: Buffer.from(await res.arrayBuffer()), mimeType: "audio/mpeg" };
  }
}
