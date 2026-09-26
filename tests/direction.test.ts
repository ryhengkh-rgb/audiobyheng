import { describe, expect, it } from "vitest";
import { buildCombinedPrompt, buildDirection } from "@/lib/direction";
import { CONVERSATIONAL_WARM_DIRECTION, type SynthesisSettings } from "@/lib/options";

const base: SynthesisSettings = {
  accent: "en-GB",
  voiceId: "Kore",
  style: "conversational-warm",
  learnerMode: "natural",
  speed: 1,
  pitch: "normal",
  pause: "natural",
  pronunciations: [{ written: "Siem Reap", guidance: "See-em Ree-ap" }],
};

describe("voice direction", () => {
  it("always includes the exact Conversational Warm direction, accent and pronunciation guidance", () => {
    const d = buildDirection(base);
    expect(d).toContain(CONVERSATIONAL_WARM_DIRECTION);
    expect(d).toContain("British English");
    expect(d).toContain('"Siem Reap" is pronounced "See-em Ree-ap"');
  });

  it("keeps the transcript exactly as written and at the end of the prompt", () => {
    const text = "Welcome to Siem Reap!\n\nIt costs $25 at 8:30 AM.";
    const prompt = buildCombinedPrompt(text, base, { index: 1, total: 3 });
    expect(prompt.endsWith("### TRANSCRIPT\n" + text)).toBe(true);
    expect(prompt).toContain("part 2 of 3");
  });

  it("uses identical direction for every section except the part number", () => {
    const a = buildDirection(base, { index: 0, total: 5 }).replace(/part \d+ of/, "");
    const b = buildDirection(base, { index: 4, total: 5 }).replace(/part \d+ of/, "");
    expect(a).toBe(b);
  });
});
