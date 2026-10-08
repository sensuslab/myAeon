/** Shared narration contract; no provider credentials or Node APIs in this module. */
export const MAX_AUDIO_SCRIPT_CHARS = 20_000;
export const AUDIO_SCRIPT_PROMPT = `
AUDIO-FIRST NARRATION (required on every reading request):
Write a separate audioScript string in the SAME JSON response. This is a complete,
standalone spoken adaptation of this reading, not a summary or instructions to a narrator.
Cover the greeting and sky overview, all four domains within each timeframe in order
(today, the next three days, the coming week, the coming month), the eight planet
insights with their reflections, and the closing affirmation. Preserve the written
reading's meaning and practical advice; do not add facts, predictions, natal details,
or new claims. Keep the same symbolic, non-deterministic framing.
Aim for 900 to 1200 words, and stay below 20000 characters. Use calm, warm, natural
conversational English, second-person address, short sentences, and brief paragraphs.
Use spoken transitions so listeners always know the timeframe and topic without
seeing the screen. Do not say “click”, “tab”, “as shown above”, or refer to the interface.
Use full stops and commas for natural pacing, and question marks for reflections.
Write only words intended to be spoken: no Markdown, headings, bullet markers,
SSML, XML, stage directions such as [pause], speaker labels, URLs, emoji, or zodiac
glyphs. Write numbers, dates, degrees and abbreviations in their spoken form.
Use “and” rather than ampersands. Explain unfamiliar astrological terms briefly
on first use rather than piling up jargon. Avoid all caps, repeated exclamation
marks, excessive ellipses, forced filler words, and exaggerated mystical delivery.
Address the listener by name only in the opening if supplied. End with the affirmation.
Before returning JSON, silently read the script as speech: resolve awkward phrasing,
ambiguous number pronunciation, long clauses, repetition, and missing transitions.
Do not include that review in the response.`;

export type AudioAuthorization = { expiresAt: number; signature: string };

export function cleanSpeechText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\[(?:pause|breath|music|silence)[^\]]*\]/gi, "")
    .replace(/^\s*(?:#{1,6}\s+|[-*•]\s+)/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/&/g, " and ")
    .replace(/°/g, " degrees")
    .replace(/[\u2648-\u2653]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Graceful compatibility if the model omits or malforms the requested script. */
export function resolveAudioScript(raw: unknown, reading: {
  greeting: string; summary: string; affirmation: string;
  sections: Array<{ timeframe: string; title: string; body: string }>;
  planetInsights: Array<{ title: string; body: string; reflection: string }>;
}): string {
  if (typeof raw === "string") {
    const cleaned = cleanSpeechText(raw);
    if (cleaned.length >= 80 && cleaned.length <= MAX_AUDIO_SCRIPT_CHARS) return cleaned;
  }
  const horizons: Record<string, string> = {
    Today: "For today", "3 Days": "Over the next three days",
    Week: "For the coming week", Month: "For the coming month",
  };
  const paragraphs = [reading.greeting, reading.summary,
    "This is a symbolic reflection, rather than a prediction."];
  for (const [timeframe, transition] of Object.entries(horizons)) {
    paragraphs.push(`${transition}.`);
    for (const section of reading.sections.filter((s) => s.timeframe === timeframe)) {
      paragraphs.push(`Turning to ${section.title.toLowerCase()}. ${section.body}`);
    }
  }
  paragraphs.push("Now, a closer look at the planets.");
  for (const insight of reading.planetInsights) {
    paragraphs.push(`${insight.title}. ${insight.body} ${insight.reflection}`);
  }
  paragraphs.push(`To close, your affirmation. ${reading.affirmation}`);
  // Never truncate in the middle of a spoken sentence.
  const cleaned = cleanSpeechText(paragraphs.join("\n\n"));
  if (cleaned.length <= MAX_AUDIO_SCRIPT_CHARS) return cleaned;
  const prefix = cleaned.slice(0, MAX_AUDIO_SCRIPT_CHARS - 300);
  return `${prefix.slice(0, prefix.lastIndexOf(".") + 1)}\n\n${cleanSpeechText(reading.affirmation)}`;
}

/** Stay below Aura's 2000-character limit, preferring sentence, then word boundaries. */
export function splitSpeechText(script: string, limit = 1900): string[] {
  if (limit < 2 || limit > 2000) throw new Error("Invalid speech chunk limit");
  const chunks: string[] = [];
  let remaining = script.trim();
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const sentences = [...window.matchAll(/[.!?](?:[”"']?)(?=\s)/g)];
    const last = sentences[sentences.length - 1];
    let boundary = last ? last.index! + last[0].length : window.lastIndexOf(" ");
    if (boundary < limit / 3) boundary = window.lastIndexOf(" ");
    if (boundary < 1) boundary = limit;
    // Do not split a UTF-16 surrogate pair.
    const code = remaining.charCodeAt(boundary - 1);
    if (code >= 0xd800 && code <= 0xdbff) boundary -= 1;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
