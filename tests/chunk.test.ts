import { describe, expect, it } from "vitest";
import { splitIntoSections, splitSentences } from "@/lib/chunk";

describe("splitSentences", () => {
  it("does not split abbreviations, titles, decimals, initials or URLs", () => {
    const s = splitSentences(
      "Dr. Smith met Mr. J. K. Rowling at 8:30 a.m. near the U.S. embassy. The price rose 3.5% to $25.99! Visit www.example.com today? Yes.",
    );
    expect(s).toEqual([
      "Dr. Smith met Mr. J. K. Rowling at 8:30 a.m. near the U.S. embassy.",
      "The price rose 3.5% to $25.99!",
      "Visit www.example.com today?",
      "Yes.",
    ]);
  });

  it("keeps closing quotes with their sentence and splits dialogue lines", () => {
    expect(splitSentences('She asked, "Are you ready?" He said yes.\nQ: Why?\nA: Because.')).toEqual([
      'She asked, "Are you ready?"',
      "He said yes.",
      "Q: Why?",
      "A: Because.",
    ]);
  });
});

describe("splitIntoSections", () => {
  it("returns one section for short text", () => {
    expect(splitIntoSections("Hello there. How are you?", 1500)).toEqual([{ text: "Hello there. How are you?", boundaryAfter: "end" }]);
  });

  it("returns nothing for blank text", () => {
    expect(splitIntoSections("  \n\n ", 1500)).toEqual([]);
  });

  it("packs paragraphs and splits at paragraph boundaries, preserving order and all text", () => {
    const paras = Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}. ` + "This is a sentence about learning English. ".repeat(6).trim());
    const text = paras.join("\n\n");
    const sections = splitIntoSections(text, 800);
    expect(sections.length).toBeGreaterThan(1);
    for (const s of sections) expect(s.text.length).toBeLessThanOrEqual(800);
    expect(sections.slice(0, -1).every((s) => s.boundaryAfter === "paragraph")).toBe(true);
    expect(sections.at(-1)!.boundaryAfter).toBe("end");
    const norm = (t: string) => t.replace(/\s+/g, " ").trim();
    expect(norm(sections.map((s) => s.text).join(" "))).toBe(norm(text));
  });

  it("splits a long paragraph at sentence endings without breaking words", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i + 1} costs $25 and ends here.`).join(" ");
    const sections = splitIntoSections(text, 500);
    for (const s of sections) {
      expect(s.text.length).toBeLessThanOrEqual(500);
      expect(s.text).toMatch(/\.$/);
      expect(s.text).toMatch(/^Sentence number \d+/);
    }
    expect(sections.map((s) => s.text).join(" ")).toBe(text);
  });

  it("splits an over-long sentence at commas, never between a number and its unit or inside a name", () => {
    const sentence =
      "We travelled from Siem Reap to New York, " +
      Array.from({ length: 40 }, (_, i) => `carrying ${i + 5} kilograms of books`).join(", ") +
      " and then we rested.";
    const sections = splitIntoSections(sentence, 300);
    expect(sections.length).toBeGreaterThan(1);
    for (const s of sections) {
      expect(s.text.length).toBeLessThanOrEqual(300);
      expect(s.text).not.toMatch(/\d$/);
      expect(s.text).not.toMatch(/^kilograms/);
    }
    expect(sections[0].text).toContain("Siem Reap");
    expect(sections.map((s) => s.text).join(" ")).toBe(sentence);
  });

  it("falls back to safe word breaks when there is no punctuation", () => {
    const text = Array.from({ length: 200 }, (_, i) => (i % 10 === 0 ? `Dr. Lee ${i} km` : "word")).join(" ");
    const sections = splitIntoSections(text, 250);
    for (const s of sections) {
      expect(s.text.length).toBeLessThanOrEqual(250);
      expect(s.text).not.toMatch(/(\d|Dr\.)$/);
    }
    expect(sections.map((s) => s.text).join(" ")).toBe(text);
  });
});
