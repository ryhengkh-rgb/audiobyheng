import { ACCENTS } from "@/lib/options";
import { PROVIDERS, getProvider } from "@/lib/server/providers";

// Tells the browser which voice engines are configured and what they support.
// Never includes credentials — only whether they are present.
export const dynamic = "force-dynamic";

export async function GET() {
  const active = getProvider();
  return Response.json({
    configured: Boolean(active),
    defaultProvider: active?.id ?? null,
    providers: PROVIDERS.filter((p) => p.isConfigured()).map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model(),
      maxSectionChars: p.maxSectionChars,
      sampleRate: p.sampleRate,
      accents: ACCENTS.map((a) => ({ id: a.id, label: a.label, available: p.accents.includes(a.id) })),
      voices: p.voices,
      // How each control is applied, so the UI can describe it honestly.
      support: {
        speechStyle: "direction",
        learnerMode: "direction",
        speed: "direction",
        pitch: "direction",
        pauses: "direction+joins",
        pronunciation: "direction",
      },
    })),
  });
}
