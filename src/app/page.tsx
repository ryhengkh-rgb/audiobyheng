"use client";

import { useState, useRef } from "react";
import { Download, Loader2, Volume2, Settings2 } from "lucide-react";

export default function Home() {
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Please enter some Khmer text.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Revoke previous URL to prevent memory leaks
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed, pitch }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate audio.");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We couldn't generate the Khmer audio. Please check your API configuration and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    
    // Generate filename based on date/time
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 15);
    a.download = `khmer-voice-${dateStr}.mp3`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl w-full space-y-8 bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-neutral-200">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-neutral-900 mb-3 tracking-tight">Khmer Voice Generator</h1>
          <p className="text-neutral-500 text-lg">Turn Khmer text into clear, natural speech.</p>
        </div>

        <div className="space-y-6">
          {/* Text Input */}
          <div className="space-y-3">
            <label htmlFor="text" className="block text-sm font-semibold text-neutral-700">
              Enter Khmer Text
            </label>
            <textarea
              id="text"
              rows={6}
              className="w-full rounded-2xl border-neutral-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-neutral-50/50 p-4 border text-neutral-900 text-lg transition-colors placeholder:text-neutral-400"
              placeholder="សួស្តី! សូមស្វាគមន៍មកកាន់កម្មវិធីបង្កើតសំឡេងភាសាខ្មែរ។"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="text-sm text-neutral-500 font-medium text-right px-1">
              Character count: {text.length}
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-neutral-500" />
                Speaking Speed
              </label>
              <select
                className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border bg-white text-neutral-900 font-medium"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={0.75}>Slow</option>
                <option value={1}>Normal</option>
                <option value={1.25}>Fast</option>
              </select>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-neutral-500" />
                Pitch
              </label>
              <select
                className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border bg-white text-neutral-900 font-medium"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
              >
                <option value={-2}>Lower</option>
                <option value={0}>Normal</option>
                <option value={2}>Higher</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-100 font-medium">
              {error}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={isLoading || !text.trim()}
              className="w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-2xl shadow-sm text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Generating Khmer audio...
                </>
              ) : (
                "Generate Audio"
              )}
            </button>
          </div>
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <div className="mt-8 pt-8 border-t border-neutral-100 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-semibold text-neutral-900">Your Audio</h3>
            
            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                className="w-full h-12"
                autoPlay
              />
            </div>

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 border border-neutral-300 rounded-2xl shadow-sm text-base font-semibold text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-colors"
            >
              <Download className="w-5 h-5" />
              Download Audio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
