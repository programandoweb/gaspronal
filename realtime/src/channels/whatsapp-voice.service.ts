import { Injectable } from "@nestjs/common";
import { downloadContentFromMessage, type WAMessage } from "@whiskeysockets/baileys";
import { spawn } from "node:child_process";
import { LaravelAgentSettingsClient } from "../agents/laravel-agent-settings.client";

type Audio = NonNullable<NonNullable<WAMessage["message"]>["audioMessage"]>;
type VoiceRejection = "disabled" | "too_long" | "too_large";
type VoiceResult = { allowed: true; seconds: number | null } | { allowed: false; reason: VoiceRejection };
export type VoiceReason = VoiceRejection | "rate_limited" | "download_failed" | "invalid_audio" | "unavailable" | "stt_failed" | "no_speech";

export class VoiceError extends Error {
  constructor(public readonly reason: VoiceReason) { super(reason); }
}

export function voiceErrorMessage(reason: string): string {
  switch (reason) {
    case "disabled": case "unavailable":
      return "Con mucho gusto le atiendo. Por ahora no puedo escuchar notas de voz. ¿Me escribe su consulta, por favor?";
    case "too_long":
      return "¿Me puede enviar una nota de voz de máximo 60 segundos o escribirme su consulta, por favor?";
    case "too_large":
      return "La nota de voz llegó demasiado pesada. ¿Me la puede enviar más corta o escribir su consulta?";
    case "rate_limited":
      return "He recibido varias notas de voz seguidas. Por favor, espere unos minutos o escríbame su consulta.";
    case "no_speech":
      return "No logré entender la nota de voz. ¿Me la puede repetir o escribir su consulta, por favor?";
    default:
      return "Disculpe, no pude procesar esa nota de voz. ¿Me la envía nuevamente o escribe su consulta?";
  }
}

export function getVoiceAudio(message: WAMessage): Audio | null {
  const outer = message.message;
  const inner = outer?.ephemeralMessage?.message
    ?? outer?.viewOnceMessage?.message
    ?? outer?.viewOnceMessageV2?.message
    ?? outer;
  return inner?.audioMessage?.ptt === true ? inner.audioMessage : null;
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = Number(String(value));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export function checkVoiceAudio(audio: Pick<Audio, "seconds" | "fileLength">): VoiceResult {
  if (process.env.WHATSAPP_VOICE_ENABLED === "false") return { allowed: false, reason: "disabled" };
  const seconds = asNumber(audio.seconds);
  const bytes = asNumber(audio.fileLength);
  if (seconds !== null && seconds > 60) return { allowed: false, reason: "too_long" };
  if (bytes !== null && bytes > 4_194_304) return { allowed: false, reason: "too_large" };
  return { allowed: true, seconds };
}

async function downloadLimited(audio: Audio): Promise<Buffer> {
  let stream: Awaited<ReturnType<typeof downloadContentFromMessage>>;
  try {
    stream = await downloadContentFromMessage(audio, "audio", { options: { timeout: 20_000 } });
  } catch {
    throw new VoiceError("download_failed");
  }
  let length = 0;
  const chunks: Buffer[] = [];
  try {
    for await (const part of stream) {
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      length += chunk.length;
      if (length > 4_194_304) { stream.destroy(); throw new VoiceError("too_large"); }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof VoiceError) throw error;
    throw new VoiceError("download_failed");
  }
  if (length < 64) throw new VoiceError("invalid_audio");
  return Buffer.concat(chunks, length);
}

/** FFmpeg normalization ported from ivoolveFlow; no audio saved to disk. */
export function normalizeVoiceAudio(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-hide_banner", "-nostdin", "-i", "pipe:0", "-t", "62",
      "-vn", "-ac", "1", "-ar", "16000",
      "-c:a", "libmp3lame", "-b:a", "32k", "-f", "mp3", "pipe:1",
    ], { stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0, settled = false;
    const complete = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) { child.kill("SIGKILL"); reject(error); }
      else if (size < 64) reject(new VoiceError("invalid_audio"));
      else resolve(Buffer.concat(chunks, size));
    };
    const timer = setTimeout(() => complete(new VoiceError("invalid_audio")), 30_000);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2_097_152) return complete(new VoiceError("too_large"));
      chunks.push(chunk);
    });
    child.stderr.resume();
    child.on("error", () => complete(new VoiceError("unavailable")));
    child.on("close", code => complete(code === 0 ? undefined : new VoiceError("invalid_audio")));
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}

@Injectable()
export class WhatsAppVoiceService {
  constructor(private readonly settings: LaravelAgentSettingsClient) {}

  async transcribe(audio: Audio, agentId: string): Promise<string> {
    const config = await this.settings.credentials(agentId);
    const gemini = [config.primary, config.fallback]
      .find(model => model?.provider.driver === "gemini" && model.provider.api_key);
    const key = process.env.GEMINI_STT_API_KEY?.trim() || gemini?.provider.api_key || config.api_key;
    if (!key) throw new VoiceError("unavailable");

    const original = await downloadLimited(audio);
    const mp3 = await normalizeVoiceAudio(original);
    const model = encodeURIComponent(process.env.GEMINI_STT_MODEL?.trim() || "gemini-2.5-flash");
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(40_000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: "Transcribe literalmente este audio en español (es-CO). Devuelve solamente las palabras pronunciadas, sin comentarios, comillas ni traducción. Si no se escucha voz inteligible, responde exactamente [SIN_VOZ]." },
            { inlineData: { mimeType: "audio/mpeg", data: mp3.toString("base64") } },
          ] }],
          generationConfig: { temperature: 0, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
    } catch { throw new VoiceError("stt_failed"); }
    if (!response.ok) throw new VoiceError("stt_failed");
    const result = await response.json().catch(() => ({})) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = (result.candidates?.[0]?.content?.parts ?? [])
      .map(part => part.text ?? "").join("").replace(/\s+/gu, " ").trim().slice(0, 4000);
    return text.includes("[SIN_VOZ]") ? "" : text;
  }
}
