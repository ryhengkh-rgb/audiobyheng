// Shared option definitions used by both the browser UI and the API routes.

export const ACCENTS = [
  {
    id: "en-US",
    label: "American English",
    direction: "a natural General American English accent, as spoken across the United States",
  },
  {
    id: "en-GB",
    label: "British English",
    direction: "a natural standard Southern British English accent (modern Received Pronunciation), as spoken in England",
  },
  {
    id: "en-AU",
    label: "Australian English",
    direction: "a natural General Australian English accent, as spoken in Australia",
  },
  {
    id: "en-CA",
    label: "Canadian English",
    direction: "a natural Standard Canadian English accent, as spoken in Canada",
  },
  {
    id: "en-IN",
    label: "Indian English",
    direction: "a natural, clear Indian English accent, as spoken by educated speakers in India",
  },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];
export const DEFAULT_ACCENT: AccentId = "en-US";

export const CONVERSATIONAL_WARM_DIRECTION =
  "Normal, slightly overlapping pacing. Tone is energetic, conversational, and warm.";

export const STYLES = [
  {
    id: "normal",
    label: "Normal",
    summary: "Clear, balanced, and neutral delivery.",
    direction:
      "Clear, balanced, and neutral delivery at a natural pace. Not flat or monotone; use ordinary, natural intonation.",
  },
  {
    id: "conversational-warm",
    label: "Conversational Warm",
    summary: "Friendly, energetic, connected, and natural.",
    direction: `${CONVERSATIONAL_WARM_DIRECTION} Sound like a real person talking naturally to a friend or listener, not someone reading a document. Warm, friendly, and engaging. Energetic without sounding aggressive. Normal overall speaking speed with smooth, slightly tighter transitions between ideas, so thoughts flow into each other. No unnecessarily long pauses. Natural emphasis on important words. "Slightly overlapping pacing" means quick, connected transitions between thoughts; it never means two voices or cut-off words. Not an advertising or announcer voice, and never robotic or monotone.`,
  },
  {
    id: "calm",
    label: "Calm",
    summary: "Gentle pacing, soft delivery, and relaxed pauses.",
    direction:
      "Calm and soothing. Gentle pacing, soft delivery, and relaxed pauses, while every word stays clear.",
  },
  {
    id: "energetic",
    label: "Energetic",
    summary: "Lively delivery with stronger emphasis while remaining understandable.",
    direction:
      "Lively and upbeat with stronger emphasis on key words, while remaining fully understandable. Enthusiastic, not shouting and not an announcer voice.",
  },
  {
    id: "professional",
    label: "Professional",
    summary: "Confident, polished, and suitable for business presentations.",
    direction:
      "Confident, polished, and articulate, suitable for a business presentation. Friendly and human rather than stiff or overly formal.",
  },
  {
    id: "educational",
    label: "Educational",
    summary: "Clear, patient, and suitable for English lessons and explanations.",
    direction:
      "Clear and patient, like explaining a lesson. Highlight key terms with gentle emphasis and keep the listener engaged.",
  },
  {
    id: "podcast",
    label: "Podcast",
    summary: "Natural, personal, and engaging, like a podcast host.",
    direction:
      "Natural, personal, and engaging, like a relaxed podcast host speaking directly to listeners. Conversational rhythm with genuine interest in the topic.",
  },
  {
    id: "storytelling",
    label: "Storytelling",
    summary: "Expressive narration with natural emotional changes.",
    direction:
      "Expressive narration, like an audiobook narrator. Let emotion and rhythm follow the story, with natural changes in tone for dialogue and dramatic moments, without overacting.",
  },
  {
    id: "motivational",
    label: "Motivational",
    summary: "Confident and encouraging without sounding overly dramatic.",
    direction:
      "Confident, encouraging, and uplifting, like a supportive coach. Sincere and inspiring without sounding overly dramatic.",
  },
  {
    id: "friendly-teacher",
    label: "Friendly Teacher",
    summary: "Supportive, clear, patient, and easy for learners to understand.",
    direction:
      "Supportive, kind, and patient, like a friendly English teacher. Clear articulation that is easy for English learners to follow, while still sounding natural.",
  },
  {
    id: "documentary",
    label: "Documentary",
    summary: "Measured, informative, and authoritative without sounding monotone.",
    direction:
      "Measured, informative, and authoritative, like a documentary narrator. Engaged and varied in intonation, never monotone.",
  },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];
export const DEFAULT_STYLE: StyleId = "conversational-warm";

export const LEARNER_MODES = [
  { id: "off", label: "Off", direction: "" },
  {
    id: "beginner",
    label: "Beginner",
    direction:
      "The listener is a beginner English learner: speak slightly slower than normal, with very clear word boundaries, careful pronunciation, and natural but slightly longer pauses between sentences. Do not exaggerate or sound unnatural.",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    direction:
      "The listener is an intermediate English learner: use natural pronunciation with moderately clear pacing, slightly slower than native conversational speed, with clear sentence stress and intonation.",
  },
  {
    id: "natural",
    label: "Natural Fluency",
    direction:
      "Use natural native-like pacing, connected speech, and natural reductions and sentence rhythm, while staying clear enough to be easily understood.",
  },
] as const;

export type LearnerModeId = (typeof LEARNER_MODES)[number]["id"];
export const DEFAULT_LEARNER_MODE: LearnerModeId = "natural";

export const SPEEDS = [
  { value: 0.75, label: "0.75x — Slow", direction: "Speak noticeably slower than a normal pace (about three quarters of normal speed)." },
  { value: 0.9, label: "0.9x — Slightly Slow", direction: "Speak slightly slower than a normal pace." },
  { value: 1.0, label: "1.0x — Normal", direction: "" },
  { value: 1.1, label: "1.1x — Slightly Fast", direction: "Speak slightly faster than a normal pace, without rushing any words." },
  { value: 1.25, label: "1.25x — Fast", direction: "Speak at a brisk, fast pace (about a quarter faster than normal), keeping every word clearly pronounced." },
] as const;

export type SpeedValue = (typeof SPEEDS)[number]["value"];
export const DEFAULT_SPEED: SpeedValue = 1.0;

export const PITCHES = [
  { id: "lower", label: "Lower", direction: "Use a slightly lower, deeper pitch than the voice's usual pitch." },
  { id: "normal", label: "Normal", direction: "" },
  { id: "higher", label: "Higher", direction: "Use a slightly higher, brighter pitch than the voice's usual pitch." },
] as const;

export type PitchId = (typeof PITCHES)[number]["id"];
export const DEFAULT_PITCH: PitchId = "normal";

export const PAUSES = [
  {
    id: "tight",
    label: "Tight",
    direction: "Keep pauses between sentences short and tight, while keeping sentences distinct.",
    sentenceGapMs: 180,
    paragraphGapMs: 420,
  },
  {
    id: "natural",
    label: "Natural",
    direction: "Use natural pauses between sentences, with a slightly longer pause at paragraph breaks.",
    sentenceGapMs: 280,
    paragraphGapMs: 600,
  },
  {
    id: "relaxed",
    label: "Relaxed",
    direction: "Use relaxed, unhurried pauses between sentences and a longer pause at paragraph breaks.",
    sentenceGapMs: 420,
    paragraphGapMs: 850,
  },
] as const;

export type PauseId = (typeof PAUSES)[number]["id"];
export const DEFAULT_PAUSE: PauseId = "natural";

export const FORMATS = [
  { id: "mp3", label: "MP3", mime: "audio/mpeg" },
  { id: "wav", label: "WAV", mime: "audio/wav" },
] as const;

export type FormatId = (typeof FORMATS)[number]["id"];
export const DEFAULT_FORMAT: FormatId = "mp3";

export type PronunciationEntry = { written: string; guidance: string };

export const MAX_PRONUNCIATIONS = 30;
export const MAX_PRONUNCIATION_LENGTH = 100;
/** Whole-script limit. Longer scripts are split into sections automatically. */
export const MAX_TOTAL_CHARS = 50_000;

export type SynthesisSettings = {
  accent: AccentId;
  voiceId: string;
  style: StyleId;
  learnerMode: LearnerModeId;
  speed: SpeedValue;
  pitch: PitchId;
  pause: PauseId;
  pronunciations: PronunciationEntry[];
};

export const findAccent = (id: string) => ACCENTS.find((a) => a.id === id);
export const findStyle = (id: string) => STYLES.find((s) => s.id === id);
export const findLearnerMode = (id: string) => LEARNER_MODES.find((m) => m.id === id);
export const findSpeed = (v: number) => SPEEDS.find((s) => s.value === v);
export const findPitch = (id: string) => PITCHES.find((p) => p.id === id);
export const findPause = (id: string) => PAUSES.find((p) => p.id === id);

/**
 * Silence inserted where two generated sections meet. Conversational Warm is
 * slightly tighter; Beginner learner mode is slightly more relaxed.
 */
export function joinGapMs(
  pause: PauseId,
  style: StyleId,
  learnerMode: LearnerModeId,
  boundary: "sentence" | "paragraph",
): number {
  const p = findPause(pause) ?? PAUSES[1];
  let gap = boundary === "paragraph" ? p.paragraphGapMs : p.sentenceGapMs;
  if (style === "conversational-warm") gap *= 0.85;
  if (learnerMode === "beginner") gap *= 1.2;
  return Math.round(gap);
}
