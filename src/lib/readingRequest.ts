import { z } from "zod";
import { ReadingGenerationError } from "@/lib/readingGeneration";

export const ContextIdSchema = z.string().regex(/^[a-f0-9]{48}$/);
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export function privateHeaders(cookie?: string | null) {
  return { ...PRIVATE_HEADERS, ...(cookie ? { "Set-Cookie": cookie } : {}) };
}

/** Bound the streamed body as well as the optional Content-Length header. */
export async function readPrivateJson(req: Request, limit: number): Promise<unknown> {
  if (Number(req.headers.get("content-length")) > limit) throw new ReadingGenerationError("Request is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new ReadingGenerationError("Missing request body.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ReadingGenerationError("Request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ReadingGenerationError("Invalid JSON body.", 400); }
}

export function requestFailure(error: unknown, fallback: string) {
  return error instanceof ReadingGenerationError
    ? { error: error.message, status: error.status }
    : { error: fallback, status: 400 };
}
