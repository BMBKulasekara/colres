/**
 * Mentions in a chat message.
 *
 * A mention is stored as plain text — "@Ada Lovelace" — plus the mentioned
 * person's id on the message record. Nothing is encoded into the text itself.
 *
 * The alternative, a marker like `@[Ada Lovelace](user_123)`, is what most
 * chat apps do and is tempting because it survives a rename. It was not chosen
 * here because the text of a message is read in places that will never parse
 * it: the Convex dashboard, a future email digest, a plain-text export of the
 * discussion. A message whose raw text reads "@[Ada Lovelace](user_2f9c)" is
 * unreadable in all of them, and the failure mode of the simpler scheme — a
 * mention stops highlighting after someone changes their display name — costs
 * nothing but a highlight, since the id on the record is what the app acts on.
 *
 * Matching is therefore done at render time against the names of the people
 * the message actually mentioned, longest first so that "@Ada Lovelace" is not
 * matched as "@Ada" when both people are in the room.
 */

export interface MentionCandidate {
  /** Clerk id. */
  id: string;
  name: string;
}

/** One run of a message: either plain text or somebody's name. */
export type MessageSegment =
  | { type: "text"; text: string }
  | { type: "mention"; text: string; userId: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits message text into plain runs and mentions.
 *
 * Only the people named in `mentioned` are matched, so typing "@lunch" or an
 * email address does not light up as a mention of nobody.
 */
export function splitMentions(
  text: string,
  mentioned: readonly MentionCandidate[]
): MessageSegment[] {
  if (mentioned.length === 0 || !text) return text ? [{ type: "text", text }] : [];

  // Longest name first: otherwise "@Ada" would match inside "@Ada Lovelace"
  // and leave " Lovelace" stranded as plain text.
  const byLength = [...mentioned].sort((a, b) => b.name.length - a.name.length);

  const pattern = new RegExp(
    `@(${byLength.map((person) => escapeRegExp(person.name)).join("|")})\\b`,
    "g"
  );

  const segments: MessageSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ type: "text", text: text.slice(cursor, start) });

    const name = match[1] as string;
    const person = byLength.find((candidate) => candidate.name === name);
    segments.push(
      person
        ? { type: "mention", text: match[0], userId: person.id }
        : { type: "text", text: match[0] }
    );

    cursor = start + match[0].length;
  }

  if (cursor < text.length) segments.push({ type: "text", text: text.slice(cursor) });

  return segments;
}

/**
 * The ids of everyone named in the text, for storing on the message.
 *
 * Run over the candidate list rather than over "@word" matches so that a
 * mention of someone who is not in the room is simply not a mention.
 */
export function findMentionedIds(
  text: string,
  candidates: readonly MentionCandidate[]
): string[] {
  const ids = splitMentions(text, candidates)
    .filter((segment): segment is Extract<MessageSegment, { type: "mention" }> =>
      segment.type === "mention"
    )
    .map((segment) => segment.userId);

  return [...new Set(ids)];
}

/**
 * The partial mention the caret sits in, if any — what the picker filters on.
 *
 * Returns the range so the caller can replace exactly the typed fragment when
 * a name is chosen. A mention is only offered at a word boundary, so an email
 * address does not open the picker halfway through being typed.
 */
export function mentionQueryAt(
  text: string,
  caret: number
): { query: string; from: number; to: number } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;

  // Anything but the start of the text or a space before the "@" means this is
  // part of a longer token — an email address, most often.
  const preceding = at === 0 ? " " : (before[at - 1] as string);
  if (!/\s/.test(preceding)) return null;

  const query = before.slice(at + 1);
  // A name may contain one space ("Ada Lovelace"), but two means the author has
  // moved on and is writing a sentence.
  if (/\n/.test(query) || query.split(" ").length > 2) return null;

  return { query, from: at, to: caret };
}
