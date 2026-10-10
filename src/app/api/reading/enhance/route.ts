import { NextResponse } from "next/server";
import { sameRequestOrigin } from "@/lib/serverRequest";
import { longitudeToSign } from "@/lib/zodiac";
import { generatedReading, requestReadingJson, signedReadingAudio } from "@/lib/readingGeneration";
import { privateHeaders, readPrivateJson, requestFailure } from "@/lib/readingRequest";
import {
  EnhancementInputSchema, ENHANCEMENT_SYSTEM_PROMPT, enhancementPrompt,
  normalizeBirthChart, requireNatalContext, validatePriorReading, enhancementReadingInput,
} from "@/lib/readingEnhancement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let cookie: string | null = null;
  if (!sameRequestOrigin(req)) return NextResponse.json({ error: "Request not allowed." }, { status: 403, headers: privateHeaders() });
  try {
    const input = EnhancementInputSchema.parse(await readPrivateJson(req, 100_000));
    const { astrology, contextMetadata } = await import("../../../../../server/astrology.mjs");
    const { requestIdentity } = await import("../../../../../server/astrology-quota.mjs");
    const user = requestIdentity(req); cookie = user.cookie;
    const context = astrology.resolveContext(user.id, input.contextId);
    const profile = context?.profileId ? astrology.resolveProfile(user.id, context.profileId) : null;
    requireNatalContext(context, profile, input.contextId);
    // requireNatalContext checks both nullable server-owned records before use.
    if (!context || !profile) throw new Error("Missing chart");
    validatePriorReading(input.reading, context, profile);
    const { json, config } = await requestReadingJson(ENHANCEMENT_SYSTEM_PROMPT, enhancementPrompt(context, input.reading, profile), req.signal);
    const sunSign = longitudeToSign(context.natal!.planets.find(point => point.name === "Sun")!.longitude);
    const birthChart = normalizeBirthChart(json?.birthChart, context);
    const generated = generatedReading(enhancementReadingInput(json, input.reading), sunSign, context);
    const response = {
      ...generated,
      birthChart,
      meta: {
        provider: "deepseek", model: config.model, endpoint: config.url, endpointMode: config.mode,
        generatedAt: new Date().toISOString(), readingDate: context.selectedDate,
        profileId: context.profileId, birthDate: profile.birthDate, birthTime: profile.birthTime,
        birthPlace: `${profile.location.city}, ${profile.location.nation}`, astrology: contextMetadata(context),
      },
    };
    const fullReading = { ...response, ...signedReadingAudio(json?.audioScript, response) };
    await astrology.saveInterpretation(user.id, context.id, fullReading);
    return NextResponse.json(fullReading, { headers: privateHeaders(cookie) });
  } catch (error) {
    const failure = requestFailure(error, "Your birth chart has expired or could not be interpreted. Prepare it again and retry.");
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers: privateHeaders(cookie) });
  }
}
