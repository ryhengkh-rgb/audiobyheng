# Khmer Voice Generator

A complete, modern web application that converts Khmer text into clear, natural-sounding Khmer speech. This tool allows you to easily generate, preview, and download Khmer audio files (MP3).

## Features
- **Khmer Support:** Specialized for the Khmer language with accurate pronunciation.
- **Dual-Engine Architecture:** Uses Google Cloud TTS (if configured) or the Google Translate TTS engine (as a robust fallback for missing standard Khmer support).
- **Long Text Chunking:** Automatically divides longer paragraphs and concatenates audio, circumventing common API limits.
- **Downloadable Audio:** Save your generated audio as an MP3 file directly to your computer.
- **Custom Controls:** Adjust speaking speed and pitch (where supported).

## Requirements
- Node.js (v18.17 or higher)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies
Open your terminal in the project directory and run:
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env.local
```

### 3. Google API Credentials (Optional but Recommended)
By default, the application will automatically fall back to a built-in TTS engine that supports Khmer if no API key is provided.

If you wish to use the official Google Cloud TTS API:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **Cloud Text-to-Speech API**.
3. Go to **Credentials**, create an API key, and copy it.
4. Open the `.env.local` file in your project folder.
5. Replace `your_google_api_key_here` with your actual API key:
   ```env
   GOOGLE_API_KEY=AIzaSyA...
   ```
*(Do not share or commit this key publicly.)*

### 4. Run the Application Locally
Start the development server:
```bash
npm run dev
```
Then, open [http://localhost:3000](http://localhost:3000) in your web browser.

## How to Test Khmer TTS
1. Open the application.
2. Paste the following sample text into the text area:
   > សួស្តីអ្នកទាំងអស់គ្នា។ សូមស្វាគមន៍មកកាន់កម្មវិធីបង្កើតសំឡេងភាសាខ្មែរ។ ថ្ងៃនេះយើងនឹងរៀនអំពីរបៀបប្រើបច្ចេកវិទ្យា AI ដើម្បីជួយបង្កើតមាតិកាថ្មីៗ។
3. Click the **Generate Audio** button.
4. After a few seconds, the audio player will appear and auto-play the generated speech.
5. Click **Download Audio** to save the `.mp3` file to your computer.

## How it Works
1. **Frontend:** Built with Next.js (React) and Tailwind CSS. Collects text and settings.
2. **Backend API (`/api/tts`):** Receives the request and talks to the TTS engines. It intelligently splits long text by sentences/paragraphs to adhere to API constraints, generating audio for each chunk in sequence.
3. **Combining Audio:** The binary audio chunks (MP3 format) are concatenated together on the backend server, ensuring no gap issues.
4. **Download:** Returns a unified binary stream that the frontend converts to an object URL, allowing for straightforward playback and download.

## Deployment
You can deploy this application easily on [Vercel](https://vercel.com/):
1. Push your code to a GitHub repository.
2. Import the project in Vercel.
3. Add the `GOOGLE_API_KEY` to the Environment Variables settings in Vercel.
4. Click **Deploy**.
