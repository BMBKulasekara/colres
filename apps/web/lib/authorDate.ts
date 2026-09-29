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

import {
  type DisplayReference,
  initials,
  isGroupAuthor,
  italic,
  joinSegments,
  type ReferenceSegment,
  stripBraces,
  surname,
  toTitleCase,
  upright,
} from './citationFormat.ts';
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
 * How one reference's authors must be written in the text so that it cannot
 * be mistaken for another reference in the same list. See `nameForms`.
 */
export interface NameForm {
  /** Prefix the first author's initials: "(J. M. Taylor, 2020)". */
  withInitials?: boolean;
  /**
   * How many surnames to write before "et al." for a work of three or more
   * authors. Absent means the usual one; equal to the number of authors means
   * every name is written out.
   */
  shown?: number;
}

const lower = (value: string) => value.toLowerCase();

/**
 * Works out, for the whole list, which citations need more than the usual
 * short form to stay unambiguous. APA 7 has two such rules:
 *
 *  - First authors who share a surname but not initials are cited with their
 *    initials every time: (J. M. Taylor & Neville, 2020; A. Taylor, 2018).
 *  - Works of three or more authors from the same year that would shorten to
 *    the same "et al." form write out as many surnames as it takes to tell
 *    them apart: Kapoor, Bloom, Montez, et al. (2017) and Kapoor, Bloom,
 *    Zucker, et al. (2017). "Et al." is plural, so it never stands for a single
 *    name — when only the last author differs, every name is written out.
 *
 * Works with identical authors and year are not handled here; the "a"/"b"
 * letters of `yearSuffixes` tell those apart.
 */
export function nameForms(references: readonly DisplayReference[]): Map<string, NameForm> {
  const forms = new Map<string, NameForm>();
  const form = (key: string) => {
    const existing = forms.get(key);
    if (existing) return existing;
    const created: NameForm = {};
    forms.set(key, created);
    return created;
  };

  // Same first-author surname, different initials.
  const bySurname = new Map<string, DisplayReference[]>();
  for (const reference of references) {
    const first = reference.authors[0];
    if (!first || isGroupAuthor(first)) continue;
    const key = lower(surname(first));
    bySurname.set(key, [...(bySurname.get(key) ?? []), reference]);
  }
  for (const group of bySurname.values()) {
    const distinct = new Set(
      group.map((reference) => lower(initials(reference.authors[0] as string)))
    );
    if (distinct.size < 2) continue;
    for (const reference of group) {
      if (initials(reference.authors[0] as string)) form(reference.citationKey).withInitials = true;
    }
  }

  // Three or more authors that shorten to the same "Surname et al. (year)".
  const byShortForm = new Map<string, DisplayReference[]>();
  for (const reference of references) {
    if (reference.authors.length < 3) continue;
    const key = `${lower(surname(reference.authors[0] as string))}\u0000${reference.year ?? 'nd'}`;
    byShortForm.set(key, [...(byShortForm.get(key) ?? []), reference]);
  }
  for (const group of byShortForm.values()) {
    if (group.length < 2) continue;
    const surnames = group.map((reference) => reference.authors.map((a) => lower(surname(a))));

    group.forEach((reference, index) => {
      const own = surnames[index] as string[];
      const differsAt = (n: number) =>
        surnames.every(
          (other, j) =>
            j === index || other.slice(0, n).join('\u0000') !== own.slice(0, n).join('\u0000')
        );

      let n = 2;
      while (n <= own.length && !differsAt(n)) n += 1;
      if (n > own.length) return; // Same authors throughout: a year suffix case.

      // "et al." must stand for at least two names.
      form(reference.citationKey).shown = own.length - n < 2 ? own.length : n;
    });
  }

  return forms;
}

/** A surname, with its initials in front when `nameForms` asks for them. */
function citedName(author: string, withInitials: boolean): string {
  const i = withInitials ? initials(author) : '';
  return i ? `${i} ${surname(author)}` : surname(author);
}

/**
 * How the text names a source, APA 7:
 *
 *  - one author: "Smith"
 *  - two authors: "Smith & Jones" inside parentheses, "Smith and Jones" when
 *    the names are part of the sentence (a narrative citation), every time
 *  - three or more: "Smith et al.", from the very first citation
 *  - a group author: its full name, "American Psychological Association"
 *    (the abbreviation, when it has one, is applied by the caller — see
 *    `labelAuthorDateCitations`)
 *  - no author: the title in title case, in quotation marks when it is part of
 *    a larger work — ("Oil Painting," 2019) for an entry listed as "Oil
 *    painting". A work that stands alone is italic; see `italicName`.
 *
 * Suffixes such as "Jr." are never part of the name in the text.
 * `form` carries the list-wide adjustments from `nameForms`.
 */
export function inTextName(
  reference: DisplayReference,
  narrative = false,
  form: NameForm = {}
): string {
  const { authors } = reference;
  if (authors.length === 0) {
    const title = toTitleCase(reference.title.trim());
    return QUOTED_TITLE_TYPES.has(reference.type ?? 'misc') ? `"${title}"` : title;
  }

  const joiner = narrative ? 'and' : '&';
  const names = authors.map((author, index) =>
    citedName(author, index === 0 && Boolean(form.withInitials))
  );

  if (names.length === 1) return names[0] as string;
  if (names.length === 2) return `${names[0]} ${joiner} ${names[1]}`;

  const shown = form.shown ?? 1;
  if (shown >= names.length) {
    return `${names.slice(0, -1).join(', ')}, ${joiner} ${names[names.length - 1]}`;
  }
  if (shown > 1) return `${names.slice(0, shown).join(', ')}, et al.`;
  return `${names[0]} et al.`;
}

/**
 * True when the text names a source by an italic title: an authorless work
 * that stands alone, such as a book, report or web page — (*Design for
 * Eternity*, 2015). A part of a larger work is quoted instead.
 */
export function italicName(reference: DisplayReference): boolean {
  return reference.authors.length === 0 && !QUOTED_TITLE_TYPES.has(reference.type ?? 'misc');
}

/**
 * The group author a reference's abbreviation stands for, or undefined when
 * the abbreviation does not apply: only a sole group author is abbreviated.
 */
function abbreviatedGroup(reference: DisplayReference): string | undefined {
  const abbreviation = reference.authorAbbreviation?.trim();
  const author = reference.authors[0];
  if (!abbreviation || reference.authors.length !== 1 || !author || !isGroupAuthor(author)) {
    return undefined;
  }
  return lower(surname(author));
}

/**
 * The name followed by the comma that separates it from the year. A quoted
 * title takes the comma inside its closing quotation mark, as American
 * punctuation does: ("Oil Painting," 2019).
 */
function withComma(name: string): string {
  return name.endsWith('"') ? `${name.slice(0, -1)},"` : `${name},`;
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
  /** The name is an italic title. */
  italic: boolean;
  year: string;
  locator?: string;
}

/**
 * Writes one parenthetical from the sources it cites, as segments so that an
 * italic title can stay italic.
 *
 * Sources are listed in reference-list order, separated by semicolons. Works
 * by the same authors are collapsed onto one name — "(Smith, 2019, 2020)" —
 * unless a page number would then be ambiguous about which work it belongs to.
 */
function formatParenthetical(entries: GroupEntry[]): ReferenceSegment[] {
  const sorted = [...entries].sort((a, b) => compareAuthorDate(a.reference, b.reference));
  const parts: ReferenceSegment[][] = [];
  let previous: GroupEntry | null = null;

  for (const entry of sorted) {
    const canMerge =
      previous !== null && previous.name === entry.name && !previous.locator && !entry.locator;

    if (canMerge) {
      parts[parts.length - 1]?.push(upright(`, ${entry.year}`));
    } else {
      const rest = ` ${entry.year}${entry.locator ? `, ${entry.locator}` : ''}`;
      parts.push(
        entry.italic
          ? [italic(entry.name), upright(`,${rest}`)]
          : [upright(`${withComma(entry.name)}${rest}`)]
      );
    }
    previous = entry;
  }

  return joinSegments([
    upright('('),
    ...parts.flatMap((part, i) => (i === 0 ? part : [upright('; '), ...part])),
    upright(')'),
  ]);
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
 * A group author with an abbreviation is introduced once, at its first
 * citation in the document — "(National Institute of Mental Health [NIMH],
 * 2020)" or "National Institute of Mental Health (NIMH, 2020)" — and every
 * later citation uses the abbreviation alone: "(NIMH, 2020)", "NIMH (2020)".
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
  const forms = nameForms(references);
  /** Group authors whose abbreviation the text has already defined. */
  const introduced = new Set<string>();

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
    /** Abbreviations defined by this citation, recorded once it is written. */
    const defining = new Set<string>();

    for (const occurrence of group) {
      const reference = byKey.get(occurrence.citationKey);
      if (!reference) continue;
      // The same source twice in one parenthetical says nothing the first
      // mention did not, unless the two point at different pages.
      const identity = `${occurrence.citationKey}\u0000${occurrence.locator ?? ''}`;
      if (cited.has(identity)) continue;
      cited.add(identity);

      let name = inTextName(reference, narrative, forms.get(reference.citationKey));
      const abbreviation = reference.authorAbbreviation?.trim();
      const groupAuthor = abbreviatedGroup(reference);
      if (groupAuthor && abbreviation) {
        if (introduced.has(groupAuthor)) {
          name = abbreviation;
        } else {
          // Every work by the group in this citation shares the definition,
          // so "(… [NIMH], 2019, 2020)" still collapses onto one name.
          defining.add(groupAuthor);
          if (!narrative) name = `${name} [${abbreviation}]`;
        }
      }

      entries.push({
        reference,
        name,
        italic: italicName(reference),
        year: inTextYear(reference, suffixes.get(reference.citationKey)),
        locator: occurrence.locator,
      });
    }
    for (const groupAuthor of defining) introduced.add(groupAuthor);

    const leader = labels[index] as CitationLabel;
    let segments: ReferenceSegment[];
    if (entries.length === 0) {
      segments = [upright('(?)')];
      leader.unresolved = true;
    } else if (narrative) {
      const entry = entries[0] as GroupEntry;
      const locator = entry.locator ? `, ${entry.locator}` : '';
      const groupAuthor = abbreviatedGroup(entry.reference);
      // Defined here: "National Institute of Mental Health (NIMH, 2020)".
      const defines = groupAuthor !== undefined && defining.has(groupAuthor);
      const bracket = defines
        ? `(${entry.reference.authorAbbreviation?.trim()}, ${entry.year}${locator})`
        : `(${entry.year}${locator})`;
      segments = [entry.italic ? italic(entry.name) : upright(entry.name), upright(` ${bracket}`)];
    } else {
      segments = formatParenthetical(entries);
      leader.unresolved = group.some((occurrence) => !byKey.has(occurrence.citationKey));
    }
    leader.text = segments.map((segment) => segment.text).join('');
    if (segments.some((segment) => segment.italic)) leader.segments = joinSegments(segments);

    for (let i = index + 1; i < end; i++) {
      (labels[i] as CitationLabel).hidden = true;
    }

    index = end;
  }

  return { numbers: new Map(), order, labels };
}
