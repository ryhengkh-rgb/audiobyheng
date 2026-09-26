import { describe, expect, it } from "vitest";
import { encodeMp3, encodeWav, mergeSegments, pcm16ToFloat32, speechRms, trimSilence } from "@/lib/audio";
import { joinGapMs } from "@/lib/options";

const SR = 24000;
const tone = (seconds: number, amp: number, lead = 0.5, tail = 0.5) => {
  const n = Math.round((lead + seconds + tail) * SR);
  const s = new Float32Array(n);
  for (let i = Math.round(lead * SR); i < Math.round((lead + seconds) * SR); i++) s[i] = amp * Math.sin((2 * Math.PI * 220 * i) / SR);
  return s;
};

describe("audio pipeline", () => {
  it("decodes 16-bit little-endian PCM", () => {
    const bytes = new Uint8Array([0x00, 0x40, 0x00, 0xc0]);
    expect(Array.from(pcm16ToFloat32(bytes))).toEqual([0.5, -0.5]);
  });

  it("trims long silence but keeps a cushion around speech", () => {
    const t = trimSilence(tone(1, 0.3), SR);
    expect(t.length / SR).toBeGreaterThan(1.05);
    expect(t.length / SR).toBeLessThan(1.2);
  });

  it("merges sections in order with controlled gaps and matched loudness", () => {
    const merged = mergeSegments(
      [
        { samples: tone(1, 0.4), gapAfterMs: 500 },
        { samples: tone(1, 0.2), gapAfterMs: 0 },
      ],
      SR,
    );
    // 0.15 lead + ~1.1 + 0.5 gap + ~1.1 + 0.3 tail
    expect(merged.length / SR).toBeGreaterThan(3);
    expect(merged.length / SR).toBeLessThan(3.4);
    const half = Math.floor(merged.length / 2);
    const a = speechRms(merged.subarray(0, half), SR);
    const b = speechRms(merged.subarray(half), SR);
    // A 6 dB difference is reduced to at most ~ -2..+2 dB after matching.
    expect(Math.abs(20 * Math.log10(a / b))).toBeLessThan(2.5);
    expect(Math.max(...merged.map(Math.abs))).toBeLessThanOrEqual(0.98);
    // No click: first and last samples are faded to zero.
    expect(merged[0]).toBe(0);
    expect(merged[merged.length - 1]).toBe(0);
  });

  it("uses slightly longer gaps for paragraphs than sentences, tighter for Conversational Warm", () => {
    expect(joinGapMs("natural", "normal", "natural", "paragraph")).toBeGreaterThan(joinGapMs("natural", "normal", "natural", "sentence"));
    expect(joinGapMs("natural", "conversational-warm", "natural", "sentence")).toBeLessThan(joinGapMs("natural", "normal", "natural", "sentence"));
    expect(joinGapMs("natural", "normal", "beginner", "sentence")).toBeGreaterThan(joinGapMs("natural", "normal", "natural", "sentence"));
  });

  it("encodes a valid WAV file", () => {
    const wav = encodeWav(tone(0.5, 0.3), SR);
    const text = new TextDecoder().decode(wav.slice(0, 16));
    expect(text.startsWith("RIFF")).toBe(true);
    expect(text).toContain("WAVEfmt ");
    const v = new DataView(wav.buffer);
    expect(v.getUint32(24, true)).toBe(SR);
    expect(v.getUint32(40, true)).toBe(wav.length - 44);
  });

  it("encodes a valid MP3 file", async () => {
    let last = 0;
    const mp3 = await encodeMp3(tone(2, 0.3), SR, (f) => (last = f));
    expect(last).toBe(1);
    // MPEG audio frame sync.
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
    // ~96 kbps for 3 s ≈ 36 KB
    expect(mp3.length).toBeGreaterThan(20_000);
    expect(mp3.length).toBeLessThan(60_000);
  });
});
