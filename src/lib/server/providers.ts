
import { buildCombinedPrompt, buildDirection, type SectionInfo } from "../direction";
import { ACCENTS, type AccentId, type SynthesisSettings } from "../options";

export type Voice = {
  /** Official provider voice name, sent to the API. */
  id: string;
  label: string;
  gender: "female" | "male";
  description: string;
};

export type ProviderId = "gemini" | "openai";

export type Provider = {
  id: ProviderId;
  name: string;
  model: () => string;
  isConfigured: () => boolean;
  voices: Voice[];
  /**
   * Accents this provider can deliver. Both current providers use
   * multilingual voices whose accent is set by the model's voice direction.
   */
  accents: AccentId[];
  maxSectionChars: number;
  sampleRate: number;
  synthesize: (text: string, settings: SynthesisSettings, section: SectionInfo, signal: AbortSignal) => Promise<Uint8Array>;
};

/** An error whose message is safe to show to a non-technical user. */
export class TtsError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable = false,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 100_000;

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  if (!v || v.startsWith("your_") || v === "...") return undefined;
  return v;
}

async function providerFetch(providerName: string, url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: AbortSignal.any([signal, timeout]) });
  } catch (err) {
    if (signal.aborted) throw new TtsError("The request was cancelled.", 499);
    if (timeout.aborted) {
      throw new TtsError(`${providerName} took too long to respond. Please try again.`, 504, true);
    }
    console.error(`[tts] ${providerName} network error:`, err instanceof Error ? err.message : err);
    throw new TtsError(`We couldn't reach ${providerName}. Please check the server's internet connection and try again.`, 502, true);
  }
}

/** Maps provider HTTP errors to friendly messages without exposing the provider's response. */
async function toTtsError(providerName: string, keyName: string, res: Response): Promise<TtsError> {
  const body = await res.text().catch(() => "");
  // Log a short excerpt server-side for troubleshooting; never sent to the browser.
  console.error(`[tts] ${providerName} HTTP ${res.status}:`, body.slice(0, 500));
  if (res.status === 400 && /api key|API_KEY/i.test(body)) {
    return new TtsError(`The ${providerName} API key was rejected. Please check ${keyName} on the server.`, 401);
  }
  if (res.status === 401 || res.status === 403) {
    return new TtsError(`The ${providerName} API key was rejected or doesn't have access to text-to-speech. Please check ${keyName} on the server.`, 401);
  }
  if (res.status === 404) {
    return new TtsError(`The ${providerName} voice model isn't available for this API key. Please check the model setting on the server.`, 502);
  }
  if (res.status === 429) {
    return new TtsError(`${providerName} is busy or the usage limit has been reached. Please wait a moment and try again.`, 429, true);
  }
  if (res.status === 400) {
    return new TtsError(`${providerName} couldn't process this text. Try shortening or simplifying the section and generate again.`, 422);
  }
  return new TtsError(`${providerName} had a temporary problem generating audio. Please try again.`, 502, true);
}

// ---------------------------------------------------------------------------
// Google Gemini TTS (Gemini API). Returns 24 kHz, 16-bit, mono PCM.
// ---------------------------------------------------------------------------

const GEMINI_VOICES: Voice[] = [
  { id: "Sulafat", label: "English Female 1", gender: "female", description: "Warm" },
  { id: "Aoede", label: "English Female 2", gender: "female", description: "Breezy" },
  { id: "Kore", label: "English Female 3", gender: "female", description: "Firm, clear" },
  { id: "Achernar", label: "English Female 4", gender: "female", description: "Soft" },
  { id: "Achird", label: "English Male 1", gender: "male", description: "Friendly" },
  { id: "Puck", label: "English Male 2", gender: "male", description: "Upbeat" },
  { id: "Charon", label: "English Male 3", gender: "male", description: "Informative" },
  { id: "Umbriel", label: "English Male 4", gender: "male", description: "Easy-going" },
];

const geminiKey = () => env("GEMINI_API_KEY") ?? env("GOOGLE_API_KEY");

type GeminiResponse = {
  candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] }; finishReason?: string }[];
};

async function geminiOnce(text: string, settings: SynthesisSettings, section: SectionInfo, signal: AbortSignal): Promise<Uint8Array> {
  const base = env("GEMINI_API_BASE_URL") ?? "https://generativelanguage.googleapis.com";
  const model = gemini.model();
  const res = await providerFetch(
    "Google Gemini",
    `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey()! },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildCombinedPrompt(text, settings, section) }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          // Low temperature keeps delivery consistent from section to section.
          temperature: 0.7,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voiceId } } },
        },
      }),
    },
    signal,
  );
  if (!res.ok) throw await toTtsError("Google Gemini", "GEMINI_API_KEY (or GOOGLE_API_KEY)", res);

  const data = (await res.json()) as GeminiResponse;
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    console.error("[tts] Gemini returned no audio. finishReason:", data.candidates?.[0]?.finishReason);
    throw new TtsError("The voice service didn't return any audio for this section. Please try again.", 502, true);
  }
  const rate = Number(part.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
  if (rate !== gemini.sampleRate) {
    throw new TtsError("The voice service returned audio in an unexpected format.", 502);
  }
  return new Uint8Array(Buffer.from(part.inlineData.data, "base64"));
}

export const gemini: Provider = {
  id: "gemini",
  name: "Google Gemini TTS",
  model: () => env("GEMINI_TTS_MODEL") ?? "gemini-2.5-flash-preview-tts",
  isConfigured: () => Boolean(geminiKey()),
  voices: GEMINI_VOICES,
  accents: ACCENTS.map((a) => a.id),
  maxSectionChars: 1500,
  sampleRate: 24000,
  async synthesize(text, settings, section, signal) {
    try {
      return await geminiOnce(text, settings, section, signal);
    } catch (err) {
      // Gemini occasionally returns an empty or failed response; one quick retry.
      if (err instanceof TtsError && err.retryable && err.status !== 429 && !signal.aborted) {
        return geminiOnce(text, settings, section, signal);
      }
      throw err;
    }
  },
};

// ---------------------------------------------------------------------------
// OpenAI gpt-4o-mini-tts. Returns 24 kHz, 16-bit, mono PCM.
// ---------------------------------------------------------------------------

const OPENAI_VOICES: Voice[] = [
  { id: "marin", label: "English Female 1", gender: "female", description: "Natural, warm" },
  { id: "coral", label: "English Female 2", gender: "female", description: "Bright, friendly" },
  { id: "nova", label: "English Female 3", gender: "female", description: "Clear, energetic" },
  { id: "shimmer", label: "English Female 4", gender: "female", description: "Soft" },
  { id: "cedar", label: "English Male 1", gender: "male", description: "Natural, warm" },
  { id: "ash", label: "English Male 2", gender: "male", description: "Friendly" },
  { id: "ballad", label: "English Male 3", gender: "male", description: "Expressive" },
  { id: "echo", label: "English Male 4", gender: "male", description: "Calm, clear" },
];

export const openai: Provider = {
  id: "openai",
  name: "OpenAI TTS",
  model: () => env("OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts",
  isConfigured: () => Boolean(env("OPENAI_API_KEY")),
  voices: OPENAI_VOICES,
  accents: ACCENTS.map((a) => a.id),
  maxSectionChars: 2000,
  sampleRate: 24000,
  async synthesize(text, settings, section, signal) {
    const base = env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
    const res = await providerFetch(
      "OpenAI",
      `${base}/audio/speech`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("OPENAI_API_KEY")}` },
        body: JSON.stringify({
          model: openai.model(),
          voice: settings.voiceId,
          input: text,
          // gpt-4o-mini-tts takes free-form voice instructions; the `speed`
          // parameter is not supported by this model, so pace is directed too.
          instructions: buildDirection(settings, section),
          response_format: "pcm",
        }),
      },
      signal,
    );
    if (!res.ok) throw await toTtsError("OpenAI", "OPENAI_API_KEY", res);
    return new Uint8Array(await res.arrayBuffer());
  },
};

export const PROVIDERS: Provider[] = [gemini, openai];

/** The provider to use: TTS_PROVIDER if set, else the first one with credentials. */
export function getProvider(requested?: string): Provider | undefined {
  const configured = PROVIDERS.filter((p) => p.isConfigured());
  if (requested) return configured.find((p) => p.id === requested);
  const preferred = env("TTS_PROVIDER");
  return configured.find((p) => p.id === preferred) ?? configured[0];
}
