/**
 * Plain text for the document search index, and the snippet shown under a
 * search result. Kept free of Convex so it can be tested on its own.
 */

/** How often the indexing cron job runs. */
export const INDEX_INTERVAL_MINUTES = 5;

/**
 * Stored text is capped well under Convex's 1 MB document limit. 100,000
 * characters is roughly 15,000 words: all of a typical paper, and the first
 * several chapters of a thesis.
 */
export const MAX_SEARCH_TEXT = 100_000;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** The words of a document's stored HTML, without markup. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] === "#") {
        const value = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
      }
      return ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** What goes into the search index: the title, then the body, capped. */
export function searchTextFor(title: string, html: string): string {
  return `${title}\n${htmlToText(html)}`.slice(0, MAX_SEARCH_TEXT);
}

/** The words of a query, as the search index splits them. */
export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0);
}

/**
 * A short excerpt around the first place any query word appears, for showing
 * why a document matched. Falls back to the opening of the text.
 */
export function snippetFor(text: string, query: string, radius = 80): string {
  const body = text.slice(text.indexOf("\n") + 1);
  const lower = body.toLowerCase();
  const positions = queryTerms(query)
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0);

  if (positions.length === 0) {
    return body.length > radius * 2 ? `${body.slice(0, radius * 2).trimEnd()}…` : body;
  }

  const at = Math.min(...positions);
  let start = Math.max(0, at - radius);
  let end = Math.min(body.length, at + radius);
  // Widen to whole words so the excerpt does not begin or end mid-word.
  while (start > 0 && /\S/.test(body[start - 1] ?? "")) start--;
  while (end < body.length && /\S/.test(body[end] ?? "")) end++;

  return `${start > 0 ? "…" : ""}${body.slice(start, end).trim()}${end < body.length ? "…" : ""}`;
}
