// Audio processing that runs in the browser: joins the generated sections into
// one recording, keeps loudness consistent, avoids clicks, and encodes the
// final file as WAV or MP3. All sections are 16-bit mono PCM at the same rate.

import { Mp3Encoder } from "@breezystack/lamejs";

export type PcmSegment = {
  samples: Float32Array;
  /** Silence to insert after this segment, in milliseconds. */
  gapAfterMs: number;
};

export function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

function float32ToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return out;
}

const dbToAmp = (db: number) => Math.pow(10, db / 20);

/** RMS of each 10 ms window. */
function windowRms(samples: Float32Array, sampleRate: number): { rms: Float32Array; size: number } {
  const size = Math.max(1, Math.round(sampleRate / 100));
  const n = Math.ceil(samples.length / size);
  const rms = new Float32Array(n);
  for (let w = 0; w < n; w++) {
    let sum = 0;
    const end = Math.min(samples.length, (w + 1) * size);
    for (let i = w * size; i < end; i++) sum += samples[i] * samples[i];
    rms[w] = Math.sqrt(sum / Math.max(1, end - w * size));
  }
  return { rms, size };
}

/**
 * Removes leading and trailing silence while keeping a small cushion so the
 * first and last sounds of each word are never clipped.
 */
export function trimSilence(samples: Float32Array, sampleRate: number, thresholdDb = -48, padMs = 60): Float32Array {
  const { rms, size } = windowRms(samples, sampleRate);
  const threshold = dbToAmp(thresholdDb);
  let first = -1;
  let last = -1;
  for (let w = 0; w < rms.length; w++) {
    if (rms[w] > threshold) {
      if (first < 0) first = w;
      last = w;
    }
  }
  if (first < 0) return new Float32Array(0);
  const pad = Math.round((padMs / 1000) * sampleRate);
  const start = Math.max(0, first * size - pad);
  const end = Math.min(samples.length, (last + 1) * size + pad);
  return samples.slice(start, end);
}

/** Loudness of the speech parts only (silence ignored). */
export function speechRms(samples: Float32Array, sampleRate: number): number {
  const { rms } = windowRms(samples, sampleRate);
  const threshold = dbToAmp(-40);
  let sum = 0;
  let count = 0;
  for (const r of rms) {
    if (r > threshold) {
      sum += r * r;
      count++;
    }
  }
  return count ? Math.sqrt(sum / count) : 0;
}

function applyFades(samples: Float32Array, sampleRate: number, ms = 8) {
  const n = Math.min(Math.round((ms / 1000) * sampleRate), Math.floor(samples.length / 2));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    samples[i] *= g;
    samples[samples.length - 1 - i] *= g;
  }
}

/**
 * Joins sections in order into one continuous recording:
 * trims each section's edge silence, gently matches loudness between
 * sections, fades the edges to avoid clicks, and inserts natural gaps.
 */
export function mergeSegments(segments: PcmSegment[], sampleRate: number): Float32Array {
  const trimmed = segments.map((s) => trimSilence(s.samples, sampleRate));
  const levels = trimmed.map((s) => speechRms(s, sampleRate)).filter((l) => l > 0);
  const target = levels.length ? [...levels].sort((a, b) => a - b)[Math.floor(levels.length / 2)] : 0;

  const leadIn = Math.round(0.15 * sampleRate);
  const tail = Math.round(0.3 * sampleRate);
  let total = leadIn + tail;
  trimmed.forEach((s, i) => {
    total += s.length;
    if (i < trimmed.length - 1) total += Math.round((segments[i].gapAfterMs / 1000) * sampleRate);
  });

  const out = new Float32Array(total);
  let offset = leadIn;
  trimmed.forEach((seg, i) => {
    const level = speechRms(seg, sampleRate);
    // Only small corrections (±4 dB) so the voice character is untouched.
    const gain = level > 0 && target > 0 ? Math.min(dbToAmp(4), Math.max(dbToAmp(-4), target / level)) : 1;
    const copy = seg.slice();
    for (let k = 0; k < copy.length; k++) copy[k] *= gain;
    applyFades(copy, sampleRate);
    out.set(copy, offset);
    offset += copy.length;
    if (i < trimmed.length - 1) offset += Math.round((segments[i].gapAfterMs / 1000) * sampleRate);
  });

  // Safety limiter: never clip.
  let peak = 0;
  for (let k = 0; k < out.length; k++) peak = Math.max(peak, Math.abs(out[k]));
  if (peak > 0.98) {
    const g = 0.98 / peak;
    for (let k = 0; k < out.length; k++) out[k] *= g;
  }
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const pcm = float32ToInt16(samples);
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.byteLength, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.byteLength, true);
  new Int16Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

/** MP3 encoding in small batches so the page stays responsive on long audio. */
export async function encodeMp3(
  samples: Float32Array,
  sampleRate: number,
  onProgress?: (fraction: number) => void,
  kbps = sampleRate > 24000 ? 128 : 96,
): Promise<Uint8Array<ArrayBuffer>> {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const pcm = float32ToInt16(samples);
  const frame = 1152;
  const batch = frame * 200;
  const parts: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += batch) {
    const end = Math.min(pcm.length, i + batch);
    for (let j = i; j < end; j += frame) {
      const chunk = encoder.encodeBuffer(pcm.subarray(j, Math.min(end, j + frame)));
      if (chunk.length) parts.push(chunk);
    }
    onProgress?.(end / pcm.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  const last = encoder.flush();
  if (last.length) parts.push(last);
  const size = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
