import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_AUDIO_SCRIPT_CHARS } from "@/lib/readingAudio";
import { AudioError, generateReadingAudio, getAudioConfig, verifyAudio } from "@/lib/deepgramAudio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const InputSchema = z.object({
  script: z.string().min(80).max(MAX_AUDIO_SCRIPT_CHARS),
  authorization: z.object({ expiresAt: z.number().int(), signature: z.string().regex(/^[a-f0-9]{64}$/) }),
});
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(req: Request) {
  try {
    // Bound the body before parsing; allow JSON-escaped Unicode for a full script.
    const reader = req.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Missing audio request." }, { status: 400 });
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 150_000) {
          await reader.cancel();
          return NextResponse.json({ error: "Audio request is too large." }, { status: 413 });
        }
        parts.push(value);
      }
    } finally { reader.releaseLock(); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(parts).toString("utf8")); }
    catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid audio request." }, { status: 400 });
    const config = getAudioConfig();
    if (!verifyAudio(parsed.data.script, parsed.data.authorization, config.apiKey)) {
      return NextResponse.json({ error: "This listening request has expired or is invalid. Cast a new reading to listen." },
        { status: 403, headers: privateHeaders });
    }
    const audio = await generateReadingAudio(parsed.data.script, config);
    return new Response(new Uint8Array(audio), { headers: {
      ...privateHeaders, "Content-Type": "audio/wav", "Content-Length": String(audio.length),
      "Content-Disposition": 'inline; filename="myAeon-reading.wav"',
    } });
  } catch (error) {
    const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    return NextResponse.json({ error: error instanceof AudioError ? error.message : timedOut
      ? "Audio generation took too long. Please try again." : "Could not generate reading audio. Please try again." },
    { status: error instanceof AudioError ? error.status : timedOut ? 504 : 502, headers: privateHeaders });
  }
}
