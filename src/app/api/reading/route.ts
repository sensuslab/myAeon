import { NextResponse } from "next/server";
import { sameRequestOrigin } from "@/lib/serverRequest";
import { getSunSign, ZODIAC_SIGNS } from "@/lib/zodiac";
import {
  ReadingInputSchema, SYSTEM_PROMPT, buildUserPrompt, generatedReading,
  readingModelConfig, requestReadingJson, signedReadingAudio,
} from "@/lib/readingGeneration";
import { privateHeaders, readPrivateJson, requestFailure } from "@/lib/readingRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let cookie: string | null = null;
  try {
    const input = ReadingInputSchema.parse(await readPrivateJson(req, 10_000));
    if ((input.profileId || req.headers.has("origin")) && !sameRequestOrigin(req)) {
      return NextResponse.json({ error: "Request not allowed." }, { status: 403, headers: privateHeaders() });
    }
    const { astrology, contextMetadata } = await import("../../../../server/astrology.mjs");
    const { requestIdentity } = await import("../../../../server/astrology-quota.mjs");
    const { dateSchema, LONDON } = await import("../../../../server/astrology-input.mjs");
    dateSchema.parse(input.birthDate);
    let owner: string | null = null;
    // Anonymous sky readings also work without chart-session configuration.
    if (input.profileId || process.env.ASTROLOGY_SESSION_SECRET) {
      const user = requestIdentity(req); owner = user.id; cookie = user.cookie;
    }
    const profile = owner && input.profileId ? astrology.resolveProfile(owner, input.profileId) : null;
    if (input.profileId && (!profile || profile.birthDate !== input.birthDate
      || (input.birthTime && input.birthTime !== profile.birthTime))) {
      return NextResponse.json({ error: "Birth details changed. Confirm them again before casting." }, { status: 400, headers: privateHeaders(cookie) });
    }
    const selectedDate = input.readingDate || new Intl.DateTimeFormat("en-CA", {
      timeZone: LONDON.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    // Chart generation is an independent request, even when a profile is supplied.
    const context = await astrology.prepare(owner, undefined, selectedDate, true, req.signal);
    const sunSign = getSunSign(new Date(`${input.birthDate}T12:00:00Z`));
    const { json, config } = await requestReadingJson(SYSTEM_PROMPT, buildUserPrompt(input, sunSign.name, context), req.signal);
    const response = {
      ...generatedReading(json, sunSign, context),
      meta: {
        provider: "deepseek", model: config.model, endpoint: config.url, endpointMode: config.mode,
        generatedAt: new Date().toISOString(), readingDate: context.selectedDate,
        profileId: input.profileId, birthDate: profile?.birthDate ?? input.birthDate,
        birthTime: profile ? (profile.timeConfidence === "unknown" ? undefined : profile.birthTime) : input.birthTime,
        birthPlace: profile ? `${profile.location.city}, ${profile.location.nation}` : input.birthPlace,
        astrology: contextMetadata(context),
      },
    };
    return NextResponse.json({ ...response, ...signedReadingAudio(json?.audioScript, response) }, { headers: privateHeaders(cookie) });
  } catch (error) {
    const failure = requestFailure(error, "Check your birth details, confirmed profile and sky date, then try again.");
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers: privateHeaders(cookie) });
  }
}

export async function GET() {
  const config = readingModelConfig();
  return NextResponse.json({
    service: "aeon-reading", provider: "deepseek", model: config.model,
    apiBase: process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com",
    endpoint: config.url, endpointMode: config.mode, timeoutMs: config.timeoutMs,
    configured: config.configured, supportsReadingDate: true,
    signs: ZODIAC_SIGNS.map(sign => ({ id: sign.id, name: sign.name })),
  }, { headers: privateHeaders() });
}
