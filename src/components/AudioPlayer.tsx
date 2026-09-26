"use client";

import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const RATES = [0.75, 0.9, 1, 1.1, 1.25, 1.5];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Audio player with play/pause, seek, time, volume, restart and playback speed. Never autoplays. */
export default function AudioPlayer({ src, knownDuration }: { src: string; knownDuration: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(knownDuration);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);

  // Keep user preferences (volume, speed) when a new file is loaded.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
    a.playbackRate = rate;
  }, [src, volume, muted, rate]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try {
        await a.play();
      } catch {
        /* The browser blocked playback; the button stays in the "play" state. */
      }
    } else a.pause();
  };

  const restart = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    setCurrent(0);
  };

  const shownDuration = Number.isFinite(duration) && duration > 0 ? duration : knownDuration;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setCurrent(0);
          setPlaying(false);
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            aria-label="Seek"
            min={0}
            max={shownDuration || 0}
            step={0.1}
            value={Math.min(current, shownDuration || 0)}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = t;
              setCurrent(t);
            }}
            className="w-full accent-indigo-600"
          />
          <div className="mt-1 flex justify-between text-xs font-medium tabular-nums text-slate-500">
            <span aria-label="Current time">{formatTime(current)}</span>
            <span aria-label="Duration">{formatTime(shownDuration)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-700">
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <RotateCcw className="h-4 w-4" /> Restart
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            className="rounded-lg p-1 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setMuted(false);
            }}
            className="w-24 accent-indigo-600"
          />
        </div>

        <label className="flex items-center gap-2">
          <span className="font-medium">Playback speed</span>
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-500">Playback speed only affects listening here. It does not change the downloaded file.</p>
    </div>
  );
}
