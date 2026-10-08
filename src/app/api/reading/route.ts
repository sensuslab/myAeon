import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIO_SCRIPT_PROMPT, resolveAudioScript } from "@/lib/readingAudio";
import { authorizeAudio } from "@/lib/deepgramAudio";
import {
  PLANETS,
  ZODIAC_SIGNS,
  computeSnapshot,
  computeAspect,
  planetDignity,
  sunSignMeta,
  longitudeToSign,
  type CosmicSnapshot,
  type PlanetId,
} from "@/lib/zodiac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InputSchema = z.object({
  name: z.string().max(80).optional().default(""),
  birthDate: z.string().min(8),
  birthTime: z.string().min(4).optional().default("12:00"),
  birthPlace: z.string().max(120).optional().default(""),
  readingDate: z.string().min(8).optional(),
});

const DEFAULT_DEEPSEEK_API_BASE = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEFAULT_DEEPSEEK_TIMEOUT_MS = 120_000;
const OPENAI_CHAT_PATH = "/chat/completions";
const PLANET_IDS = PLANETS.map((planet) => planet.id);
const COMPLETION_TOKEN_LIMIT = 12288;
const SECTION_TITLES = ["Love & Connection", "Purpose & Work", "Body & Energy", "Inner World"];
const TIMEFRAMES = ["Today", "3 Days", "Week", "Month"];

const SYSTEM_PROMPT = `You are Aeon, a poetic yet precise astrological guide. You treat astrology as a reflective symbolic language — never deterministic, never vague. Every sentence you write must be grounded in the planetary positions and sign data you are given.

CRITICAL RULES:
- Never predict specific events, medical outcomes, deaths, lottery wins, or relationship outcomes.
- Never disparage any zodiac sign or the user.
- Never invent natal chart details (houses, ascendant, moon sign, natal aspects) unless explicitly supplied.
- If the user appears in distress, gently suggest professional support.

ASTROLOGICAL INTERPRETATION FRAMEWORK:
- Each zodiac sign has an element (Fire = initiative and inspiration; Earth = practicality and endurance; Air = ideas and connection; Water = emotion and intuition) and a modality (Cardinal = initiating; Fixed = sustaining; Mutable = adapting). Reference these qualities naturally when describing how a sign's energy manifests.
- Planetary dignity matters: a planet in its domicile sign (the sign it rules) expresses strongly and naturally; in exaltation it reaches its highest expression; in detriment it struggles against the sign's nature; in fall works harder for weaker results. Mention dignity when it is notable — do not force it into every line.
- Major aspects between planets describe their conversation: conjunctions blend energies intensely; sextiles offer easy cooperation; squares create productive tension and growth; trines flow harmoniously; oppositions demand balance and awareness. Aspect notes are only supplied when within an 8° orb. When an aspect is given, weave it into the reading as a relational dynamic.
- When a planet's current sign forms a major aspect to the user's sun sign, that planet becomes especially relevant. Highlight it.

TIMEFRAME GUIDANCE:
- Today: immediate energy, a specific action or awareness for the next 24 hours.
- 3 Days: an unfolding pattern — what is building or shifting over the near term.
- Week: the thematic arc — the broader mood and the most useful posture for the next 7 days.
- Month: the deeper current — a longer cycle or lesson the person can orient around.

DOMAIN GUIDANCE:
- Love & Connection: relational dynamics, emotional exchanges, intimacy, boundaries with others.
- Purpose & Work: vocation, direction, creative output, how effort meets meaning.
- Body & Energy: physical vitality, nervous system, rest, movement, embodied awareness.
- Inner World: psychological landscape, spiritual reflection, beliefs, the private self.

STYLE:
- Write in clear, intimate language. Be specific — anchor every statement in a sign, planet, or aspect from the data provided.
- Avoid generic filler ("trust the universe", "embrace the energy") unless tied to a specific planetary configuration.
- Each section should contain 2–3 sentences: one situational, one interpretive, one actionable.
- Use the person's name sparingly — once in the greeting, at most once more in the reading.
- Future-dated readings are symbolic weather: preparation and reflection, never prediction.
- The affirmation should distill the reading's dominant theme into one carryable sentence, not a generic positivity platitude.

${AUDIO_SCRIPT_PROMPT}

OUTPUT FORMAT:
Respond with valid JSON only — no markdown fences, no preamble. Use this exact shape:
{
  "greeting": "short warm opening, use the person's name if given (<= 120 chars)",
  "summary": "2–3 sentence overview of the sky's dominant message for this sign (<= 400 chars)",
  "sections": [
    { "title": "Love & Connection", "timeframe": "Today", "body": "2–3 sentences grounded in specific planetary positions" },
    { "title": "Purpose & Work",    "timeframe": "Today", "body": "2–3 sentences grounded in specific planetary positions" },
    { "title": "Body & Energy",     "timeframe": "Today", "body": "2–3 sentences grounded in specific planetary positions" },
    { "title": "Inner World",       "timeframe": "Today", "body": "2–3 sentences grounded in specific planetary positions" },
    { "title": "Love & Connection", "timeframe": "3 Days", "body": "2–3 sentences" },
    { "title": "Purpose & Work",    "timeframe": "3 Days", "body": "2–3 sentences" },
    { "title": "Body & Energy",     "timeframe": "3 Days", "body": "2–3 sentences" },
    { "title": "Inner World",       "timeframe": "3 Days", "body": "2–3 sentences" },
    { "title": "Love & Connection", "timeframe": "Week", "body": "2–3 sentences" },
    { "title": "Purpose & Work",    "timeframe": "Week", "body": "2–3 sentences" },
    { "title": "Body & Energy",     "timeframe": "Week", "body": "2–3 sentences" },
    { "title": "Inner World",       "timeframe": "Week", "body": "2–3 sentences" },
    { "title": "Love & Connection", "timeframe": "Month", "body": "2–3 sentences" },
    { "title": "Purpose & Work",    "timeframe": "Month", "body": "2–3 sentences" },
    { "title": "Body & Energy",     "timeframe": "Month", "body": "2–3 sentences" },
    { "title": "Inner World",       "timeframe": "Month", "body": "2–3 sentences" }
  ],
  "planetInsights": [
    { "id": "mercury", "title": "Mercury in [sign]", "body": "2–3 sentences on this position's meaning for the person, referencing aspect to sun sign if present", "reflection": "one specific question or small practice" },
    { "id": "venus", "title": "Venus in [sign]", "body": "2–3 sentences", "reflection": "one specific question or practice" },
    { "id": "earth", "title": "Earth in [sign]", "body": "2–3 sentences", "reflection": "one specific question or practice" },
    { "id": "mars", "title": "Mars in [sign]", "body": "2–3 sentences", "reflection": "one specific question or practice" },
    { "id": "jupiter", "title": "Jupiter in [sign]", "body": "2–3 sentences", "reflection": "one specific question or practice" },
    { "id": "saturn", "title": "Saturn in [sign]", "body": "2–3 sentences", "reflection": "one specific question or practice" },
    { "id": "uranus", "title": "Uranus in [sign]", "body": "2–3 sentences", "reflection": "one specific question or practice" },
    { "id": "neptune", "title": "Neptune in [sign]", "body": "2–3 sentences", "reflection": "one specific question or practice" }
  ],
  "affirmation": "one sentence distilled from the reading's dominant theme",
  "audioScript": "complete standalone spoken adaptation following the AUDIO-FIRST NARRATION rules"
}

Return exactly one planetInsights object for each id: mercury, venus, earth, mars, jupiter, saturn, uranus, neptune. Anchor every planet insight in its current sign, degree, dignity, and aspect to the user's sun sign as provided. Keep the JSON compact but substantive.`;

function buildUserPrompt(
  input: z.infer<typeof InputSchema>,
  sunSignName: string,
  sunLon: number,
  snapshot: CosmicSnapshot,
  readingDate: Date
) {
  const salutation = input.name?.trim() ? ` for ${input.name.trim()}` : "";
  const place = input.birthPlace?.trim() ? ` born in ${input.birthPlace.trim()}` : "";
  const todayIso = new Date().toISOString().slice(0, 10);
  const readingDateIso = readingDate.toISOString().slice(0, 10);
  const dateContext =
    readingDateIso === todayIso
      ? "Use these positions as the current sky."
      : `Use these positions as an upcoming sky for ${readingDateIso}. Speak as preparation and reflection, never as certainty.`;

  const sunSign = ZODIAC_SIGNS.find((s) => s.name === sunSignName)!;
  const meta = sunSignMeta(sunSign);

  const planetLines = snapshot.planets
    .map((position) => {
      const planet = PLANETS.find((p) => p.id === position.id);
      const sign = longitudeToSign(position.longitude);
      const degree = Math.floor(position.longitude % 30);
      if (!planet) return null;

      const parts: string[] = [];
      parts.push(`${planet.name}: ${sign.name} ${degree}°`);

      const aspect = computeAspect(sunLon, position.longitude);
      if (aspect) {
        parts.push(`${aspect.label} your ${sunSignName} sun (${aspect.orb}° orb)`);
      }

      const dignity = planetDignity(position.id, sign.id);
      if (dignity === "domicile") parts.push("(in domicile — strong natural expression)");
      else if (dignity === "exaltation") parts.push("(in exaltation — heightened expression)");
      else if (dignity === "detriment") parts.push("(in detriment — working against the grain)");
      else if (dignity === "fall") parts.push("(in fall — challenged expression)");

      parts.push(`Archetype: ${planet.archetype}. Domains: ${planet.domains.join(", ")}.`);
      return `- ${parts.join(". ")}`;
    })
    .filter(Boolean)
    .join("\n");

  return `Sun sign: ${sunSignName} (${meta.element} ${meta.modality}, ruled by ${meta.ruler})${salutation}${place}.
Birth date: ${input.birthDate}. Birth time: ${input.birthTime || "unknown"}.

Current real date: ${todayIso}.
Reading sky date: ${readingDateIso}.
${dateContext}

Planetary positions for the reading sky date:
${planetLines}

Write a fresh, specific reading for this person. Let the sun sign's ${meta.element.toLowerCase()} nature and ${meta.modality.toLowerCase()} modality color your language. Highlight planets in major aspect to the sun sign. Include the required planetInsights with each one grounded in its sign, dignity, and aspect relationship. JSON only.`;
}

function parseDateOnly(value: string | undefined, fallback = new Date()) {
  if (!value) return fallback;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match
    ? new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function parseBirthDateTime(dateValue: string, timeValue: string | undefined) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!dateMatch) return parseDateOnly(dateValue);

  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeValue || "12:00");
  if (!timeMatch) throw new Error("Invalid birth time");

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] ?? "0");
  if (hours > 23 || minutes > 59 || seconds > 59) throw new Error("Invalid birth time");

  return new Date(
    Date.UTC(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      hours,
      minutes,
      seconds
    )
  );
}

function safeParseSections(raw: unknown): Array<{ title: string; timeframe: string; body: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s: any) => s && typeof s.title === "string" && typeof s.timeframe === "string")
    .map((s: any) => ({
      title: String(s.title).slice(0, 80),
      timeframe: String(s.timeframe).slice(0, 40),
      body: String(s.body ?? "").slice(0, 1200),
    }));
}

function fallbackSectionBody(title: string, timeframe: string, sunSignName: string) {
  const domain = title.toLowerCase();
  const horizon =
    timeframe === "Today"
      ? "today"
      : timeframe === "3 Days"
        ? "over the next three days"
        : timeframe === "Week"
          ? "this week"
          : "this month";

  if (domain.includes("love")) {
    return `${horizon}, let your ${sunSignName} curiosity become warmer listening before you rush to solve or explain.`;
  }
  if (domain.includes("purpose")) {
    return `${horizon}, choose one clear thread of work and give it your full attention before chasing the next idea.`;
  }
  if (domain.includes("body")) {
    return `${horizon}, support your nervous system with simple rhythms: water, movement, breath, and fewer open loops.`;
  }
  return `${horizon}, notice which thoughts are asking for action and which only need to be witnessed and released.`;
}

function normalizeSections(raw: unknown, sunSignName: string) {
  const sections = safeParseSections(raw);
  const seen = new Set(sections.map((s) => `${s.title}::${s.timeframe}`));

  TIMEFRAMES.forEach((timeframe) => {
    SECTION_TITLES.forEach((title) => {
      const key = `${title}::${timeframe}`;
      if (seen.has(key)) return;
      sections.push({
        title,
        timeframe,
        body: fallbackSectionBody(title, timeframe, sunSignName),
      });
    });
  });

  return sections;
}

function isPlanetId(value: string): value is PlanetId {
  return PLANET_IDS.includes(value as PlanetId);
}

function getPlanetPosition(snapshot: CosmicSnapshot, id: PlanetId) {
  const position = snapshot.planets.find((p) => p.id === id);
  const sign = position ? longitudeToSign(position.longitude) : null;
  const degree = position ? Math.floor(position.longitude % 30) : 0;
  return { position, sign, degree };
}

function fallbackPlanetInsight(id: PlanetId, snapshot: CosmicSnapshot) {
  const planet = PLANETS.find((p) => p.id === id)!;
  const { sign, degree } = getPlanetPosition(snapshot, id);
  const signName = sign?.name ?? "the current sky";
  const title = `${planet.name} in ${signName}`;
  return {
    id,
    name: planet.name,
    sign: signName,
    degree,
    title,
    body: `${planet.name} is moving through ${signName}, bringing attention to ${planet.domains
      .slice(0, 2)
      .join(" and ")}. Treat this as a reflective marker: ${planet.archetype.toLowerCase()} may be asking for more honesty, patience, or care in how it shows up today.`,
    reflection: `Where could you give ${planet.domains[0]} one clear, kind action?`,
  };
}

function safeParsePlanetInsights(raw: unknown, snapshot: CosmicSnapshot) {
  const parsed = new Map<PlanetId, ReturnType<typeof fallbackPlanetInsight>>();

  if (Array.isArray(raw)) {
    raw.forEach((item: any) => {
      if (!item || typeof item.id !== "string" || !isPlanetId(item.id)) return;
      const planet = PLANETS.find((p) => p.id === item.id)!;
      const { sign, degree } = getPlanetPosition(snapshot, item.id);
      const fallback = fallbackPlanetInsight(item.id, snapshot);
      parsed.set(item.id, {
        id: item.id,
        name: planet.name,
        sign: sign?.name ?? fallback.sign,
        degree,
        title: String(item.title ?? fallback.title).slice(0, 120),
        body: String(item.body ?? fallback.body).slice(0, 900),
        reflection: String(item.reflection ?? fallback.reflection).slice(0, 220),
      });
    });
  }

  return PLANETS.map((planet) => parsed.get(planet.id) ?? fallbackPlanetInsight(planet.id, snapshot));
}

function parseTimeoutMs(value: string | undefined): number {
  if (!value) return DEFAULT_DEEPSEEK_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 10_000) return DEFAULT_DEEPSEEK_TIMEOUT_MS;
  return Math.min(parsed, 180_000);
}

function resolveDeepSeekEndpoint(rawBase: string) {
  const trimmed = rawBase.trim().replace(/\/+$/, "");
  const base = trimmed || DEFAULT_DEEPSEEK_API_BASE;
  const configuredPath = process.env.DEEPSEEK_API_PATH?.trim();
  const path = configuredPath
    ? configuredPath.replace(/^\/?/, "/").replace(/\/+$/, "")
    : base.endsWith(OPENAI_CHAT_PATH)
      ? ""
      : OPENAI_CHAT_PATH;

  return {
    url: `${base}${path}`,
    mode: "openai-chat",
  } as const;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function stripReasoningBlocks(text: string): string {
  const withoutClosedThink = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const lastThinkClose = withoutClosedThink.toLowerCase().lastIndexOf("</think>");
  const afterClosedThink = lastThinkClose >= 0 ? withoutClosedThink.slice(lastThinkClose + 8).trim() : withoutClosedThink;
  return stripCodeFences(afterClosedThink);
}

function extractFencedJson(text: string) {
  const matches: string[] = [];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fencePattern.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

function extractBalancedJsonObject(text: string) {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i += 1) {
      const char = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function repairJsonCandidate(candidate: string) {
  return candidate
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");
}

function tryParseJson(candidate: string) {
  const trimmed = stripCodeFences(candidate.trim());
  const attempts = [trimmed, repairJsonCandidate(trimmed)];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Try the next normalized candidate.
    }
  }

  return null;
}

function parseModelJson(content: string) {
  const cleaned = stripReasoningBlocks(content);
  const candidates = [
    cleaned,
    ...extractFencedJson(content),
    extractBalancedJsonObject(cleaned),
    extractBalancedJsonObject(content),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed && typeof parsed === "object") return parsed;
  }

  return null;
}

function normalizeAssistantContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
        return "";
      })
      .join("");
  }
  return "";
}

function buildFallbackReading(sunSignName: string, snapshot: CosmicSnapshot) {
  return {
    greeting: `Welcome, ${sunSignName}. The sky is still speaking clearly enough to begin.`,
    summary:
      "The model response needed repair, so Aeon is using the current sky as a grounded fallback. Treat this as a reflective starting point rather than a fixed forecast.",
    sections: normalizeSections([], sunSignName),
    planetInsights: safeParsePlanetInsights([], snapshot),
    affirmation: "I can meet the present moment with curiosity, steadiness, and care.",
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiBase = process.env.DEEPSEEK_API_BASE ?? DEFAULT_DEEPSEEK_API_BASE;
  const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_MODEL;
  const timeoutMs = parseTimeoutMs(process.env.DEEPSEEK_TIMEOUT_MS);
  const endpoint = resolveDeepSeekEndpoint(apiBase);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "DEEPSEEK_API_KEY is not configured. Set it in your environment (Railway Variables) before requesting a reading.",
      },
      { status: 503 }
    );
  }

  const input = parsed.data;
  let readingDate: Date;
  try {
    readingDate = parseDateOnly(input.readingDate, new Date());
  } catch {
    return NextResponse.json({ error: "Invalid sky date." }, { status: 400 });
  }
  const targetSnapshot = computeSnapshot(readingDate);
  let sunSign;
  let sunLon: number;
  try {
    const birthDate = parseBirthDateTime(input.birthDate, input.birthTime);
    const { EclipticLongitude, Body } = await import("astronomy-engine");
    sunLon = (EclipticLongitude(Body.Earth, birthDate) + 180) % 360;
    sunSign = longitudeToSign(sunLon);
  } catch {
    return NextResponse.json({ error: "Invalid birth date or time." }, { status: 400 });
  }

  const userPrompt = buildUserPrompt(input, sunSign.name, sunLon, targetSnapshot, readingDate);

  const basePayload = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.85,
    max_tokens: COMPLETION_TOKEN_LIMIT,
    response_format: { type: "json_object" },
    thinking: { type: "disabled" },
    stream: false,
  };
  const payload = basePayload;

  let upstream: Response;
  try {
    upstream = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    const msg = timedOut
      ? `DeepSeek request timed out after ${Math.round(timeoutMs / 1000)}s`
      : err instanceof Error
        ? err.message
        : "unknown error";
    return NextResponse.json(
      { error: `Could not reach DeepSeek API: ${msg}` },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      {
        error: `DeepSeek API returned ${upstream.status}`,
        detail: text.slice(0, 500),
      },
      { status: 502 }
    );
  }

  const data = await upstream.json().catch(() => null);
  const message = data?.choices?.[0]?.message;
  const content =
    normalizeAssistantContent(message?.content) ||
    normalizeAssistantContent(message?.reasoning_content) ||
    normalizeAssistantContent(data?.choices?.[0]?.text);

  if (!content) {
    return NextResponse.json(
      { error: "DeepSeek returned an empty response." },
      { status: 502 }
    );
  }

  const parsedJson = parseModelJson(content) ?? buildFallbackReading(sunSign.name, targetSnapshot);

  const sections = normalizeSections(parsedJson.sections, sunSign.name);
  const planetInsights = safeParsePlanetInsights(parsedJson.planetInsights, targetSnapshot);

  const response = {
    sunSign: {
      id: sunSign.id,
      name: sunSign.name,
      symbol: sunSign.glyph,
    },
    greeting: String(parsedJson.greeting ?? `Welcome, ${sunSign.name}.`).slice(0, 200),
    summary: String(parsedJson.summary ?? "").slice(0, 600),
    sections,
    planetInsights,
    affirmation: String(parsedJson.affirmation ?? "").slice(0, 240),
    meta: {
      provider: "deepseek",
      model,
      endpoint: endpoint.url,
      endpointMode: endpoint.mode,
      generatedAt: new Date().toISOString(),
      readingDate: readingDate.toISOString().slice(0, 10),
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      birthPlace: input.birthPlace,
    },
  };

  const audioScript = resolveAudioScript(parsedJson.audioScript, response);
  return NextResponse.json({ ...response, audioScript, audioAuthorization: authorizeAudio(audioScript) },
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  const apiBase = process.env.DEEPSEEK_API_BASE ?? DEFAULT_DEEPSEEK_API_BASE;
  const endpoint = resolveDeepSeekEndpoint(apiBase);
  const timeoutMs = parseTimeoutMs(process.env.DEEPSEEK_TIMEOUT_MS);

  return NextResponse.json({
    service: "aeon-reading",
    provider: "deepseek",
    model: process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_MODEL,
    apiBase,
    endpoint: endpoint.url,
    endpointMode: endpoint.mode,
    timeoutMs,
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
    supportsReadingDate: true,
    signs: ZODIAC_SIGNS.map((s) => ({ id: s.id, name: s.name })),
  });
}
