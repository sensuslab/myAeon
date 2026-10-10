import { NextResponse } from "next/server";
import { z } from "zod";
import { sameRequestOrigin } from "@/lib/serverRequest";
import { ContextIdSchema, privateHeaders, readPrivateJson, requestFailure } from "@/lib/readingRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InputSchema = z.object({ profileId: ContextIdSchema, readingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();

export async function POST(req: Request) {
  let cookie: string | null = null;
  if (!sameRequestOrigin(req)) return NextResponse.json({ error: "Request not allowed." }, { status: 403, headers: privateHeaders() });
  try {
    const input = InputSchema.parse(await readPrivateJson(req, 2_000));
    const { astrology } = await import("../../../../../server/astrology.mjs");
    const { requestIdentity } = await import("../../../../../server/astrology-quota.mjs");
    const user = requestIdentity(req); cookie = user.cookie;
    const context = await astrology.prepare(user.id, input.profileId, input.readingDate, true, req.signal);
    return NextResponse.json({ context: { ...context, usage: null } }, { headers: privateHeaders(cookie) });
  } catch (error) {
    const failure = requestFailure(error, "Your birth chart could not be prepared. Check your confirmed details and try again.");
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers: privateHeaders(cookie) });
  }
}
