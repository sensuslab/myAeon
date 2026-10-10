import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { NextResponse } from "next/server";
import { z } from "zod";
import SVGtoPDF from "svg-to-pdfkit";
import type { AstrologyContext } from "@/lib/astrologyTypes";
import { BirthChartSchema } from "@/lib/readingEnhancement";
import { sameRequestOrigin } from "@/lib/serverRequest";
import { ContextIdSchema, privateHeaders, readPrivateJson, requestFailure } from "@/lib/readingRequest";
import { ReadingGenerationError } from "@/lib/readingGeneration";
import { PLANETS, getSunSign, longitudeToSign } from "@/lib/zodiac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SectionSchema = z.object({
  title: z.string().max(120),
  timeframe: z.string().max(80),
  body: z.string().max(2400),
});

const PlanetInsightSchema = z.object({
  id: z.enum(["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]),
  name: z.string().max(80),
  sign: z.string().max(80),
  degree: z.number().optional().default(0),
  title: z.string().max(160),
  body: z.string().max(1600),
  reflection: z.string().max(500).optional().default(""),
});

const PdfInputSchema = z.object({
  contextId: ContextIdSchema.optional(),
  reading: z.object({
    sunSign: z.object({
      id: z.string().max(80),
      name: z.string().max(80),
      symbol: z.string().max(8).optional().default(""),
    }),
    greeting: z.string().max(400),
    summary: z.string().max(1600),
    sections: z.array(SectionSchema).max(32),
    planetInsights: z.array(PlanetInsightSchema).max(12).optional().default([]),
    affirmation: z.string().max(600).optional().default(""),
    birthChart: BirthChartSchema.optional(),
    meta: z
      .object({
        profileId: ContextIdSchema.optional(),
        astrology: z.object({ contextId: z.string().regex(/^[a-f0-9]{48}$/).optional() }).optional(),
        model: z.string().max(120).optional(),
        generatedAt: z.string().max(80).optional(),
        readingDate: z.string().max(40).optional(),
        birthDate: z.string().max(40).optional(),
        birthTime: z.string().max(40).optional(),
        birthPlace: z.string().max(120).optional(),
      })
      .optional()
      .default({}),
  }),
});

type ReadingPdfInput = z.infer<typeof PdfInputSchema>["reading"];

const PAGE = {
  marginX: 54,
  marginTop: 52,
  marginBottom: 58,
  width: 595.28,
  height: 841.89,
};

const COLORS = {
  ink: "#182133",
  muted: "#647085",
  faint: "#d8e0ec",
  gold: "#b98221",
  goldDeep: "#7b4d0d",
  cyan: "#15788a",
  blue: "#0c1430",
  wash: "#f3f7fb",
  panel: "#ffffff",
};

const TIMEFRAMES = ["Today", "3 Days", "Week", "Month"];

function sanitizeText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00b0/g, " deg")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .trim();
}

function fileSafe(value: string) {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "aeon-reading";
}

function drawPageBackground(doc: PDFKit.PDFDocument, pageNumber: number) {
  doc.save();
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.wash);
  doc.circle(PAGE.width - 84, 74, 118).fillOpacity(0.06).fill(COLORS.cyan);
  doc.circle(56, PAGE.height - 76, 170).fillOpacity(0.08).fill(COLORS.gold);
  doc.fillOpacity(1);

  doc
    .strokeColor("#d6b36a")
    .lineWidth(0.6)
    .opacity(0.55)
    .moveTo(PAGE.marginX, PAGE.height - 38)
    .lineTo(PAGE.width - PAGE.marginX, PAGE.height - 38)
    .stroke()
    .opacity(1);

  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted);
  doc.text(`myAeon reading - page ${pageNumber}`, PAGE.marginX, PAGE.height - 30, {
    width: PAGE.width - PAGE.marginX * 2,
    align: "center",
  });
  doc.restore();
}

function addHeader(doc: PDFKit.PDFDocument, reading: ReadingPdfInput, pageNumber: number) {
  drawPageBackground(doc, pageNumber);

  const logoPath = path.join(process.cwd(), "public", "brand", "my-aeon-wordmark.png");
  if (fs.existsSync(logoPath)) {
    const logo = fs.readFileSync(logoPath).toString("base64");
    doc.image(`data:image/png;base64,${logo}`, PAGE.marginX, 29, { width: 118 });
  } else {
    doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.gold).text("myAeon", PAGE.marginX, 36);
  }

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.cyan)
    .text("COSMIC ASTROLOGICAL GUIDE", PAGE.width - 238, 41, {
      width: 184,
      align: "right",
      characterSpacing: 1.6,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.ink)
    .text(sanitizeText(reading.sunSign.name), PAGE.width - 238, 56, {
      width: 184,
      align: "right",
    });
}

function addPage(doc: PDFKit.PDFDocument, reading: ReadingPdfInput, pageNumberRef: { value: number }) {
  doc.addPage();
  pageNumberRef.value += 1;
  addHeader(doc, reading, pageNumberRef.value);
  doc.y = 98;
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  reading: ReadingPdfInput,
  pageNumberRef: { value: number },
  requiredHeight: number
) {
  if (doc.y + requiredHeight <= PAGE.height - PAGE.marginBottom) return;
  addPage(doc, reading, pageNumberRef);
}

function sectionLabel(doc: PDFKit.PDFDocument, label: string, x: number, y: number, width: number) {
  doc
    .roundedRect(x, y, width, 18, 9)
    .fillAndStroke("#edf8fa", "#cce9ee");
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(COLORS.cyan)
    .text(sanitizeText(label).toUpperCase(), x + 10, y + 5, {
      width: width - 20,
      characterSpacing: 0.7,
    });
}

function card(
  doc: PDFKit.PDFDocument,
  reading: ReadingPdfInput,
  pageNumberRef: { value: number },
  options: { title?: string; eyebrow?: string; body: string; accent?: "gold" | "cyan"; minHeight?: number }
) {
  const x = PAGE.marginX, width = PAGE.width - PAGE.marginX * 2, textWidth = width - 34;
  const title = sanitizeText(options.title), eyebrow = sanitizeText(options.eyebrow).toUpperCase();
  let remaining = sanitizeText(options.body), continued = false;
  do {
    const heading = title ? `${title}${continued ? " (continued)" : ""}` : "";
    doc.font("Helvetica-Bold").fontSize(7.5);
    const eyebrowHeight = eyebrow ? doc.heightOfString(eyebrow, { width: textWidth, characterSpacing: 0.8 }) + 6 : 0;
    doc.font("Helvetica-Bold").fontSize(13);
    const titleHeight = heading ? doc.heightOfString(heading, { width: textWidth }) + 6 : 0;
    const overhead = 28 + eyebrowHeight + titleHeight;
    doc.font("Helvetica").fontSize(10.4);
    const measure = (text: string) => doc.heightOfString(text, { width: textWidth, lineGap: 3 });
    const fullHeight = overhead + measure(remaining) + 12;
    if (fullHeight <= PAGE.height - PAGE.marginBottom - 98) ensureSpace(doc, reading, pageNumberRef, fullHeight);
    ensureSpace(doc, reading, pageNumberRef, overhead + 60 + 12);
    const available = PAGE.height - PAGE.marginBottom - doc.y - overhead - 12;
    doc.font("Helvetica").fontSize(10.4);
    let body = remaining;
    if (measure(body) > available) {
      // Find a fitting word boundary; PDFKit never gets an overflowing text box.
      let low = 1, high = remaining.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (measure(remaining.slice(0, middle)) <= available) low = middle;
        else high = middle - 1;
      }
      const prefix = remaining.slice(0, low);
      const boundary = Math.max(prefix.lastIndexOf(" "), prefix.lastIndexOf("\n"));
      body = remaining.slice(0, boundary > 0 ? boundary : low).trimEnd();
    }
    remaining = remaining.slice(body.length).trimStart();
    const height = Math.max(Math.min(options.minHeight ?? 0, available + overhead), overhead + measure(body));
    const y = doc.y;
    doc.save();
    doc.roundedRect(x, y, width, height, 8).fillAndStroke(COLORS.panel, "#dde4ee");
    doc.rect(x, y, 4, height).fill(options.accent === "cyan" ? COLORS.cyan : COLORS.gold);
    doc.restore();
    let textY = y + 14;
    if (eyebrow) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(options.accent === "cyan" ? COLORS.cyan : COLORS.goldDeep)
        .text(eyebrow, x + 18, textY, { width: textWidth, characterSpacing: 0.8 });
      textY += eyebrowHeight;
    }
    if (heading) {
      doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.ink).text(heading, x + 18, textY, { width: textWidth });
      textY += titleHeight;
    }
    doc.font("Helvetica").fontSize(10.4).fillColor(COLORS.ink).text(body, x + 18, textY, { width: textWidth, lineGap: 3 });
    doc.y = y + height + 12;
    if (remaining) { addPage(doc, reading, pageNumberRef); continued = true; }
  } while (remaining);
}

function h2(doc: PDFKit.PDFDocument, reading: ReadingPdfInput, pageNumberRef: { value: number }, text: string) {
  ensureSpace(doc, reading, pageNumberRef, 42);
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.blue).text(sanitizeText(text), PAGE.marginX, doc.y, {
    width: PAGE.width - PAGE.marginX * 2,
  });
  doc
    .moveTo(PAGE.marginX, doc.y + 5)
    .lineTo(PAGE.marginX + 84, doc.y + 5)
    .strokeColor(COLORS.gold)
    .lineWidth(1.2)
    .stroke();
  doc.y += 18;
}

function renderChart(doc: PDFKit.PDFDocument, reading: ReadingPdfInput, pageNumberRef: { value: number }, title: string, svg: string) {
  addPage(doc, reading, pageNumberRef);
  h2(doc, reading, pageNumberRef, title);
  const width = PAGE.width - PAGE.marginX * 2;
  const height = Math.min(width, PAGE.height - PAGE.marginBottom - doc.y - 24);
  const y = doc.y;
  doc.save();
  SVGtoPDF(doc, svg, PAGE.marginX, y, {
    width, height, preserveAspectRatio: "xMidYMid meet",
    fontCallback: (_family, bold, italic) => bold ? (italic ? "Helvetica-BoldOblique" : "Helvetica-Bold") : (italic ? "Helvetica-Oblique" : "Helvetica"),
    // No external files or nested documents are resolved during an export.
    imageCallback: () => { throw new Error("External chart image not allowed"); },
    documentCallback: () => { throw new Error("External chart document not allowed"); },
    warningCallback: () => {},
  });
  doc.restore();
  doc.y = y + height + 18;
}

function appendBirthChart(doc: PDFKit.PDFDocument, reading: ReadingPdfInput, pageNumberRef: { value: number }, context: AstrologyContext) {
  const natal = context.natal;
  if (!natal) return;
  if (context.charts) {
    renderChart(doc, reading, pageNumberRef, "Natal Chart", context.charts.natal.light);
    renderChart(doc, reading, pageNumberRef, `Transit Chart - ${context.selectedDate}`, context.charts.transit.light);
    addPage(doc, reading, pageNumberRef);
  }
  h2(doc, reading, pageNumberRef, "Birth Chart Evidence");
  card(doc, reading, pageNumberRef, {
    eyebrow: "Computed geocentric placements", accent: "cyan",
    body: [...natal.planets, ...natal.angles].map(point => `${point.name}: ${point.sign} ${point.degree} deg${point.retrograde ? "; retrograde" : ""}${point.house ? `; ${point.house.replace(/_/g, " ")}` : ""}`).join("\n"),
  });
  if (natal.houses.length) card(doc, reading, pageNumberRef, { eyebrow: "Computed house cusps", body: natal.houses.map(house => `House ${house.number}: ${house.sign} ${house.degree} deg`).join("\n"), accent: "cyan" });
  if (natal.aspects.length) card(doc, reading, pageNumberRef, { eyebrow: "Natal aspects", body: natal.aspects.map(aspect => `${aspect.first} ${aspect.aspect} ${aspect.second}; orb ${aspect.orb} deg`).join("\n"), accent: "cyan" });
  for (const snapshot of context.snapshots) {
    if (!snapshot.natalAspects.length) continue;
    card(doc, reading, pageNumberRef, { eyebrow: `${snapshot.label} - ${snapshot.date}: transit to natal`, body: snapshot.natalAspects.map(aspect => `Transit ${aspect.transit} ${aspect.aspect} natal ${aspect.natal}; orb ${aspect.orb} deg`).join("\n"), accent: "cyan" });
  }
  const interpretation = reading.birthChart;
  if (interpretation) {
    h2(doc, reading, pageNumberRef, interpretation.title);
    card(doc, reading, pageNumberRef, { eyebrow: "Overview", body: interpretation.overview, accent: "gold" });
    for (const section of interpretation.sections) card(doc, reading, pageNumberRef, { title: section.title, body: section.body, accent: "cyan" });
    card(doc, reading, pageNumberRef, { eyebrow: "Synthesis", body: interpretation.synthesis, accent: "gold" });
    card(doc, reading, pageNumberRef, { eyebrow: "Reflection", body: interpretation.reflection, accent: "cyan" });
  }
}

function renderReadingPdf(reading: ReadingPdfInput, provenance: string[], context?: AstrologyContext | null) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `myAeon Reading - ${sanitizeText(reading.sunSign.name)}`,
        Author: "myAeon",
        Subject: "Astrological reading",
      },
      bufferPages: false,
    });

    const chunks: Buffer[] = [];
    const pageNumberRef = { value: 1 };
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    addHeader(doc, reading, pageNumberRef.value);
    doc.y = 112;

    doc.font("Helvetica-Bold").fontSize(30).fillColor(COLORS.blue).text("Your Cosmic Reading", PAGE.marginX, doc.y, {
      width: PAGE.width - PAGE.marginX * 2,
    });
    doc.moveDown(0.25);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(COLORS.muted)
      .text(
        [
          `${sanitizeText(reading.sunSign.name)} sun`,
          reading.meta?.readingDate ? `Sky date ${sanitizeText(reading.meta.readingDate)}` : null,
          reading.meta?.generatedAt ? `Generated ${sanitizeText(reading.meta.generatedAt).slice(0, 10)}` : null,
        ]
          .filter(Boolean)
          .join("  |  "),
        PAGE.marginX,
        doc.y,
        { width: PAGE.width - PAGE.marginX * 2 }
      );

    doc.moveDown(1.5);
    card(doc, reading, pageNumberRef, {
      eyebrow: "Opening",
      body: `${reading.greeting}\n\n${reading.summary}`,
      accent: "cyan",
      minHeight: 108,
    });

    if (reading.affirmation) {
      card(doc, reading, pageNumberRef, {
        eyebrow: "Affirmation",
        body: `"${reading.affirmation}"`,
        accent: "gold",
        minHeight: 74,
      });
    }

    h2(doc, reading, pageNumberRef, "Reading Sections");
    TIMEFRAMES.forEach((timeframe) => {
      const sections = reading.sections.filter((section) => section.timeframe === timeframe);
      if (!sections.length) return;
      ensureSpace(doc, reading, pageNumberRef, 34);
      sectionLabel(doc, timeframe, PAGE.marginX, doc.y, 96);
      doc.y += 28;
      sections.forEach((section) => {
        card(doc, reading, pageNumberRef, {
          eyebrow: section.title,
          body: section.body,
          accent: section.title === "Body & Energy" || section.title === "Inner World" ? "cyan" : "gold",
        });
      });
    });

    const insights = reading.planetInsights ?? [];
    if (insights.length) {
      h2(doc, reading, pageNumberRef, "Planet Insights");
      insights.forEach((insight) => {
        const point = context?.snapshots[0]?.planets.find(point => point.name.toLowerCase() === insight.id);
        const position = insight.id === "earth" ? "Reflective grounding note" : point
          ? `${sanitizeText(point.sign)} ${Math.floor(point.degree)} deg (geocentric)`
          : "Position unverified; reading text retained";
        const reflection = insight.reflection ? `\n\nReflection: ${insight.reflection}` : "";
        const name = PLANETS.find(planet => planet.id === insight.id)!.name;
        card(doc, reading, pageNumberRef, {
          title: insight.id === "earth" ? "Earth: grounding reflection" : point ? `${name} in ${point.sign}` : `${name}: reflection`,
          eyebrow: `${name} - ${position}`,
          body: `${insight.body}${reflection}`,
          accent: "cyan",
        });
      });
    }

    if (context?.natal) appendBirthChart(doc, reading, pageNumberRef, context);

    ensureSpace(doc, reading, pageNumberRef, 170);
    h2(doc, reading, pageNumberRef, "Reading Details");
    card(doc, reading, pageNumberRef, {
      body: [
        `Sun sign: ${reading.sunSign.name}`,
        reading.meta?.birthDate ? `Birth date: ${reading.meta.birthDate}` : null,
        reading.meta?.birthTime ? `Birth time: ${reading.meta.birthTime}` : null,
        reading.meta?.birthPlace ? `Birth place: ${reading.meta.birthPlace}` : null,
        reading.meta?.readingDate ? `Sky date: ${reading.meta.readingDate}` : null,
        reading.meta?.generatedAt ? `Generated: ${reading.meta.generatedAt}` : null,
        ...provenance,
        "Astrology is presented as a reflective symbolic lens, not as certainty or prediction.",
      ]
        .filter(Boolean)
        .join("\n"),
      accent: "gold",
    });

    doc.end();
  });
}

export async function POST(req: Request) {
  let cookie: string | null = null;
  if (!sameRequestOrigin(req)) return NextResponse.json({ error: "Request not allowed." }, { status: 403, headers: privateHeaders() });
  try {
    const parsed = PdfInputSchema.parse(await readPrivateJson(req, 150_000));
    const { astrology } = await import("../../../../../server/astrology.mjs");
    const { requestIdentity } = await import("../../../../../server/astrology-quota.mjs");
    const reading = parsed.reading;
    const contextId = parsed.contextId ?? reading.meta.astrology?.contextId ?? reading.birthChart?.contextId;
    let context: AstrologyContext | null = null;
    let provenance = ["No retrievable server-owned birth chart. This export contains the sky reading only."];
    if (contextId) {
      const user = requestIdentity(req); cookie = user.cookie;
      try { context = astrology.resolveContext(user.id, contextId); }
      catch { throw new ReadingGenerationError("Your chart context has expired. Prepare it again before exporting.", 409); }
      if (!context || !context.serverOwned || context.id !== contextId) throw new ReadingGenerationError("Your chart context could not be verified. Prepare it again before exporting.", 409);
      if ((reading.birthChart && reading.birthChart.contextId !== context.id)
        || (reading.meta.profileId && context.profileId && reading.meta.profileId !== context.profileId)
        || (reading.meta.readingDate && reading.meta.readingDate !== context.selectedDate)) {
        throw new ReadingGenerationError("This reading and chart do not match. Prepare the matching chart before exporting.", 409);
      }
      const saved = context.natal ? astrology.getInterpretation(user.id, context.id) : null;
      const interpretation = saved?.birthChart ? BirthChartSchema.parse(saved.birthChart) : undefined;
      if (reading.birthChart && (!interpretation || interpretation.contextId !== context.id)) {
        throw new ReadingGenerationError("The birth-chart interpretation could not be verified. Interpret the chart again before exporting.", 409);
      }
      reading.birthChart = interpretation;
      const profileId = context.profileId ?? reading.meta.profileId;
      const profile = profileId ? astrology.resolveProfile(user.id, profileId) : null;
      if (profile) {
        if ((reading.meta.birthDate && reading.meta.birthDate !== profile.birthDate)
          || (reading.meta.birthTime && reading.meta.birthTime !== profile.birthTime)) {
          throw new ReadingGenerationError("The birth details do not match the confirmed profile. Prepare the reading again before exporting.", 409);
        }
        reading.meta.birthDate = profile.birthDate;
        reading.meta.birthTime = profile.timeConfidence === "unknown" ? undefined : profile.birthTime;
        reading.meta.birthPlace = `${profile.location.city}, ${profile.location.nation}`;
        reading.meta.profileId = profileId;
      }
      const natalSun = context.natal?.planets.find(point => point.name === "Sun");
      const sunSign = natalSun ? longitudeToSign(natalSun.longitude) : profile ? getSunSign(new Date(`${profile.birthDate}T12:00:00Z`)) : null;
      if (sunSign) reading.sunSign = { id: sunSign.id, name: sunSign.name, symbol: sunSign.glyph };
      reading.meta.readingDate = context.selectedDate;
      provenance = [
        context.natal ? "Chart source: verified server-owned calculation" : "Sky source: locally computed geocentric snapshots",
        `Frame: ${context.settings.frame}; ${context.settings.zodiac}; ${context.settings.houses}`,
        `Birth-time confidence: ${context.confidence}`,
        `Computed: ${context.computedAt}`,
        `Snapshots: ${context.snapshots.map(snapshot => `${snapshot.date} (${snapshot.label})`).join(", ")} at noon ${context.targetTimezone}`,
        ...context.limitations,
      ];
    }
    const pdf = await renderReadingPdf(reading, provenance, context);
    const date = reading.meta.readingDate ?? new Date().toISOString().slice(0, 10);
    const filename = `${fileSafe(reading.sunSign.name)}-myAeon-reading-${fileSafe(date)}.pdf`;
    return new Response(new Uint8Array(pdf), { headers: {
      ...privateHeaders(cookie), "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    } });
  } catch (error) {
    const failure = requestFailure(error, "The reading could not be exported. Check the reading and try again.");
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers: privateHeaders(cookie) });
  }
}
