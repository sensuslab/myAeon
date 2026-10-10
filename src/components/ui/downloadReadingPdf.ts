import type { ReadingPayload } from "./types";

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "aeon-reading";
}

function filenameFor(reading: ReadingPayload) {
  const date = reading.meta?.readingDate ?? new Date().toISOString().slice(0, 10);
  return `${safeFilename(reading.sunSign.name)}-myAeon-reading-${safeFilename(date)}.pdf`;
}

export async function downloadReadingPdf(reading: ReadingPayload, contextId?: string) {
  const response = await fetch("/api/reading/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reading, ...(contextId ? { contextId } : {}) }),
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.error || `PDF export failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFor(reading);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
