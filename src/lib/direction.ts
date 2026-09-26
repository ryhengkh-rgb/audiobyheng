import {
  findAccent,
  findLearnerMode,
  findPause,
  findPitch,
  findSpeed,
  findStyle,
  type SynthesisSettings,
} from "./options";

export type SectionInfo = { index: number; total: number };

/**
 * Builds the natural-language voice direction sent to the TTS model. The same
 * direction is sent for every section of a script so voice, accent, energy and
 * pacing stay consistent from start to finish.
 */
export function buildDirection(settings: SynthesisSettings, section?: SectionInfo): string {
  const accent = findAccent(settings.accent);
  const style = findStyle(settings.style);
  const learner = findLearnerMode(settings.learnerMode);
  const speed = findSpeed(settings.speed);
  const pitch = findPitch(settings.pitch);
  const pause = findPause(settings.pause);

  const lines: string[] = [];
  lines.push(`Accent: Speak English with ${accent?.direction ?? "a natural English accent"}. Keep this exact accent for every word.`);
  lines.push(`Speech style: ${style?.direction ?? ""}`);
  if (learner?.direction) lines.push(`Listener: ${learner.direction}`);
  if (speed?.direction) lines.push(`Pace: ${speed.direction}`);
  if (pitch?.direction) lines.push(`Pitch: ${pitch.direction}`);
  if (pause?.direction) lines.push(`Pauses: ${pause.direction}`);
  lines.push(
    "Pronunciation: Pronounce every word clearly and completely; never cut words off. Read numbers, years, dates, times, prices, percentages, decimals, phone numbers, abbreviations, acronyms, website addresses and email addresses the way a native speaker with this accent naturally would, using context (for example, 2026 as a year is \"twenty twenty-six\", $25 is \"twenty-five dollars\", Dr. before a name is \"Doctor\"). Say acronyms as words when that is the normal way to say them (NASA, UNESCO), otherwise letter by letter (FBI, CEO).",
  );
  lines.push(
    "Intonation: Use natural rising or falling intonation for questions, natural emotion for exclamations, and a slightly different voice colour for quoted dialogue, while remaining the same single speaker.",
  );

  const entries = settings.pronunciations.filter((p) => p.written.trim() && p.guidance.trim());
  if (entries.length) {
    lines.push(
      "Custom pronunciations (say these words this way; do not read this list aloud):\n" +
        entries.map((p) => `- "${p.written.trim()}" is pronounced "${p.guidance.trim()}"`).join("\n"),
    );
  }

  if (section && section.total > 1) {
    lines.push(
      `Continuity: This is part ${section.index + 1} of ${section.total} of one continuous recording by the same speaker. Keep exactly the same voice, accent, energy, pace, pitch and volume as the rest of the recording. Do not start or finish as if it were a separate recording.`,
    );
  }

  return lines.join("\n");
}

/**
 * A single prompt for models (such as Gemini TTS) that take the direction and
 * the script together. The script is included exactly as written.
 */
export function buildCombinedPrompt(text: string, settings: SynthesisSettings, section?: SectionInfo): string {
  return [
    "You are a voice actor recording an English voiceover.",
    "Read the TRANSCRIPT below aloud exactly as written, word for word. Do not add, skip, change, translate or explain any words, and never read these directions aloud.",
    "",
    "### DIRECTOR'S NOTES",
    buildDirection(settings, section),
    "",
    "### TRANSCRIPT",
    text,
  ].join("\n");
}
