/**
 * MLA 9's author–page citations — "(Smith 45)".
 *
 * MLA points from the text to the Works Cited list by author and location,
 * not by year: no comma between them, no "p." before the page, and nothing at
 * all in the parentheses when there is no page to give — "(Smith)". Where the
 * author alone would be ambiguous, MLA adds what tells the works apart:
 *
 *  - several works by the same author(s): a short title after a comma,
 *    "(Smith, Storybooks 45)", italic for a book, quoted for an article;
 *  - different authors with the same surname: the first initial, "(J. Smith 45)";
 *  - no author: the short title in place of the name.
 *
 * The Works Cited list itself is alphabetical by author, then title, and an
 * entry by the same authors as the one above it replaces the names with three
 * hyphens: "---." (`repeatedAuthors`).
 *
 * Returns the same `CitationNumbering` shape as the other systems, so the
 * editor and print need not know which one ran. Kept free of ProseMirror and
 * the DOM so it can be tested in Node.
 */

import { sortAuthorDate } from './authorDate.ts';
import {
  type DisplayReference,
  initials,
  isGroupAuthor,
  italic,
  joinSegments,
  mlaTitleCase,
  type ReferenceSegment,
  surname,
  upright,
} from './citationFormat.ts';
import type { CitationLabel, CitationNumbering, CitationOccurrence } from './citationNumbering.ts';

/** Titles MLA quotes: parts of a larger work. Everything else is italic. */
const QUOTED_TITLE_TYPES = new Set(['article', 'inproceedings', 'incollection']);

const lower = (value: string) => value.toLowerCase();

/**
 * The short title MLA uses in a citation: the title up to any subtitle,
 * trimmed to its first four words ("Emotions in Storybooks").
 */
export function mlaShortTitle(title: string): string {
  const main = mlaTitleCase(title.trim()).split(/[:?!.]\s/)[0] ?? title;
  const words = main.split(/\s+/);
  return words.length > 4 ? words.slice(0, 4).join(' ') : main;
}

/** The short title as a styled run: quoted for a part of a larger work, italic otherwise. */
function titleSegment(reference: DisplayReference): ReferenceSegment {
  const short = mlaShortTitle(reference.title);
  return QUOTED_TITLE_TYPES.has(reference.type ?? 'misc') ? upright(`"${short}"`) : italic(short);
}

/** "Smith", "Smith and Jones", or "Smith et al." — MLA's in-text names. */
export function mlaInTextName(reference: DisplayReference, withInitial = false): string {
  const names = reference.authors.map((author, index) => {
    const initial =
      index === 0 && withInitial && !isGroupAuthor(author) ? initials(author).split(' ')[0] : '';
    return initial ? `${initial} ${surname(author)}` : surname(author);
  });
  if (names.length === 1) return names[0] as string;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} et al.`;
}

/**
 * The location as MLA writes it: a page number alone, with no "p." — "45",
 * "45–47" — and "par." for a paragraph. Anything else (a line, a time stamp,
 * "ch. 3") is kept as typed.
 */
export function mlaLocator(locator: string | undefined): string {
  const value = locator?.trim();
  if (!value) return '';
  return value
    .replace(/^pp?\.\s*/i, '')
    .replace(/^paras?\.\s*/i, (match) => (/s\./i.test(match) ? 'pars. ' : 'par. '))
    .replace(/(\d)\s*-{1,2}\s*(\d)/g, '$1–$2');
}

/**
 * Which references need more than the author's name in the text, worked out
 * once for the whole list: a short title when the same authors wrote more
 * than one listed work, an initial when two first authors share a surname.
 */
function disambiguation(references: readonly DisplayReference[]) {
  const needsTitle = new Set<string>();
  const needsInitial = new Set<string>();

  const byAuthors = new Map<string, string[]>();
  const firstNames = new Map<string, Set<string>>();

  for (const reference of references) {
    if (reference.authors.length === 0) continue;
    const key = lower(reference.authors.map(surname).join('\u0000'));
    byAuthors.set(key, [...(byAuthors.get(key) ?? []), reference.citationKey]);

    const first = reference.authors[0] as string;
    if (!isGroupAuthor(first)) {
      const family = lower(surname(first));
      const set = firstNames.get(family) ?? new Set<string>();
      set.add(lower(initials(first)));
      firstNames.set(family, set);
    }
  }

  for (const keys of byAuthors.values()) {
    if (keys.length > 1) for (const key of keys) needsTitle.add(key);
  }
  for (const reference of references) {
    const first = reference.authors[0];
    if (!first || isGroupAuthor(first)) continue;
    if ((firstNames.get(lower(surname(first)))?.size ?? 0) > 1)
      needsInitial.add(reference.citationKey);
  }

  return { needsTitle, needsInitial };
}

/**
 * Keys of Works Cited entries whose authors are exactly those of the entry
 * above them. MLA prints those names as "---." instead of repeating them.
 */
export function repeatedAuthors(ordered: readonly DisplayReference[]): Set<string> {
  const repeated = new Set<string>();
  let previous = '';
  for (const reference of ordered) {
    const names = reference.authors.join('\u0000').toLowerCase();
    if (names && names === previous) repeated.add(reference.citationKey);
    previous = names;
  }
  return repeated;
}

/**
 * Builds the in-text label for every citation in the document.
 *
 * Adjacent parenthetical citations share one set of parentheses, separated by
 * semicolons: "(Smith 45; Jones 12)". A narrative citation names the author in
 * the sentence and puts only the page in parentheses — "Smith (45)" — or
 * nothing at all when there is no page.
 */
export function labelAuthorPageCitations(
  occurrences: readonly CitationOccurrence[],
  references: readonly DisplayReference[]
): CitationNumbering {
  const byKey = new Map(references.map((reference) => [reference.citationKey, reference]));
  const { needsTitle, needsInitial } = disambiguation(references);

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

  /** One source's part of a parenthetical: name, short title, location. */
  const sourceSegments = (reference: DisplayReference, locator: string): ReferenceSegment[] => {
    const out: ReferenceSegment[] = [];
    if (reference.authors.length === 0) {
      out.push(titleSegment(reference));
    } else {
      out.push(upright(mlaInTextName(reference, needsInitial.has(reference.citationKey))));
      if (needsTitle.has(reference.citationKey)) out.push(upright(', '), titleSegment(reference));
    }
    if (locator) out.push(upright(` ${locator}`));
    return out;
  };

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
    const leader = labels[index] as CitationLabel;
    const resolved = group.filter((occurrence) => byKey.has(occurrence.citationKey));

    let segments: ReferenceSegment[];
    if (resolved.length === 0) {
      segments = [upright('(?)')];
      leader.unresolved = true;
    } else if (narrative) {
      const occurrence = resolved[0] as CitationOccurrence;
      const reference = byKey.get(occurrence.citationKey) as DisplayReference;
      const locator = mlaLocator(occurrence.locator);
      // "Smith (45)", "Smith (Storybooks 45)", or just "Smith".
      const name =
        reference.authors.length === 0
          ? [titleSegment(reference)]
          : [upright(mlaInTextName(reference, needsInitial.has(reference.citationKey)))];
      const inside: ReferenceSegment[] = [];
      if (reference.authors.length > 0 && needsTitle.has(reference.citationKey)) {
        inside.push(titleSegment(reference));
      }
      if (locator) inside.push(upright(`${inside.length ? ' ' : ''}${locator}`));
      segments = inside.length ? [...name, upright(' ('), ...inside, upright(')')] : name;
    } else {
      const seenHere = new Set<string>();
      const parts: ReferenceSegment[][] = [];
      const sorted = sortAuthorDate(
        resolved.map((occurrence) => ({
          ...(byKey.get(occurrence.citationKey) as DisplayReference),
          locator: mlaLocator(occurrence.locator),
        })),
        'mla'
      );
      for (const entry of sorted) {
        const identity = `${entry.citationKey}\u0000${entry.locator}`;
        if (seenHere.has(identity)) continue;
        seenHere.add(identity);
        parts.push(sourceSegments(entry, entry.locator));
      }
      segments = [
        upright('('),
        ...parts.flatMap((part, i) => (i === 0 ? part : [upright('; '), ...part])),
        upright(')'),
      ];
      leader.unresolved = resolved.length < group.length;
    }

    const joined = joinSegments(segments);
    leader.text = joined.map((segment) => segment.text).join('');
    if (joined.some((segment) => segment.italic)) leader.segments = joined;

    for (let i = index + 1; i < end; i++) {
      (labels[i] as CitationLabel).hidden = true;
    }
    index = end;
  }

  return { numbers: new Map(), order, labels };
}
