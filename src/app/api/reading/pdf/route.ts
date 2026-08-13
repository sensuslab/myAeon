import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SectionSchema = z.object({
  title: z.string().max(120),
  timeframe: z.string().max(80),
  body: z.string().max(2400),
});

const PlanetInsightSchema = z.object({
  id: z.string().max(40),
  name: z.string().max(80),
  sign: z.string().max(80),
  degree: z.number().optional().default(0),
  title: z.string().max(160),
  body: z.string().max(1600),
  reflection: z.string().max(500).optional().default(""),
});

const PdfInputSchema = z.object({
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
    meta: z
      .object({
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
  options: {
    title?: string;
    eyebrow?: string;
    body: string;
    accent?: "gold" | "cyan";
    minHeight?: number;
  }
) {
  const x = PAGE.marginX;
  const width = PAGE.width - PAGE.marginX * 2;
  const body = sanitizeText(options.body);
  const title = options.title ? sanitizeText(options.title) : "";
  const eyebrow = options.eyebrow ? sanitizeText(options.eyebrow) : "";
  doc.font("Helvetica").fontSize(10.4);
  const bodyHeight = doc.heightOfString(body, { width: width - 34, lineGap: 3 });
  const titleHeight = title ? 19 : 0;
  const eyebrowHeight = eyebrow ? 15 : 0;
  const height = Math.max(options.minHeight ?? 0, 28 + eyebrowHeight + titleHeight + bodyHeight);

  ensureSpace(doc, reading, pageNumberRef, height + 12);
  const y = doc.y;

  doc.save();
  doc.roundedRect(x, y, width, height, 13).fillAndStroke(COLORS.panel, "#dde4ee");
  doc.rect(x, y, 4, height).fill(options.accent === "cyan" ? COLORS.cyan : COLORS.gold);
  doc.restore();

  let textY = y + 14;
  if (eyebrow) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(options.accent === "cyan" ? COLORS.cyan : COLORS.goldDeep)
      .text(eyebrow.toUpperCase(), x + 18, textY, {
        width: width - 34,
        characterSpacing: 0.8,
      });
    textY += 15;
  }
  if (title) {
    doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.ink).text(title, x + 18, textY, {
      width: width - 34,
    });
    textY += 19;
  }
  doc.font("Helvetica").fontSize(10.4).fillColor(COLORS.ink).text(body, x + 18, textY, {
    width: width - 34,
    lineGap: 3,
  });

  doc.y = y + height + 12;
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

function renderReadingPdf(reading: ReadingPdfInput) {
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
        const position = `${sanitizeText(insight.sign)} ${Math.floor(insight.degree ?? 0)} deg`;
        const reflection = insight.reflection ? `\n\nReflection: ${insight.reflection}` : "";
        card(doc, reading, pageNumberRef, {
          title: insight.title,
          eyebrow: `${insight.name} - ${position}`,
          body: `${insight.body}${reflection}`,
          accent: "cyan",
        });
      });
    }

    ensureSpace(doc, reading, pageNumberRef, 170);
    h2(doc, reading, pageNumberRef, "Reading Details");
    card(doc, reading, pageNumberRef, {
      body: [
        `Sun sign: ${reading.sunSign.name}`,
        reading.meta?.birthDate ? `Birth date: ${reading.meta.birthDate}` : null,
        reading.meta?.birthTime ? `Birth time: ${reading.meta.birthTime}` : null,
        reading.meta?.birthPlace ? `Birth place: ${reading.meta.birthPlace}` : null,
        reading.meta?.readingDate ? `Sky date: ${reading.meta.readingDate}` : null,
        reading.meta?.model ? `Model: ${reading.meta.model}` : null,
        reading.meta?.generatedAt ? `Generated: ${reading.meta.generatedAt}` : null,
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PdfInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reading payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const pdf = await renderReadingPdf(parsed.data.reading);
  const date = parsed.data.reading.meta?.readingDate ?? new Date().toISOString().slice(0, 10);
  const filename = `${fileSafe(parsed.data.reading.sunSign.name)}-myAeon-reading-${fileSafe(date)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
