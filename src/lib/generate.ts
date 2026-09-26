// Browser-side orchestration: split the script, generate each section through
// the server API (which holds the API keys), then join everything into one file.

import { mergeSegments, pcm16ToFloat32, type PcmSegment } from "./audio";
import { splitIntoSections } from "./chunk";
import { joinGapMs, type SynthesisSettings } from "./options";

export type GenerateProgress =
  | { phase: "generating"; done: number; total: number; retrying?: boolean }
  | { phase: "combining" };

export class GenerateError extends Error {}

const RETRY_DELAYS_MS = [3000, 8000, 15000];
const CONCURRENCY = 2;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

async function generateSection(
  body: Record<string, unknown>,
  signal: AbortSignal,
  onRetry: () => void,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      if (attempt < RETRY_DELAYS_MS.length) {
        onRetry();
        await sleep(RETRY_DELAYS_MS[attempt], signal);
        continue;
      }
      throw new GenerateError("We couldn't connect to the server. Please check your internet connection and try again.");
    }

    if (res.ok) {
      const sampleRate = Number(res.headers.get("X-Sample-Rate") ?? 24000);
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { samples: pcm16ToFloat32(bytes), sampleRate };
    }

    const message: string =
      (await res.json().catch(() => null))?.error ?? "Something went wrong while generating the audio. Please try again.";
    const retryable = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
    // 503 without a configured provider is not temporary.
    if (retryable && !/No voice service is set up/.test(message) && attempt < RETRY_DELAYS_MS.length) {
      onRetry();
      await sleep(RETRY_DELAYS_MS[attempt], signal);
      continue;
    }
    throw new GenerateError(message);
  }
}

export async function generateSpeech(opts: {
  text: string;
  provider: string;
  maxSectionChars: number;
  settings: SynthesisSettings;
  signal: AbortSignal;
  onProgress: (p: GenerateProgress) => void;
}): Promise<{ samples: Float32Array; sampleRate: number; sections: number }> {
  const { text, provider, maxSectionChars, settings, signal, onProgress } = opts;
  const sections = splitIntoSections(text, maxSectionChars);
  if (!sections.length) throw new GenerateError("Please enter some English text before generating audio.");

  const results: { samples: Float32Array; sampleRate: number }[] = new Array(sections.length);
  let done = 0;
  let next = 0;
  onProgress({ phase: "generating", done: 0, total: sections.length });

  // Stop the other in-flight section as soon as one fails or the user cancels.
  const inner = new AbortController();
  signal.addEventListener("abort", () => inner.abort());

  const worker = async () => {
    while (next < sections.length && !inner.signal.aborted) {
      const i = next++;
      results[i] = await generateSection(
        {
          ...settings,
          provider,
          text: sections[i].text,
          sectionIndex: i,
          sectionCount: sections.length,
        },
        inner.signal,
        () => onProgress({ phase: "generating", done, total: sections.length, retrying: true }),
      );
      done++;
      onProgress({ phase: "generating", done, total: sections.length });
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sections.length) }, worker));
  } catch (err) {
    inner.abort();
    throw err;
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  onProgress({ phase: "combining" });
  const sampleRate = results[0].sampleRate;
  if (results.some((r) => r.sampleRate !== sampleRate)) {
    throw new GenerateError("The audio sections couldn't be combined because they came back in different formats. Please try again.");
  }
  const segments: PcmSegment[] = sections.map((s, i) => ({
    samples: results[i].samples,
    gapAfterMs: s.boundaryAfter === "end" ? 0 : joinGapMs(settings.pause, settings.style, settings.learnerMode, s.boundaryAfter),
  }));
  let samples: Float32Array;
  try {
    samples = mergeSegments(segments, sampleRate);
  } catch {
    throw new GenerateError("The audio sections couldn't be combined. Please try again.");
  }
  if (samples.length < sampleRate * 0.3) {
    throw new GenerateError("The voice service returned silent audio. Please try again or choose another voice.");
  }
  return { samples, sampleRate, sections: sections.length };
}

export function timestampedFilename(date: Date, ext: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `english-voice-${stamp}.${ext}`;
}
