import { NextResponse } from 'next/server';
import * as googleTTS from 'google-tts-api';

export async function POST(req: Request) {
  try {
    const { text, speed = 1, pitch = 0 } = await req.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

    // 1. Attempt with official Google Cloud TTS API if a key is provided
    if (GOOGLE_API_KEY && GOOGLE_API_KEY !== 'your_google_api_key_here') {
      try {
        const synthesizeRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: 'km-KH' }, // Let it pick the default if it exists
            audioConfig: { 
              audioEncoding: 'MP3',
              speakingRate: speed,
              pitch: pitch
            }
          })
        });

        if (synthesizeRes.ok) {
           const data = await synthesizeRes.json();
           if (data.audioContent) {
              const buffer = Buffer.from(data.audioContent, 'base64');
              return new NextResponse(buffer, {
                headers: {
                  'Content-Type': 'audio/mpeg',
                }
              });
           }
        } else {
           console.warn("Google Cloud TTS failed, falling back to translate TTS engine:", await synthesizeRes.text());
        }
      } catch (err) {
         console.error("Google Cloud TTS Error:", err);
      }
    }

    // 2. Fallback to Google Translate TTS Engine (google-tts-api)
    const isSlow = speed < 1;
    
    // googleTTS.getAllAudioBase64 returns an array of { shortText, base64 }
    const audioChunks = await googleTTS.getAllAudioBase64(text, {
      lang: 'km',
      slow: isSlow,
      host: 'https://translate.google.com',
      splitPunct: ',.!?។៕៖', // Add Khmer punctuation marks
    });

    // Decode all chunks from base64 into Buffers
    const buffers = audioChunks.map(chunk => Buffer.from(chunk.base64, 'base64'));
    
    // Combine them into a single audio file
    const combinedBuffer = Buffer.concat(buffers);

    return new NextResponse(combinedBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      }
    });

  } catch (error: unknown) {
    console.error("TTS Generation Error:", error);
    return NextResponse.json(
      { error: "We couldn't generate the Khmer audio. Please check your API configuration and try again." },
      { status: 500 }
    );
  }
}
