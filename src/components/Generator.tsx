"use client";

import { AlertCircle, CheckCircle2, Download, Info, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { encodeMp3, encodeWav } from "@/lib/audio";
import { splitIntoSections } from "@/lib/chunk";
import { GenerateError, generateSpeech, timestampedFilename, type GenerateProgress } from "@/lib/generate";
import {
  ACCENTS,
  CONVERSATIONAL_WARM_DIRECTION,
  DEFAULT_ACCENT,
  DEFAULT_FORMAT,
  DEFAULT_LEARNER_MODE,
  DEFAULT_PAUSE,
  DEFAULT_PITCH,
  DEFAULT_SPEED,
  DEFAULT_STYLE,
  FORMATS,
  LEARNER_MODES,
  MAX_PRONUNCIATIONS,
  MAX_PRONUNCIATION_LENGTH,
  MAX_TOTAL_CHARS,
  PAUSES,
  PITCHES,
  SPEEDS,
  STYLES,
  type AccentId,
  type FormatId,
  type LearnerModeId,
  type PauseId,
  type PitchId,
  type PronunciationEntry,
  type SpeedValue,
  type StyleId,
  type SynthesisSettings,
} from "@/lib/options";
import AudioPlayer from "./AudioPlayer";

type ProviderInfo = {
  id: string;
  name: string;
  model: string;
  maxSectionChars: number;
  accents: { id: AccentId; label: string; available: boolean }[];
  voices: { id: string; label: string; gender: "female" | "male"; description: string }[];
};
type Config = { configured: boolean; defaultProvider: string | null; providers: ProviderInfo[] };

type Result = { samples: Float32Array; sampleRate: number; sections: number; createdAt: Date; settingsKey: string };
type AudioFile = { url: string; format: FormatId; filename: string; bytes: number };

const PLACEHOLDER = "Hello and welcome. Enter the English text you would like to turn into natural speech.";
const nf = new Intl.NumberFormat("en-US");

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100 disabled:text-slate-500";

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

export default function Generator() {
  const [text, setText] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string>("");

  const [accent, setAccent] = useState<AccentId>(DEFAULT_ACCENT);
  const [voiceId, setVoiceId] = useState("");
  const [style, setStyle] = useState<StyleId>(DEFAULT_STYLE);
  const [learnerMode, setLearnerMode] = useState<LearnerModeId>(DEFAULT_LEARNER_MODE);
  const [speed, setSpeed] = useState<SpeedValue>(DEFAULT_SPEED);
  const [pitch, setPitch] = useState<PitchId>(DEFAULT_PITCH);
  const [pause, setPause] = useState<PauseId>(DEFAULT_PAUSE);
  const [format, setFormat] = useState<FormatId>(DEFAULT_FORMAT);
  const [pronunciations, setPronunciations] = useState<PronunciationEntry[]>([]);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<GenerateProgress | null>(null);
  const [encodeProgress, setEncodeProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [audio, setAudio] = useState<AudioFile | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConfig = useCallback(async () => {
    setConfigError(null);
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data: Config = await res.json();
      setConfig(data);
      setProviderId((p) => p || data.defaultProvider || "");
    } catch {
      setConfigError("We couldn't connect to the server. Please check your internet connection and refresh the page.");
    }
  }, []);

  useEffect(() => {
    // Initial load of the server's voice engine settings.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
  }, [loadConfig]);

  const provider = config?.providers.find((p) => p.id === providerId);
  const maxSectionChars = provider?.maxSectionChars ?? 1500;

  // Pick the first voice when the engine changes or the current voice isn't offered.
  const effectiveVoiceId = provider?.voices.some((v) => v.id === voiceId) ? voiceId : (provider?.voices[0]?.id ?? "");

  const settings: SynthesisSettings = useMemo(
    () => ({ accent, voiceId: effectiveVoiceId, style, learnerMode, speed, pitch, pause, pronunciations }),
    [accent, effectiveVoiceId, style, learnerMode, speed, pitch, pause, pronunciations],
  );
  const settingsKey = JSON.stringify({ providerId, text, settings });

  const charCount = text.length;
  const sectionCount = useMemo(
    () => (charCount > maxSectionChars ? splitIntoSections(text, maxSectionChars).length : 1),
    [text, charCount, maxSectionChars],
  );
  const overLimit = charCount > MAX_TOTAL_CHARS;

  // Encode the combined audio into the chosen format for preview and download.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        setEncodeProgress(0);
        const bytes =
          format === "mp3"
            ? await encodeMp3(result.samples, result.sampleRate, (f) => !cancelled && setEncodeProgress(f))
            : encodeWav(result.samples, result.sampleRate);
        if (cancelled) return;
        const mime = FORMATS.find((f) => f.id === format)!.mime;
        url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        setAudio({ url, format, filename: timestampedFilename(result.createdAt, format), bytes: bytes.byteLength });
      } catch {
        if (!cancelled) {
          setError(
            format === "mp3"
              ? "We couldn't convert the audio to MP3. Please try WAV format instead."
              : "We couldn't prepare the WAV file. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setEncodeProgress(null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [result, format]);

  const handleGenerate = async () => {
    setError(null);
    if (!text.trim()) {
      setError("Please enter some English text before generating audio.");
      return;
    }
    if (overLimit) {
      setError(`Your text is ${nf.format(charCount)} characters. The maximum is ${nf.format(MAX_TOTAL_CHARS)} characters per audio file. Please split it into smaller parts.`);
      return;
    }
    if (!provider) {
      setError("No voice service is set up yet. Ask the person who runs this app to add an API key (see the README).");
      return;
    }
    const badPron = pronunciations.find((p) => (p.written.trim() === "") !== (p.guidance.trim() === "") || /"/.test(p.written + p.guidance));
    if (badPron) {
      setError("Please complete or remove the unfinished Pronunciation Help entry. Each entry needs both a written word and a pronunciation guide, without quotation marks.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setAudio(null);
    setResult(null);
    setProgress(null);
    try {
      const out = await generateSpeech({
        text,
        provider: provider.id,
        maxSectionChars: provider.maxSectionChars,
        settings,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setResult({ ...out, createdAt: new Date(), settingsKey });
    } catch (err) {
      if (controller.signal.aborted) setError("Generation was cancelled.");
      else if (err instanceof GenerateError) setError(err.message);
      else setError("Something went wrong while generating the audio. Please try again.");
    } finally {
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const handleDownload = () => {
    if (!audio) return;
    try {
      const a = document.createElement("a");
      a.href = audio.url;
      a.download = audio.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setError("The download couldn't start. Please try again, or right-click the player and choose “Save audio as…”.");
    }
  };

  const statusText = (() => {
    if (!busy) return null;
    if (!progress || progress.phase === "generating") {
      const total = progress?.total ?? sectionCount;
      const done = progress?.done ?? 0;
      if (progress?.retrying) return "The voice service is busy. Retrying automatically...";
      if (total <= 1) return "Generating English audio...";
      return `Generating audio... Section ${Math.min(done + 1, total)} of ${total}`;
    }
    return "Combining sections into one audio file...";
  })();
  const percent =
    busy && progress?.phase === "generating" && progress.total > 1
      ? Math.round((progress.done / progress.total) * 100)
      : busy && progress?.phase === "combining"
        ? 100
        : null;

  const styleInfo = STYLES.find((s) => s.id === style)!;
  const accentLabel = ACCENTS.find((a) => a.id === accent)!.label;
  const stale = result && result.settingsKey !== settingsKey;
  const duration = result ? result.samples.length / result.sampleRate : 0;

  const updatePron = (i: number, patch: Partial<PronunciationEntry>) =>
    setPronunciations((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">English Speaking Voice Generator</h1>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">Turn English text into clear, natural, and engaging speech.</p>
      </header>

      {configError && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            {configError}{" "}
            <button type="button" onClick={loadConfig} className="font-semibold underline">
              Try again
            </button>
          </div>
        </div>
      )}
      {config && !config.configured && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">No voice service is set up yet.</p>
            <p className="mt-1">
              Audio can&apos;t be generated until an API key is added on the server. Add <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code>{" "}
              (Google) or <code className="rounded bg-amber-100 px-1">OPENAI_API_KEY</code> to the server environment and restart. The README has step-by-step instructions.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Text */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <label htmlFor="script" className="block text-base font-semibold text-slate-900">
            Enter English Text
          </label>
          <textarea
            id="script"
            rows={9}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setConfirmClear(false);
            }}
            placeholder={PLACEHOLDER}
            className="mt-3 w-full resize-y rounded-2xl border border-slate-300 bg-slate-50/60 p-4 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className={`font-medium tabular-nums ${overLimit ? "text-red-600" : "text-slate-700"}`} aria-live="polite">
                Characters: {nf.format(charCount)} / {nf.format(MAX_TOTAL_CHARS)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {sectionCount > 1
                  ? `Long script: it will be split into ${sectionCount} sections of up to ${nf.format(maxSectionChars)} characters, generated with the same voice and style, and combined into one audio file automatically.`
                  : `Texts longer than ${nf.format(maxSectionChars)} characters are split into sections and combined into one audio file automatically.`}
              </p>
            </div>
            {confirmClear ? (
              <div className="flex items-center gap-2 text-sm" role="group" aria-label="Confirm clearing text">
                <span className="text-slate-700">Clear all text?</span>
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    setConfirmClear(false);
                  }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
                >
                  Yes, clear
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => text && setConfirmClear(true)}
                disabled={!text || busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Clear Text
              </button>
            )}
          </div>
        </section>

        {/* Voice settings */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-semibold text-slate-900">Voice Settings</h2>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {config && config.providers.length > 1 && (
              <Field label="Voice Engine" hint="Both engines speak every accent below. You can try each to compare.">
                {(id) => (
                  <select id={id} className={fieldClass} value={providerId} onChange={(e) => setProviderId(e.target.value)} disabled={busy}>
                    {config.providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}

            <Field label="English Accent">
              {(id) => (
                <select id={id} className={fieldClass} value={accent} onChange={(e) => setAccent(e.target.value as AccentId)} disabled={busy}>
                  {ACCENTS.map((a) => {
                    const available = provider ? provider.accents.find((x) => x.id === a.id)?.available : true;
                    return (
                      <option key={a.id} value={a.id} disabled={!available}>
                        {a.label}
                        {available ? "" : " (not available with this engine)"}
                      </option>
                    );
                  })}
                </select>
              )}
            </Field>

            <Field
              label="Voice"
              hint={provider ? `All voices below can speak ${accentLabel}. Official ${provider.name} voice names are shown after the dash.` : undefined}
            >
              {(id) => (
                <select id={id} className={fieldClass} value={effectiveVoiceId} onChange={(e) => setVoiceId(e.target.value)} disabled={busy || !provider}>
                  {!provider && <option value="">No voices available</option>}
                  {provider &&
                    (["female", "male"] as const).map((g) => (
                      <optgroup key={g} label={g === "female" ? "Female voices" : "Male voices"}>
                        {provider.voices
                          .filter((v) => v.gender === g)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label} — {v.id} ({v.description})
                            </option>
                          ))}
                      </optgroup>
                    ))}
                </select>
              )}
            </Field>

            <Field
              label="Speech Style"
              hint={style === "conversational-warm" ? <>Voice direction: “{CONVERSATIONAL_WARM_DIRECTION}”</> : styleInfo.summary}
            >
              {(id) => (
                <select id={id} className={fieldClass} value={style} onChange={(e) => setStyle(e.target.value as StyleId)} disabled={busy}>
                  {STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="English-Learner Mode" hint="Changes only how the text is spoken. Your written text is never changed or simplified.">
              {(id) => (
                <select id={id} className={fieldClass} value={learnerMode} onChange={(e) => setLearnerMode(e.target.value as LearnerModeId)} disabled={busy}>
                  {LEARNER_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Speaking Speed" hint={style === "conversational-warm" && speed !== 1 ? "The voice keeps a natural rhythm rather than mechanically speeding up every word." : undefined}>
              {(id) => (
                <select id={id} className={fieldClass} value={speed} onChange={(e) => setSpeed(Number(e.target.value) as SpeedValue)} disabled={busy}>
                  {SPEEDS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Pitch">
              {(id) => (
                <select id={id} className={fieldClass} value={pitch} onChange={(e) => setPitch(e.target.value as PitchId)} disabled={busy}>
                  {PITCHES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Pause Between Sentences">
              {(id) => (
                <select id={id} className={fieldClass} value={pause} onChange={(e) => setPause(e.target.value as PauseId)} disabled={busy}>
                  {PAUSES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Audio Format">
              {(id) => (
                <select id={id} className={fieldClass} value={format} onChange={(e) => setFormat(e.target.value as FormatId)} disabled={encodeProgress !== null}>
                  {FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                      {f.id === "mp3" ? " (smaller file)" : " (uncompressed)"}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>
              {provider ? provider.name : "The voice engine"} is an AI voice model that follows spoken directions. Accent, speech style, learner mode, speed, pitch and pauses are sent to it as a
              voice direction, so it adjusts delivery naturally; speed and pitch changes are approximate rather than exact percentages. Pauses where long scripts are joined are
              set precisely by this app.
            </p>
          </div>
        </section>

        {/* Pronunciation help */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <details className="group p-5 sm:p-7">
            <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
              <span className="inline-flex items-center gap-2">
                Pronunciation Help <span className="text-sm font-normal text-slate-500">(optional)</span>
                {pronunciations.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{pronunciations.length}</span>
                )}
              </span>
              <span className="float-right text-sm font-normal text-indigo-600 group-open:hidden">Show</span>
              <span className="float-right hidden text-sm font-normal text-indigo-600 group-open:inline">Hide</span>
            </summary>
            <p className="mt-3 text-sm text-slate-600">
              Tell the voice how to say names, places, brands, technical terms, acronyms or foreign words. Your visible text is not changed — the guidance is sent to the voice
              model as a direction, which it follows in most cases. Example: <em>Siem Reap</em> → <em>See-em Ree-ap</em>.
            </p>
            <div className="mt-4 space-y-3">
              {pronunciations.map((p, i) => {
                const notFound = p.written.trim() && !text.toLowerCase().includes(p.written.trim().toLowerCase());
                return (
                  <div key={i} className="rounded-xl border border-slate-200 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="block text-xs font-semibold text-slate-700">
                        Written word
                        <input
                          className={`${fieldClass} mt-1`}
                          value={p.written}
                          maxLength={MAX_PRONUNCIATION_LENGTH}
                          placeholder="Siem Reap"
                          onChange={(e) => updatePron(i, { written: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Pronunciation guidance
                        <input
                          className={`${fieldClass} mt-1`}
                          value={p.guidance}
                          maxLength={MAX_PRONUNCIATION_LENGTH}
                          placeholder="See-em Ree-ap"
                          onChange={(e) => updatePron(i, { guidance: e.target.value })}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setPronunciations((list) => list.filter((_, j) => j !== i))}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        aria-label={`Remove pronunciation for ${p.written || "entry"}`}
                      >
                        <Trash2 className="h-4 w-4" /> <span className="sm:hidden">Remove</span>
                      </button>
                    </div>
                    {notFound && <p className="mt-2 text-xs text-amber-700">This word doesn&apos;t appear in your text yet, so it won&apos;t have any effect.</p>}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              disabled={pronunciations.length >= MAX_PRONUNCIATIONS}
              onClick={() => setPronunciations((list) => [...list, { written: "", guidance: "" }])}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add pronunciation
            </button>
          </details>
        </section>

        {/* Generate */}
        <section className="space-y-3">
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy || !config?.configured}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Generating English audio...
              </>
            ) : (
              "Generate Audio"
            )}
          </button>
          {busy && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm font-medium text-indigo-900">
                <span>{statusText}</span>
                <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-lg px-2 py-1 text-indigo-700 underline hover:bg-indigo-100">
                  Cancel
                </button>
              </div>
              {percent !== null && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Result */}
        {result && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="your-audio">
            <h2 id="your-audio" className="text-xl font-semibold text-slate-900">
              Your Audio
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-emerald-700" aria-live="polite">
              <CheckCircle2 className="h-4 w-4" /> Your audio is ready.
              {result.sections > 1 && <span className="font-normal text-slate-500">({result.sections} sections combined into one file)</span>}
            </p>
            {stale && <p className="mt-2 text-sm text-amber-700">You&apos;ve changed the text or settings since this audio was made. Click Generate Audio again to apply them.</p>}

            <div className="mt-4">
              {audio ? (
                <AudioPlayer src={audio.url} knownDuration={duration} />
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing your {format.toUpperCase()} file{encodeProgress !== null ? `... ${Math.round(encodeProgress * 100)}%` : "..."}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!audio || encodeProgress !== null}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-5 w-5" /> Download Audio
            </button>
            {audio && (
              <p className="mt-2 text-center text-xs text-slate-500">
                {audio.filename} · {(audio.bytes / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </section>
        )}
      </div>

      <footer className="mt-10 text-center text-xs text-slate-400">
        {provider ? `Voice engine: ${provider.name} (${provider.model})` : null}
      </footer>
    </main>
  );
}
