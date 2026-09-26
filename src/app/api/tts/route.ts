import {
  MAX_PRONUNCIATION_LENGTH,
  MAX_PRONUNCIATIONS,
  findAccent,
  findLearnerMode,
  findPause,
  findPitch,
  findSpeed,
  findStyle,
  type SynthesisSettings,
} from "@/lib/options";
import { PROVIDERS, TtsError, getProvider } from "@/lib/server/providers";

// Generates the audio for one section of the script. The browser sends the
// sections one after another, shows progress, and joins them into one file.
export const maxDuration = 120;

const fail = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("The request couldn't be read. Please refresh the page and try again.", 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return fail("Please enter some English text before generating audio.", 400);

  const anyConfigured = PROVIDERS.some((p) => p.isConfigured());
  if (!anyConfigured) {
    return fail(
      "No voice service is set up yet. Ask the person who runs this app to add a Google Gemini or OpenAI API key to the server settings (see the README).",
      503,
    );
  }
  const provider = getProvider(typeof body.provider === "string" ? body.provider : undefined);
  if (!provider) return fail("The selected voice engine isn't available. Please refresh the page and try again.", 400);

  if (text.length > provider.maxSectionChars) {
    return fail(`This section is too long for ${provider.name} (limit ${provider.maxSectionChars.toLocaleString("en-US")} characters).`, 413);
  }

  const accent = findAccent(String(body.accent));
  if (!accent || !provider.accents.includes(accent.id)) {
    return fail("The selected English accent isn't supported by this voice engine. Please choose another accent.", 400);
  }
  const voice = provider.voices.find((v) => v.id === body.voiceId);
  if (!voice) return fail("The selected voice isn't available. Please choose another voice.", 400);
  const style = findStyle(String(body.style));
  if (!style) return fail("The selected speech style isn't supported. Please choose another style.", 400);
  const learner = findLearnerMode(String(body.learnerMode));
  const speed = findSpeed(Number(body.speed));
  const pitch = findPitch(String(body.pitch));
  const pause = findPause(String(body.pause));
  if (!learner || !speed || !pitch || !pause) {
    return fail("One of the voice settings isn't valid. Please refresh the page and try again.", 400);
  }

  const rawPron = Array.isArray(body.pronunciations) ? body.pronunciations : [];
  if (rawPron.length > MAX_PRONUNCIATIONS) {
    return fail(`Please use at most ${MAX_PRONUNCIATIONS} pronunciation entries.`, 400);
  }
  const pronunciations = [];
  for (const p of rawPron) {
    const written = typeof p?.written === "string" ? p.written.trim() : "";
    const guidance = typeof p?.guidance === "string" ? p.guidance.trim() : "";
    if (!written && !guidance) continue;
    if (!written || !guidance || written.length > MAX_PRONUNCIATION_LENGTH || guidance.length > MAX_PRONUNCIATION_LENGTH || /["\n]/.test(written + guidance)) {
      return fail(
        "A pronunciation entry isn't valid. Each entry needs both a written word and a pronunciation guide (up to 100 characters, no quotation marks).",
        400,
      );
    }
    // Only send guidance for words in this section, so the model is never
    // tempted to say a word that isn't in the script.
    if (text.toLowerCase().includes(written.toLowerCase())) pronunciations.push({ written, guidance });
  }

  const index = Number.isInteger(body.sectionIndex) ? (body.sectionIndex as number) : 0;
  const total = Number.isInteger(body.sectionCount) ? (body.sectionCount as number) : 1;

  const settings: SynthesisSettings = {
    accent: accent.id,
    voiceId: voice.id,
    style: style.id,
    learnerMode: learner.id,
    speed: speed.value,
    pitch: pitch.id,
    pause: pause.id,
    pronunciations,
  };

  try {
    const pcm = await provider.synthesize(text, settings, { index, total }, req.signal);
    if (pcm.byteLength < 2) throw new TtsError("The voice service returned empty audio. Please try again.", 502, true);
    return new Response(new Uint8Array(pcm), {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Audio-Format": "pcm_s16le",
        "X-Sample-Rate": String(provider.sampleRate),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof TtsError) return fail(err.message, err.status);
    console.error("[tts] Unexpected error:", err);
    return fail("Something went wrong while generating the audio. Please try again.", 500);
  }
}
