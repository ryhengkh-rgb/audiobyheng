// Splits long English scripts into sections that fit a TTS request, breaking
// only at natural places: paragraphs first, then sentence endings, then
// clause punctuation, and only as a last resort between words.

export type Section = {
  text: string;
  /** What kind of break follows this section in the original script. */
  boundaryAfter: "sentence" | "paragraph" | "end";
};

// Words that are normally followed by a period but do not end a sentence.
const NON_TERMINAL_ABBREVIATIONS = new Set(
  [
    "mr", "mrs", "ms", "mx", "dr", "prof", "sr", "jr", "st", "mt", "ft", "rev", "hon", "gen", "col", "capt", "lt",
    "sgt", "gov", "sen", "rep", "pres", "vs", "e.g", "i.e", "cf", "approx", "dept", "est", "fig", "no", "nos", "vol",
    "pp", "p", "inc", "ltd", "co", "corp", "llc", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept",
    "oct", "nov", "dec", "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun", "ave", "blvd",
    "rd", "hwy", "u.s", "u.k", "u.n", "u.s.a", "ph.d", "b.a", "m.a", "b.sc", "m.sc",
  ],
);
// Abbreviations that can legitimately end a sentence ("... at 8 p.m. Then ...").
const MAYBE_TERMINAL_ABBREVIATIONS = new Set(["etc", "a.m", "p.m", "am", "pm"]);
// Titles that must stay attached to the name that follows.
const TITLES = new Set(["mr", "mrs", "ms", "mx", "dr", "prof", "sr", "jr", "st", "mt", "rev", "hon", "gen", "col", "capt", "lt", "sgt", "gov", "sen", "rep", "pres"]);

const CLOSERS = `"'”’)]}»`;

/** Splits a paragraph into sentences without breaking abbreviations, decimals, URLs or initials. */
export function splitSentences(paragraph: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  const s = paragraph;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\n") {
      const piece = s.slice(start, i).trim();
      if (piece) sentences.push(piece);
      start = i + 1;
      continue;
    }
    if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "…") continue;

    // Consume repeated terminators and closing quotes/brackets: `?!`, `..."`, `.)`
    let end = i + 1;
    while (end < s.length && (".!?…".includes(s[end]) || CLOSERS.includes(s[end]))) end++;
    // A boundary needs whitespace (or the end of the text) afterwards.
    if (end < s.length && !/\s/.test(s[end])) {
      i = end - 1;
      continue;
    }

    if (ch === "." && end === i + 1) {
      const before = s.slice(start, i);
      const token = (before.match(/(\S+)$/)?.[1] ?? "").replace(/^["'“‘(\[]+/, "").toLowerCase();
      const next = s.slice(end).match(/^\s*(\S)/)?.[1] ?? "";
      if (NON_TERMINAL_ABBREVIATIONS.has(token)) continue;
      // Single-letter initials such as "J. K. Rowling".
      if (/^[a-z]$/.test(token)) continue;
      if (MAYBE_TERMINAL_ABBREVIATIONS.has(token) && !/[A-Z"“]/.test(next)) continue;
      // A lowercase continuation usually means the period was not a sentence end.
      if (next && /[a-z]/.test(next)) continue;
    }

    const piece = s.slice(start, end).trim();
    if (piece) sentences.push(piece);
    start = end;
    i = end - 1;
  }
  const rest = s.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

/** Can a long sentence be broken just before `words[j]`? */
function isSafeWordBreak(prev: string, next: string): boolean {
  const p = prev.replace(/[,;:]$/, "");
  // Keep numbers with their units / following words ("25 kilograms", "8:30 AM").
  if (/\d$/.test(p) && !/[,;:]$/.test(prev)) return false;
  // Keep currency symbols with amounts.
  if (/^[$£€¥₹]$/.test(p)) return false;
  // Keep titles and initials with names ("Dr. Smith", "J. K. Rowling").
  const bare = p.replace(/\.$/, "").toLowerCase();
  if (p.endsWith(".") && (TITLES.has(bare) || /^[a-z]$/.test(bare))) return false;
  // Keep capitalised name sequences together ("Siem Reap", "New York").
  if (/^[A-Z][a-z'’-]+$/.test(p) && /^[A-Z][a-z'’-]+[,.;:!?]?$/.test(next)) return false;
  return true;
}

/** Splits an over-long sentence at clause punctuation, then at safe word breaks. */
function splitLongSentence(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence];

  // Prefer clause punctuation: ; then : then — then ,
  for (const re of [/;\s+/g, /:\s+/g, /\s+[—–]\s+|—/g, /,\s+/g]) {
    let best = -1;
    for (const m of sentence.matchAll(re)) {
      const cut = (m.index ?? 0) + m[0].length;
      if (cut <= max && cut > max * 0.3) best = cut;
    }
    if (best > 0) {
      const head = sentence.slice(0, best).trim();
      // Do not split "1,000" style numbers (no space after the comma, so the regex skips them).
      return [head, ...splitLongSentence(sentence.slice(best).trim(), max)];
    }
  }

  const words = sentence.split(/\s+/);
  let head = "";
  let lastSafe = -1;
  let len = 0;
  for (let j = 0; j < words.length; j++) {
    const add = (j ? 1 : 0) + words[j].length;
    if (len + add > max && j > 0) break;
    len += add;
    if (j + 1 < words.length && isSafeWordBreak(words[j], words[j + 1])) lastSafe = j;
  }
  // No safe break inside the limit: fall back to the last word boundary that fits.
  if (lastSafe < 0) {
    let l = 0;
    lastSafe = 0;
    for (let j = 0; j < words.length; j++) {
      l += (j ? 1 : 0) + words[j].length;
      if (l > max) break;
      lastSafe = j;
    }
  }
  head = words.slice(0, lastSafe + 1).join(" ");
  const tail = words.slice(lastSafe + 1).join(" ");
  return tail ? [head, ...splitLongSentence(tail, max)] : [head];
}

/**
 * Splits a script into ordered sections of at most `maxChars` characters.
 * Short paragraphs are packed together (keeping their paragraph breaks) so
 * the model sees natural context and there are as few joins as possible.
 */
export function splitIntoSections(text: string, maxChars: number): Section[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sections: Section[] = [];
  let current = "";

  const flush = (boundary: Section["boundaryAfter"]) => {
    if (current.trim()) sections.push({ text: current.trim(), boundaryAfter: boundary });
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (current && current.length + 2 + paragraph.length <= maxChars) {
      current += "\n\n" + paragraph;
      continue;
    }
    if (current) flush("paragraph");

    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }

    // Long paragraph: pack whole sentences.
    const pieces = splitSentences(paragraph).flatMap((sentence) => splitLongSentence(sentence, maxChars));
    for (const piece of pieces) {
      // Single newlines inside a paragraph (dialogue lines) are kept as spaces here.
      if (current && current.length + 1 + piece.length > maxChars) flush("sentence");
      current = current ? current + " " + piece : piece;
    }
    flush("paragraph");
  }
  flush("paragraph");

  if (sections.length) sections[sections.length - 1].boundaryAfter = "end";
  return sections;
}
