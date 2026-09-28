/**
 * Author–date citation rules — APA's "(Smith & Jones, 2020)".
 *
 * The counterpart of `citationNumbering.ts` for styles that name sources rather
 * than number them. The two produce the same `CitationNumbering` shape, so the
 * editor, the reference list and the printed paper can switch between them on
 * the document's style without caring which one ran.
 *
 * Everything that has to agree between the in-text citation and the reference
 * list lives here: the order of the list, and the "a"/"b" letters that tell
 * apart two works by the same authors from the same year. A "2020a" in the text
 * that is "2020b" in the list sends the reader to the wrong paper.
 *
 * Kept free of ProseMirror and the DOM so the rules can be exercised in Node.
 */

import { type DisplayReference, initials, stripBraces, surname } from './citationFormat.ts';
import type { CitationLabel, CitationNumbering, CitationOccurrence } from './citationNumbering.ts';

/** Case- and accent-insensitive, the way APA alphabetises letter by letter. */
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * A leading article is ignored when a title is alphabetised, so "The Brain"
 * files under B.
 */
function titleSortKey(title: string): string {
  return stripBraces(title)
    .trim()
    .replace(/^(a|an|the)\s+/i, '');
}

/**
 * What a reference files under: each author's surname and initials in order,
 * or the title when there is no author — the title then takes the author's
 * place in the entry, and so in the ordering.
 */
function nameTokens(reference: DisplayReference): string[] {
  if (reference.authors.length === 0) return [titleSortKey(reference.title)];
  return reference.authors.flatMap((author) => [surname(author), initials(author)]);
}

/**
 * APA's ordering rules, in priority order:
 *
 *  - by first author's surname, then initials, then by the second author and
 *    so on ("nothing precedes something": a one-author entry comes before a
 *    two-author entry that starts with the same person);
 *  - same authors: undated works first, then oldest to newest;
 *  - same authors and year: by title.
 */
export function compareAuthorDate(a: DisplayReference, b: DisplayReference): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);

  for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
    const order = collator.compare(ta[i] as string, tb[i] as string);
    if (order !== 0) return order;
  }
  if (ta.length !== tb.length) return ta.length - tb.length;

  const ya = a.year ?? Number.NEGATIVE_INFINITY;
  const yb = b.year ?? Number.NEGATIVE_INFINITY;
  if (ya !== yb) return ya < yb ? -1 : 1;

  return collator.compare(titleSortKey(a.title), titleSortKey(b.title));
}

/** The reference list in APA order. Returns a new array. */
export function sortAuthorDate<T extends DisplayReference>(references: readonly T[]): T[] {
  return [...references].sort(compareAuthorDate);
}

/**
 * The letters that separate same-author, same-year works: "2020a", "2020b".
 *
 * Letters follow the order the works take in the reference list — by title —
 * rather than the order they are cited, which is what lets the list and the
 * text agree without either knowing about the other. References that need no
 * letter are absent from the map.
 */
export function yearSuffixes(references: readonly DisplayReference[]): Map<string, string> {
  const groups = new Map<string, DisplayReference[]>();

  for (const reference of references) {
    const key = `${nameTokens(reference).join('\u0000').toLowerCase()}\u0001${reference.year ?? 'nd'}`;
    const group = groups.get(key);
    if (group) group.push(reference);
    else groups.set(key, [reference]);
  }

  const suffixes = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Everything in a group shares its authors and year, so this orders by title.
    sortAuthorDate(group).forEach((reference, index) => {
      suffixes.set(reference.citationKey, suffixLetter(index));
    });
  }

  return suffixes;
}

/** a, b, … z, aa, ab — the sequence runs past 26 rather than wrapping. */
function suffixLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Title-only sources that APA sets in italics in the list are left bare here. */
const QUOTED_TITLE_TYPES = new Set(['article', 'inproceedings', 'incollection']);

/**
 * How the text names a source, APA 7:
 *
 *  - one author: "Smith"
 *  - two authors: "Smith & Jones" inside parentheses, "Smith and Jones" when
 *    the names are part of the sentence (a narrative citation), every time
 *  - three or more: "Smith et al.", from the very first citation
 *  - no author: the title, quoted when it is part of a larger work. In the
 *    text it keeps its title-case capitals, unlike in the reference list.
 */
export function inTextName(reference: DisplayReference, narrative = false): string {
  const { authors } = reference;
  if (authors.length === 0) {
    const title = stripBraces(reference.title).trim();
    return QUOTED_TITLE_TYPES.has(reference.type ?? 'misc') ? `"${title}"` : title;
  }
  if (authors.length === 1) return surname(authors[0] as string);
  if (authors.length === 2) {
    const joiner = narrative ? 'and' : '&';
    return `${surname(authors[0] as string)} ${joiner} ${surname(authors[1] as string)}`;
  }
  return `${surname(authors[0] as string)} et al.`;
}

/** "2020", "2020a", "n.d.", or "n.d.-a". */
export function inTextYear(reference: DisplayReference, suffix = ''): string {
  if (reference.year) return `${reference.year}${suffix}`;
  return suffix ? `n.d.-${suffix}` : 'n.d.';
}

/** One source inside a parenthetical, before it is merged with its neighbours. */
interface GroupEntry {
  reference: DisplayReference;
  name: string;
  year: string;
  locator?: string;
}

/**
 * Writes one parenthetical from the sources it cites.
 *
 * Sources are listed in reference-list order, separated by semicolons. Works
 * by the same authors are collapsed onto one name — "(Smith, 2019, 2020)" —
 * unless a page number would then be ambiguous about which work it belongs to.
 */
function formatParenthetical(entries: GroupEntry[]): string {
  const sorted = [...entries].sort((a, b) => compareAuthorDate(a.reference, b.reference));
  const parts: string[] = [];
  let previous: GroupEntry | null = null;

  for (const entry of sorted) {
    const canMerge =
      previous !== null && previous.name === entry.name && !previous.locator && !entry.locator;

    if (canMerge) {
      parts[parts.length - 1] += `, ${entry.year}`;
    } else {
      parts.push(`${entry.name}, ${entry.year}${entry.locator ? `, ${entry.locator}` : ''}`);
    }
    previous = entry;
  }

  return `(${parts.join('; ')})`;
}

/**
 * Builds the in-text label for every citation in the document.
 *
 * A narrative citation — the author named in the sentence — is always a group
 * of one: "Smith and Jones (2020, p. 4) found…". It never merges with a
 * neighbour, since the names are part of the sentence rather than of a list.
 *
 * Adjacent parenthetical citations form one parenthetical, exactly as adjacent numbered
 * citations form one bracket group; the leader carries the whole label and the
 * rest are hidden. Unlike IEEE, a locator does not split the group, because APA
 * writes each source's page inside the shared parentheses:
 * "(Smith, 2020, p. 4; Jones, 2019)".
 *
 * `order` is first-appearance order, as for numbered styles. Nothing is
 * numbered, but the reference list still needs to know which sources the text
 * actually cites.
 */
export function labelAuthorDateCitations(
  occurrences: readonly CitationOccurrence[],
  references: readonly DisplayReference[]
): CitationNumbering {
  const byKey = new Map(references.map((reference) => [reference.citationKey, reference]));
  const suffixes = yearSuffixes(references);

  const order: string[] = [];
  const seen = new Set<string>();
  for (const occurrence of occurrences) {
    if (!byKey.has(occurrence.citationKey) || seen.has(occurrence.citationKey)) continue;
    seen.add(occurrence.citationKey);
    order.push(occurrence.citationKey);
  }

  const labels: CitationLabel[] = occurrences.map(() => ({
    text: '',
    hidden: false,
    unresolved: false,
  }));

  let index = 0;
  while (index < occurrences.length) {
    let end = index + 1;
    if (!occurrences[index]?.narrative) {
      while (
        end < occurrences.length &&
        occurrences[end]?.adjacentToPrevious === true &&
        !occurrences[end]?.narrative
      ) {
        end += 1;
      }
    }

    const group = occurrences.slice(index, end);
    const narrative = group.length === 1 && group[0]?.narrative === true;
    const entries: GroupEntry[] = [];
    const cited = new Set<string>();

    for (const occurrence of group) {
      const reference = byKey.get(occurrence.citationKey);
      if (!reference) continue;
      // The same source twice in one parenthetical says nothing the first
      // mention did not, unless the two point at different pages.
      const identity = `${occurrence.citationKey}\u0000${occurrence.locator ?? ''}`;
      if (cited.has(identity)) continue;
      cited.add(identity);

      entries.push({
        reference,
        name: inTextName(reference, narrative),
        year: inTextYear(reference, suffixes.get(reference.citationKey)),
        locator: occurrence.locator,
      });
    }

    const leader = labels[index] as CitationLabel;
    if (entries.length === 0) {
      leader.text = '(?)';
      leader.unresolved = true;
    } else if (narrative) {
      const entry = entries[0] as GroupEntry;
      leader.text = `${entry.name} (${entry.year}${entry.locator ? `, ${entry.locator}` : ''})`;
    } else {
      leader.text = formatParenthetical(entries);
      leader.unresolved = group.some((occurrence) => !byKey.has(occurrence.citationKey));
    }

    for (let i = index + 1; i < end; i++) {
      (labels[i] as CitationLabel).hidden = true;
    }

    index = end;
  }

  return { numbers: new Map(), order, labels };
}
