# English Speaking Voice Generator

Turn English text into clear, natural, and engaging speech. Paste a script, choose an accent, a voice and a speech style, click **Generate Audio**, listen to the result, and download it as MP3 or WAV.

**English Text → Select Accent → Select Voice → Generate → Preview → Download**

## Features

- **Five English accents:** American (`en-US`, default), British (`en-GB`), Australian (`en-AU`), Canadian (`en-CA`) and Indian (`en-IN`).
- **Eight voices per engine** (4 female, 4 male), labelled "English Female 1 — Sulafat" and so on, with the provider's official voice name after the dash.
- **Eleven speech styles.** The default, **Conversational Warm**, always sends this exact direction to the model: *"Normal, slightly overlapping pacing. Tone is energetic, conversational, and warm."* The other styles are Normal, Calm, Energetic, Professional, Educational, Podcast, Storytelling, Motivational, Friendly Teacher and Documentary.
- **English-Learner Mode** (Off, Beginner, Intermediate, Natural Fluency). It changes only how the text is spoken, never the text itself.
- **Speaking speed** (0.75x–1.25x), **pitch** (Lower/Normal/Higher) and **pause length** (Tight/Natural/Relaxed).
- **Pronunciation Help.** Tell the voice how to say names, places, brands or acronyms (for example, *Siem Reap → See-em Ree-ap*). Your visible text is never changed.
- **Long scripts up to 50,000 characters.** They are split automatically at paragraph and sentence boundaries, generated section by section with the same voice and direction, and joined into one seamless file. The page shows progress ("Section 3 of 8").
- **Audio player** with play/pause, seek, time and duration, volume, restart and playback speed. Nothing plays until you press Play.
- **Download** as `english-voice-YYYYMMDD-HHMMSS.mp3` (default) or `.wav`.

## Voice engines (you need one API key)

Both supported engines are AI voice models that take natural-language voice directions. That is what makes the conversational, warm delivery possible.

| | Google Gemini TTS (recommended) | OpenAI TTS |
|---|---|---|
| Server variable | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | `OPENAI_API_KEY` |
| Default model | `gemini-2.5-flash-preview-tts` | `gpt-4o-mini-tts` |
| Get a key | https://aistudio.google.com/apikey | https://platform.openai.com/api-keys |

Some notes on how the settings are applied:

- **Accent, style, learner mode, speed, pitch, pauses and pronunciation help** are sent to the model as a written voice direction. The voices are multilingual, so every voice can speak every accent. The model follows these directions well, but speed and pitch are approximate rather than exact percentages. The app says this in the interface too.
- **Pauses where long-script sections are joined** are set precisely by the app. Paragraph breaks get a longer pause than sentence breaks, and Conversational Warm uses slightly tighter pauses.
- **Numbers, dates, times, prices and abbreviations** are read by the model using context, for example "$25" as "twenty-five dollars" and "2026" as "twenty twenty-six". The app does not rewrite your text.

If both keys are set, a **Voice Engine** selector appears so you can compare them. `TTS_PROVIDER` chooses which one is the default.

## Setup

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then paste your API key into .env.local
npm run dev
```

Open http://localhost:3000. If no key is set, the app shows a clear "No voice service is set up yet" message instead of failing.

### Deploying to Vercel

1. Import the repository in Vercel.
2. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` or `OPENAI_API_KEY`.
3. Deploy.

Each request generates only one section (at most 1,500–2,000 characters), so long scripts stay within serverless time limits.

## How it works

1. **Browser (`src/components/Generator.tsx`, `src/lib/generate.ts`).** The browser collects the text and settings and splits long text into sections (`src/lib/chunk.ts`). It never splits inside a word, an abbreviation (Dr., U.S., a.m.), a name, or between a number and its unit. It then requests each section in order and shows progress, retrying automatically if the service is briefly busy.
2. **Server (`src/app/api/tts/route.ts`).** The API route validates the request, builds the voice direction (`src/lib/direction.ts`) and calls the TTS provider (`src/lib/server/providers.ts`) using the secret key. Provider errors become friendly messages; keys, raw provider responses and server paths are never sent to the browser.
3. **Audio (`src/lib/audio.ts`).** The sections come back as 24 kHz PCM. The browser trims edge silence (keeping a cushion so no word is clipped), gently matches loudness between sections, fades the joins to avoid clicks, and inserts natural pauses. It then encodes one final MP3 (96 kbps, via lamejs) or WAV file. Doing this in the browser means no FFmpeg is needed on the server, and changing the format re-encodes without generating again.

## Tests

```bash
npm test        # unit tests: text splitting, voice direction, merging, WAV/MP3 encoding
npm run lint
npm run build
```
