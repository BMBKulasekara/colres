/**
 * Display formatting for reference lists.
 *
 * Presentation only — key generation and BibTeX live on the backend, where the
 * export needs them. These are readable approximations of each style, not
 * byte-exact reproductions of a .bst file; the authoritative rendering happens
 * when the document is compiled by the publisher's own class.
 *
 * Entries are returned as *segments* rather than one string because IEEE sets
 * the container title in italics — journal, proceedings or book — while the
 * item title goes in upright type inside quotation marks. A plain string cannot
 * carry that, and the distinction is the most visible thing about an IEEE
 * reference list. `formatReferenceText` flattens the segments where styling is
 * not available.
 */

export type ReferenceType =
  | 'article'
  | 'inproceedings'
  | 'book'
  | 'incollection'
  | 'techreport'
  | 'phdthesis'
  | 'misc';

export interface DisplayReference {
  citationKey: string;
  title: string;
  authors: string[];
  type?: ReferenceType;
  year?: number;
  /** 1-12. IEEE abbreviates it before the year: "Jun. 2014". */
  month?: number;
  venue?: string;
  publisher?: string;
  /** The publisher's or conference's location, e.g. "Cambridge, MA, USA". */
  address?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  /** When the author last opened a web page, as epoch milliseconds. */
  accessed?: number;
  /** Edition of a book, as typed: "5", "2nd", "Rev.". */
  edition?: string;
  /** Editors of the book a chapter or paper appears in. */
  editors?: string[];
  /**
   * The abbreviation a group author goes by in the text, e.g. "NIMH". APA
   * defines it at the first citation — "(National Institute of Mental Health
   * [NIMH], 2020)" — and uses it alone after that. The reference list always
   * spells the name out.
   */
  authorAbbreviation?: string;
}

export type CitationStyle =
  | 'ieee'
  | 'apa'
  | 'harvard'
  | 'mla'
  | 'acm'
  | 'vancouver'
  | 'chicago'
  | 'numeric';

/** What each style is called in the style picker. */
export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  apa: 'APA 7th edition',
  ieee: 'IEEE',
  harvard: 'Harvard (Cite Them Right)',
  mla: 'MLA 9th edition',
  vancouver: 'Vancouver (NLM)',
  acm: 'ACM',
  chicago: 'Chicago',
  numeric: 'Numeric',
};

/** One run of an entry. `italic` marks the container title. */
export interface ReferenceSegment {
  text: string;
  italic?: boolean;
}

/**
 * A group author — an organisation, agency or committee — is written in braces:
 * "{American Psychological Association}". It is the BibTeX convention for a
 * name that must not be split into surname and initials, so the same record
 * exports correctly too. APA spells a group name out in full, never inverted.
 */
export function isGroupAuthor(author: string): boolean {
  return /^\{[^{}]+\}$/.test(author.trim());
}

/** Generational suffixes: "Jr.", "Sr.", and roman numerals up to V. */
const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;

/** "jr" → "Jr.", "iii" → "III" — the form APA prints. */
function normaliseSuffix(suffix: string): string {
  const bare = suffix.replace(/\./g, '').toLowerCase();
  return bare === 'jr' || bare === 'sr'
    ? `${bare[0]?.toUpperCase()}${bare[1]}.`
    : bare.toUpperCase();
}

interface NameParts {
  family: string;
  given: string;
  suffix: string;
}

/**
 * Splits a personal name into family name, given names and a generational
 * suffix. Accepts "Alexander C. Evans Jr.", "Alexander C. Evans, Jr.",
 * "Evans, Alexander C., Jr." and "Evans Jr., Alexander C.". The suffix is
 * never mistaken for the surname, so "Evans Jr." is cited as "Evans".
 */
function nameParts(author: string): NameParts {
  const name = author.trim();
  if (isGroupAuthor(name)) return { family: stripBraces(name).trim(), given: '', suffix: '' };

  if (name.includes(',')) {
    const parts = name.split(',').map((part) => part.trim());
    // "Alexander C. Evans, Jr." — a given-first name with the suffix after a comma.
    if (parts.length === 2 && NAME_SUFFIX.test(parts[1] as string)) {
      const { family, given } = nameParts(parts[0] as string);
      return { family, given, suffix: normaliseSuffix(parts[1] as string) };
    }
    let family = parts[0] ?? '';
    let suffix = parts.slice(2).find((part) => NAME_SUFFIX.test(part)) ?? '';
    // "Evans Jr., Alexander C."
    const familyWords = family.split(/\s+/);
    if (!suffix && familyWords.length > 1 && NAME_SUFFIX.test(familyWords.at(-1) as string)) {
      suffix = familyWords.pop() as string;
      family = familyWords.join(' ');
    }
    return { family, given: parts[1] ?? '', suffix: suffix ? normaliseSuffix(suffix) : '' };
  }

  const words = name.split(/\s+/);
  let suffix = '';
  if (words.length > 2 && NAME_SUFFIX.test(words.at(-1) as string)) {
    suffix = normaliseSuffix(words.pop() as string);
  }
  const family = words.pop() ?? name;
  return { family, given: words.join(' '), suffix };
}

export function surname(author: string): string {
  return nameParts(author).family;
}

/** The given names as typed — "John Kenneth" — or "" for a group author. */
export function givenNames(author: string): string {
  return nameParts(author).given;
}

/** "Jr.", "III", or "" — omitted in text citations, kept in the reference. */
export function nameSuffix(author: string): string {
  return nameParts(author).suffix;
}

/**
 * "J. K." from "John Kenneth Smith". A hyphenated given name keeps its hyphen,
 * "Eva-Maria" → "E.-M.", as APA writes it. A group author has none.
 */
export function initials(author: string): string {
  return nameParts(author)
    .given.split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split('-')
        .filter(Boolean)
        .map((piece) => `${piece[0]?.toUpperCase()}.`)
        .join('-')
    )
    .join(' ');
}

/**
 * Words in a title an author wrapped in braces — "{Freud}" — are kept exactly
 * as typed by every transformation and shown without the braces. It is the
 * BibTeX convention, so a title protected here is protected on export too.
 */
export function stripBraces(value: string): string {
  return value.replace(/[{}]/g, '');
}

/**
 * Words that stay capitalised in sentence case: the first word of the title,
 * the first after a colon, dash or end of sentence, and anything with a
 * capital past its first letter (acronyms and names like "GPUs", "iPhone").
 */
const SENTENCE_BREAK = /[:?!.—–]$/;

/**
 * True when a title reads as Title Case — most of its longer words
 * capitalised — rather than as sentence case already.
 *
 * Only such titles are converted. A title already in sentence case keeps its
 * capitals, because the only ones left in it are proper nouns ("Denver") that
 * no rule can tell apart from a capitalised common word.
 */
function looksTitleCased(words: string[]): boolean {
  let significant = 0;
  let capitalised = 0;
  let atBreak = true;

  for (const word of words) {
    const bare = word.replace(/[^A-Za-z]/g, '');
    if (!atBreak && bare.length >= 4 && !word.startsWith('{')) {
      significant += 1;
      if (/^[A-Z]/.test(bare)) capitalised += 1;
    }
    atBreak = SENTENCE_BREAK.test(word);
  }

  return significant > 0 && capitalised / significant >= 0.6;
}

/** Lowercases one hyphen-separated part unless it is an acronym or a name. */
function lowerPart(part: string): string {
  if (/[A-Z]/.test(part.slice(1))) return part;
  if (part === 'I') return part;
  return part.toLowerCase();
}

/**
 * APA's sentence case for the title of a work: "Kisses of Death in the
 * Graduate School Application Process" becomes "Kisses of death in the
 * graduate school application process".
 *
 * Braced words are kept as typed. See `looksTitleCased` for why a title
 * already in sentence case is left alone.
 */
export function toSentenceCase(title: string): string {
  const tokens = title.split(/(\{[^}]*\}|\s+)/).filter((token) => token !== '');
  const words = tokens.filter((token) => !/^\s+$/.test(token));

  if (!looksTitleCased(words)) return stripBraces(title);

  let atBreak = true;
  return tokens
    .map((token) => {
      if (/^\s+$/.test(token)) return token;
      if (token.startsWith('{')) {
        atBreak = false;
        return stripBraces(token);
      }

      const opensSentence = atBreak;
      atBreak = SENTENCE_BREAK.test(token);

      return token
        .split('-')
        .map((part, index) =>
          opensSentence && index === 0
            ? part.replace(/[A-Za-z]/, (letter) => letter.toUpperCase())
            : lowerPart(part)
        )
        .join('-');
    })
    .join('');
}

/**
 * The minor words APA leaves lowercase in title case: short conjunctions,
 * articles and short prepositions — three letters or fewer. Every other word
 * is capitalised, and so is any word opening the title or a subtitle.
 */
const APA_MINOR_WORDS = new Set([
  'and',
  'as',
  'but',
  'for',
  'if',
  'nor',
  'or',
  'so',
  'yet',
  'a',
  'an',
  'the',
  'at',
  'by',
  'in',
  'of',
  'off',
  'on',
  'per',
  'to',
  'up',
  'via',
]);

function capitalise(part: string): string {
  return part.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
}

/**
 * APA's title case, used when a title stands in for the author in the text:
 * a reference list's "Oil painting" is cited as ("Oil Painting," 2019).
 *
 * Both halves of a hyphenated major word are capitalised ("Self-Report").
 * Braced words, and words that already carry an inner capital, are kept as
 * typed.
 */
export function toTitleCase(
  title: string,
  minorWords: ReadonlySet<string> = APA_MINOR_WORDS
): string {
  const tokens = title.split(/(\{[^}]*\}|\s+)/).filter((token) => token !== '');
  let atBreak = true;

  return tokens
    .map((token) => {
      if (/^\s+$/.test(token)) return token;
      if (token.startsWith('{')) {
        atBreak = false;
        return stripBraces(token);
      }

      const opensSentence = atBreak;
      atBreak = SENTENCE_BREAK.test(token);
      const bare = token.replace(/[^A-Za-z]/g, '').toLowerCase();

      if (!opensSentence && minorWords.has(bare)) return token.toLowerCase();
      // Split on hyphens and en dashes, keeping them, so "tibia–basitarsis"
      // becomes "Tibia–Basitarsis".
      return token
        .split(/([-–])/)
        .map((part) => (/[A-Z]/.test(part.slice(1)) ? part : capitalise(part)))
        .join('');
    })
    .join('');
}

/** "5" → "5th", "2" → "2nd"; anything else ("Rev.", "2nd") as typed. */
function editionLabel(edition: string): string {
  const cleaned = edition.trim().replace(/\s*(ed\.?|edn\.?|edition)$/i, '');
  if (!/^\d+$/.test(cleaned)) return cleaned;
  const n = Number(cleaned);
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th';
  return `${n}${suffix}`;
}

/**
 * "J. K. Smith" — initials before the surname, then any suffix. IEEE sets the
 * suffix off with a comma, "A. C. Evans, Jr."; APA, writing a name in normal
 * order, does not: "A. C. Evans Jr.".
 */
function initialed(author: string, suffixSeparator = ', '): string {
  const i = initials(author);
  const suffix = nameSuffix(author);
  const name = i ? `${i} ${surname(author)}` : surname(author);
  return suffix ? `${name}${suffixSeparator}${suffix}` : name;
}

/**
 * IEEE's author rule: list up to six names; from the seventh on, give only the
 * first author followed by "et al."
 *
 * Note that the cut is not "show six then et al." — a seven-author paper is
 * credited to its first author alone, not to six of the seven.
 */
const IEEE_MAX_AUTHORS = 6;

/**
 * The author list, as segments: "et al." is italic, so this cannot be a string.
 *
 * Names are separated by commas with "and" before the last, and the comma
 * before that "and" is kept — IEEE uses the serial comma here, so three
 * authors read "A. Bleda, M. L. Reyna, and J. Gabriel-Rodriguez". Two authors
 * take no comma at all, because there is no list to separate.
 */
function ieeeAuthors(authors: string[]): ReferenceSegment[] {
  if (authors.length === 0) return [upright('Unknown author')];

  if (authors.length > IEEE_MAX_AUTHORS) {
    return [upright(`${initialed(authors[0] as string)} `), italic('et al.')];
  }

  const names = authors.map((name) => initialed(name));
  if (names.length === 1) return [upright(names[0] as string)];
  if (names.length === 2) return [upright(`${names[0]} and ${names[1]}`)];

  const last = names.pop() as string;
  return [upright(`${names.join(', ')}, and ${last}`)];
}

/**
 * Month abbreviations. Three letters and a period, except May, which is
 * already three letters and so takes none.
 */
const IEEE_MONTHS = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May',
  'Jun.',
  'Jul.',
  'Aug.',
  'Sep.',
  'Oct.',
  'Nov.',
  'Dec.',
] as const;

function ieeeMonth(month: number | undefined): string | undefined {
  if (!month || month < 1 || month > 12) return undefined;
  return IEEE_MONTHS[month - 1];
}

/** "Jun. 2014", or just the year where no month is recorded. */
function ieeeDate(year: number | undefined, month: number | undefined): string {
  const y = year ? String(year) : 'n.d.';
  const m = ieeeMonth(month);
  return m ? `${m} ${y}` : y;
}

/**
 * "Jul. 18, 2022" — the shape IEEE uses inside "(accessed …)".
 *
 * Read in UTC, because the stored value came from a date with no time of day:
 * a date picker's "2022-07-18" parses to UTC midnight, which is the previous
 * day in local terms anywhere west of Greenwich.
 */
function ieeeAccessDate(timestamp: number): string | undefined {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${IEEE_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/**
 * IEEE's standard word abbreviations, applied to the names of journals,
 * conferences, publishers and universities.
 *
 * Deliberately not applied to titles: IEEE abbreviates these words only in the
 * names of *containers*, never in the title of the work itself, so "Journal"
 * in an article's own title stays spelled out.
 *
 * Keys are lowercase and matched whole-word, which makes the transformation
 * idempotent — a venue already entered as "J. Comput. Math." contains no word
 * in this table and comes back untouched.
 */
const IEEE_ABBREVIATIONS: Record<string, string> = {
  advanced: 'Adv.',
  american: 'Amer.',
  annals: 'Ann.',
  annual: 'Annu.',
  applications: 'Appl.',
  applied: 'Appl.',
  association: 'Assoc.',
  bulletin: 'Bull.',
  computational: 'Comp.',
  computer: 'Comp.',
  computers: 'Comp.',
  computing: 'Comp.',
  conference: 'Conf.',
  department: 'Dept.',
  digest: 'Dig.',
  electrical: 'Elect.',
  electronic: 'Electron.',
  electronics: 'Electron.',
  engineering: 'Eng.',
  industrial: 'Ind.',
  information: 'Inf.',
  institute: 'Inst.',
  international: 'Int.',
  journal: 'J.',
  letters: 'Lett.',
  machine: 'Mach.',
  magazine: 'Mag.',
  management: 'Manage.',
  mathematical: 'Math.',
  mathematics: 'Math.',
  national: 'Nat.',
  proceedings: 'Proc.',
  quarterly: 'Quart.',
  report: 'Rep.',
  research: 'Res.',
  review: 'Rev.',
  science: 'Sci.',
  sciences: 'Sci.',
  society: 'Soc.',
  statistics: 'Statist.',
  symposium: 'Symp.',
  systems: 'Syst.',
  technical: 'Tech.',
  technology: 'Technol.',
  telecommunications: 'Telecommun.',
  transactions: 'Trans.',
  university: 'Univ.',
};

/**
 * Abbreviates the words IEEE abbreviates in a container name.
 *
 * Only whole alphabetic words are considered, so punctuation, digits and
 * anything hyphenated or already shortened passes through as typed. The
 * author's stored value is never changed — this is a display transformation,
 * the same way the bracketed number is.
 */
function abbreviateContainer(name: string): string {
  return name.replace(/[A-Za-z]+/g, (word) => {
    const replacement = IEEE_ABBREVIATIONS[word.toLowerCase()];
    if (!replacement) return word;
    // A lowercase word inside a name is a preposition or article that the
    // table happens to share a spelling with; leave it alone.
    return word[0] === word[0]?.toUpperCase() ? replacement : word;
  });
}

/**
 * IEEE sets a page range with an en dash, not the hyphen most metadata
 * sources supply. Single pages and anything that is not a plain numeric range
 * are left as they are.
 */
function enDashPages(pages: string): string {
  return pages.replace(/(\d)\s*-{1,2}\s*(\d)/g, '$1–$2');
}

/** "pp. 207–217", "p. 12", or "Art. no. e0193972" for an article-numbered journal. */
function ieeePages(pages: string): string {
  const { range, article } = pageField(pages);
  if (article) return `Art. no. ${article}`;
  return `${range && isRange(range) ? 'pp.' : 'p.'} ${range ?? pages}`;
}

/** "A. Vaswani, N. Shazeer, et al." — the shape the other numbered styles use. */
function initialsFirst(authors: string[], max = 6): string {
  if (authors.length === 0) return 'Unknown author';
  const shown = authors.slice(0, max).map((name) => initialed(name));
  return authors.length > max ? `${shown.join(', ')}, et al.` : shown.join(', ');
}

/** "Vaswani, A., & Shazeer, N." — the APA shape. */
function surnameFirst(authors: string[], max = 20): string {
  if (authors.length === 0) return 'Unknown author';
  const shown = authors.slice(0, max).map((a) => {
    const i = initials(a);
    return i ? `${surname(a)}, ${i}` : surname(a);
  });
  if (shown.length === 1) return shown[0] as string;
  const last = shown.pop();
  return `${shown.join(', ')}, & ${last}`;
}

function withPeriod(value: string): string {
  return value.endsWith('.') ? value : `${value}.`;
}

/** Drops empty segments and merges neighbours that share a style. */
export function joinSegments(
  segments: (ReferenceSegment | null | undefined)[]
): ReferenceSegment[] {
  const out: ReferenceSegment[] = [];

  for (const segment of segments) {
    if (!segment || !segment.text) continue;
    const previous = out[out.length - 1];
    if (previous && Boolean(previous.italic) === Boolean(segment.italic)) {
      previous.text += segment.text;
    } else {
      out.push({ ...segment });
    }
  }

  return out;
}

export const upright = (text: string): ReferenceSegment => ({ text });
export const italic = (text: string): ReferenceSegment => ({ text, italic: true });

/**
 * A reference with no publication of its own to sit in — no journal, no
 * proceedings, no publisher — but with a URL is a web page, and IEEE sets
 * those quite differently from everything else: periods rather than commas
 * between the parts, nothing in italics, and an access date at the end.
 *
 * The type alone cannot decide this, because a web page is stored as `misc`
 * and so is anything else that fits nowhere; the URL is what distinguishes
 * "a page on a website" from "a record we know little about".
 */
function isWebPage(reference: DisplayReference): boolean {
  const type = reference.type ?? 'misc';
  return type === 'misc' && Boolean(reference.url);
}

/**
 * A web page:
 *
 *   B. Fung. "Amazon offers concessions." CNN.com.
 *   https://… (accessed Jul. 18, 2022).
 *
 * The site name is upright, not italic: it is the publisher of the page, not
 * a publication the page appeared in. The access date replaces the publication
 * date a printed source would carry, and is omitted rather than invented when
 * the author has not recorded one.
 */
function formatIeeeWebPage(reference: DisplayReference): ReferenceSegment[] {
  const { title, authors, url, venue, publisher, accessed } = reference;
  const site = venue ?? publisher;
  const accessDate = accessed ? ieeeAccessDate(accessed) : undefined;

  return joinSegments([
    ...ieeeAuthors(authors),
    upright(`. "${withPeriod(title)}"`),
    site ? upright(` ${abbreviateContainer(site)}.`) : null,
    url ? upright(` ${url}`) : null,
    accessDate ? upright(` (accessed ${accessDate}).`) : upright('.'),
  ]);
}

/**
 * IEEE entry shapes, which differ by what kind of thing is being cited.
 *
 * The item title is quoted and upright; the container it appeared in is italic.
 * A book has no container, so its own title becomes the italic part and takes
 * no quotation marks at all — which is why rules about quoting titles and
 * rules about italicising them only make sense read together.
 */
function formatIeee(reference: DisplayReference): ReferenceSegment[] {
  const { title, authors, year, month, venue, volume, number, pages, publisher, address, doi } =
    reference;
  const type = reference.type ?? 'misc';
  const date = ieeeDate(year, month);
  const authorList = ieeeAuthors(authors);
  const container = venue ? abbreviateContainer(venue) : undefined;

  if (isWebPage(reference)) return formatIeeeWebPage(reference);

  /**
   * Everything from the date to the end of the entry, as one segment.
   *
   * Built as a single string rather than assembled from pieces because both
   * of its joints depend on what came before: the date is preceded by a comma
   * only when something separable precedes it — with no journal, no volume and
   * no pages, `"A title," 2014.` is correct and `"A title,", 2014.` is not —
   * and the closing period must not be doubled onto a date that already ends
   * in one, which "n.d." does.
   */
  const closing = (precededByFields: boolean) => {
    const lead = precededByFields ? ', ' : ' ';
    return upright(withPeriod(doi ? `${lead}${date}, doi: ${doi}` : `${lead}${date}`));
  };

  switch (type) {
    // A whole book: the title is the italic element and is not quoted, and the
    // imprint reads "City, Country: Publisher".
    case 'book': {
      const imprint = [address, publisher].filter(Boolean).join(': ');
      const edition = reference.edition ? `, ${editionLabel(reference.edition)} ed.` : '';
      return joinSegments([
        ...authorList,
        upright(', '),
        italic(title),
        edition ? upright(edition) : null,
        imprint ? upright(`${edition ? ' ' : '. '}${abbreviateContainer(imprint)}`) : null,
        upright(withPeriod(`, ${date}`)),
      ]);
    }

    // Papers in proceedings and chapters in edited books are both "in <book>".
    // IEEE gives the location and date of the meeting before the page range.
    case 'inproceedings':
    case 'incollection':
      return joinSegments([
        ...authorList,
        upright(`, "${title},"`),
        container ? upright(' in ') : null,
        container ? italic(container) : null,
        reference.edition ? upright(`, ${editionLabel(reference.edition)} ed.`) : null,
        reference.editors?.length
          ? upright(
              `, ${reference.editors.map((name) => initialed(name)).join(', ')}, ${reference.editors.length > 1 ? 'Eds.' : 'Ed.'}`
            )
          : null,
        address ? upright(`, ${address}`) : null,
        publisher ? upright(`, ${abbreviateContainer(publisher)}`) : null,
        pages ? upright(`, ${ieeePages(pages)}`) : null,
        closing(Boolean(container || address || publisher || pages)),
      ]);

    case 'phdthesis':
      return joinSegments([
        ...authorList,
        upright(`, "${title}," Ph.D. dissertation`),
        container ? upright(`, ${container}`) : null,
        address ? upright(`, ${address}`) : null,
        upright(withPeriod(`, ${date}`)),
      ]);

    case 'techreport':
      return joinSegments([
        ...authorList,
        upright(`, "${title},"`),
        container ? upright(` ${container}`) : null,
        publisher && !container ? upright(` ${abbreviateContainer(publisher)}`) : null,
        address ? upright(`, ${address}`) : null,
        number ? upright(`, Rep. ${number}`) : null,
        upright(withPeriod(`, ${date}`)),
      ]);

    // Journal articles, and anything whose type we do not know.
    default:
      return joinSegments([
        ...authorList,
        upright(`, "${title},"`),
        container ? upright(' ') : null,
        container ? italic(container) : null,
        volume ? upright(`, vol. ${volume}`) : null,
        number ? upright(`, no. ${number}`) : null,
        pages ? upright(`, ${ieeePages(pages)}`) : null,
        closing(Boolean(container || volume || number || pages)),
      ]);
  }
}

/* -------------------------------------------------------------------------- */
/*  APA (7th edition)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * APA lists up to 20 authors. From the 21st on it gives the first 19, an
 * ellipsis, and the final author — and no ampersand, because the ellipsis
 * already says the list is incomplete.
 */
const APA_MAX_AUTHORS = 20;

const APA_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "Appleby, D. C." — surname first, then initials. */
function apaName(author: string): string {
  const i = initials(author);
  const suffix = nameSuffix(author);
  const name = i ? `${surname(author)}, ${i}` : surname(author);
  // "Evans, A. C., Jr." — the suffix follows the initials after a comma.
  return suffix ? `${name}, ${suffix}` : name;
}

/**
 * "Appleby, D. C., & Appleby, K. M." — the comma before the ampersand is kept
 * even for two authors, which is where APA differs from most other styles.
 */
function apaAuthors(authors: string[]): string {
  const names = authors.map(apaName);
  if (names.length === 1) return names[0] as string;

  if (names.length > APA_MAX_AUTHORS) {
    return `${names.slice(0, APA_MAX_AUTHORS - 1).join(', ')}, . . . ${names[names.length - 1]}`;
  }

  const last = names.pop() as string;
  return `${names.join(', ')}, & ${last}`;
}

/**
 * Closes an element with a period unless it already ends in terminal
 * punctuation: a title ending in a question mark keeps it and takes no period.
 */
function endSentence(value: string): string {
  return /[.?!]$/.test(value.trim()) ? value : `${value}.`;
}

/**
 * "(2006)", "(2006a)", "(n.d.-a)", or — for a web page, where the date is part
 * of identifying the version — "(2019, June)".
 */
function apaDate(reference: DisplayReference, yearSuffix = '', withMonth = false): string {
  const { year, month } = reference;
  if (!year) return yearSuffix ? `(n.d.-${yearSuffix})` : '(n.d.)';
  const m = withMonth && month && month >= 1 && month <= 12 ? APA_MONTHS[month - 1] : undefined;
  return m ? `(${year}${yearSuffix}, ${m})` : `(${year}${yearSuffix})`;
}

/** A DOI as the https://doi.org/ URL APA asks for, whatever form it was stored in. */
export function doiUrl(doi: string): string {
  const trimmed = doi.trim();
  // Older forms — "doi:10…", "http://dx.doi.org/10…", "http://doi.org/10…" —
  // are all updated to the current https://doi.org/ form.
  const resolver = /^https?:\/\/(dx\.)?doi\.org\//i;
  if (resolver.test(trimmed)) return `https://doi.org/${trimmed.replace(resolver, '')}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://doi.org/${trimmed.replace(/^doi:\s*/i, '')}`;
}

/** "February 26, 2020", read in UTC for the reason given at `ieeeAccessDate`. */
function apaRetrievalDate(timestamp: number): string | undefined {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${APA_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/**
 * The trailing link. A DOI wins over a URL when both are known. APA puts no
 * period after either, since the period could be taken as part of the link.
 *
 * An undated web page is one designed to change, so APA adds the date it was
 * read: "Retrieved January 9, 2020, from https://…". Dated pages do not
 * take one.
 */
function apaLink(reference: DisplayReference): ReferenceSegment | null {
  if (reference.doi) return upright(` ${doiUrl(reference.doi)}`);
  if (!reference.url) return null;

  const retrieved =
    isWebPage(reference) && !reference.year && reference.accessed
      ? apaRetrievalDate(reference.accessed)
      : undefined;
  return upright(
    retrieved ? ` Retrieved ${retrieved}, from ${reference.url}` : ` ${reference.url}`
  );
}

/**
 * True when the publisher or site named in the source element is the group
 * that wrote the work. APA then leaves it out, so the name appears only once:
 * "American Psychiatric Association. (2022). Diagnostic and statistical…"
 */
function sameAsAuthor(authors: string[], outlet: string): boolean {
  if (authors.length !== 1) return false;
  const normalise = (value: string) =>
    stripBraces(value)
      .trim()
      .replace(/^the\s+/i, '')
      .toLowerCase();
  return normalise(surname(authors[0] as string)) === normalise(outlet);
}

/**
 * Editors in the "In …" of a chapter: initials first, "&" before the last,
 * and a comma before it only when there are three or more.
 */
function apaEditors(editors: string[]): string {
  const names = editors.map((editor) => initialed(editor, ' '));
  const list =
    names.length <= 2
      ? names.join(' & ')
      : `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  return `${list} (${names.length > 1 ? 'Eds.' : 'Ed.'})`;
}

/** An italic title closed with a period, the period itself left upright. */
function italicTitle(title: string, trailing = ''): ReferenceSegment[] {
  const closed = endSentence(`${title}${trailing}`);
  // Only the title is italic; a trailing bracket or period is not.
  return [italic(title), upright(closed.slice(title.length))];
}

/**
 * APA reference entries, by kind of source.
 *
 * APA italicises whichever element a reader would look for on a shelf: the
 * journal and its volume number for an article, the book for a chapter or a
 * conference paper, and the work's own title for anything that stands alone
 * — a book, a report, a thesis, a web page. Article titles are never quoted.
 *
 * When there is no author, the title moves into the author position and the
 * date follows it, so the entry still alphabetises by its first element.
 */
function formatApa(reference: DisplayReference, yearSuffix = ''): ReferenceSegment[] {
  const { authors, venue, volume, number, pages, publisher } = reference;
  // A work's own title is in sentence case; a journal's name keeps its capitals.
  const title = toSentenceCase(reference.title);
  const edition = reference.edition ? `${editionLabel(reference.edition)} ed.` : '';
  const type = reference.type ?? 'misc';
  const webPage = isWebPage(reference);
  const date = apaDate(reference, yearSuffix, webPage);

  let titleSegments: ReferenceSegment[];
  let source: (ReferenceSegment | null)[];

  switch (type) {
    case 'article':
      titleSegments = [upright(endSentence(title))];
      source = venue
        ? [
            upright(' '),
            italic(venue),
            volume ? upright(', ') : null,
            volume ? italic(volume) : null,
            number ? upright(`(${number})`) : null,
            pages ? upright(`, ${enDashPages(pages)}`) : null,
            upright('.'),
          ]
        : [];
      break;

    // "In E. E. Editor (Ed.), Book title (2nd ed., pp. 1–10). Publisher." An
    // edited book's title is a work's title, so it is in sentence case too;
    // a proceedings title is the name of a publication, and keeps its capitals.
    case 'inproceedings':
    case 'incollection': {
      titleSegments = [upright(endSentence(title))];
      const container = venue && type === 'incollection' ? toSentenceCase(venue) : venue;
      const details = [edition, pages ? `pp. ${enDashPages(pages)}` : '']
        .filter(Boolean)
        .join(', ');
      const editors = reference.editors?.length ? `${apaEditors(reference.editors)}, ` : '';
      source = container
        ? [
            upright(` In ${editors}`),
            italic(container),
            upright(details ? ` (${details}).` : '.'),
            publisher ? upright(` ${endSentence(publisher)}`) : null,
          ]
        : [publisher ? upright(` ${endSentence(publisher)}`) : null];
      break;
    }

    case 'techreport': {
      titleSegments = italicTitle(title, number ? ` (Report No. ${number})` : '');
      const issuer = venue || publisher;
      source = [
        issuer && !sameAsAuthor(authors, issuer) ? upright(` ${endSentence(issuer)}`) : null,
      ];
      break;
    }

    case 'phdthesis': {
      const institution = venue || publisher;
      titleSegments = italicTitle(
        title,
        institution ? ` [Doctoral dissertation, ${institution}]` : ' [Doctoral dissertation]'
      );
      source = [];
      break;
    }

    // Books, web pages, and anything we know little about stand alone, so
    // their own title is the italic element.
    default: {
      titleSegments = italicTitle(title, type === 'book' && edition ? ` (${edition})` : '');
      const outlet = webPage ? venue || publisher : publisher || venue;
      source = [
        outlet && !sameAsAuthor(authors, outlet) ? upright(` ${endSentence(outlet)}`) : null,
      ];
    }
  }

  const lead: (ReferenceSegment | null)[] =
    authors.length > 0
      ? [upright(`${endSentence(apaAuthors(authors))} ${date}. `), ...titleSegments]
      : [...titleSegments, upright(` ${date}.`)];

  return joinSegments([...lead, ...source, apaLink(reference)]);
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers for the styles below                                        */
/* -------------------------------------------------------------------------- */

/**
 * The page field splits two ways: a page range, or — for journals that number
 * articles instead of paginating them — "Article e0193972". Each style prints
 * the two differently, so they are told apart once, here.
 */
function pageField(pages: string | undefined): { range?: string; article?: string } {
  const value = pages?.trim();
  if (!value) return {};
  const article = /^(?:article|art\.?\s*no\.?)\s*(.+)$/i.exec(value);
  return article ? { article: article[1] } : { range: enDashPages(value) };
}

/** True when a page field names more than one page. */
function isRange(pages: string): boolean {
  return /[–,-]/.test(pages);
}

/** "18 July 2022", read in UTC for the reason given at `ieeeAccessDate`. */
function dayMonthYear(
  timestamp: number,
  months: readonly string[] = APA_MONTHS
): string | undefined {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "A, B and C" — no comma before the last name. */
function listWithAnd(names: string[], joiner = 'and'): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}`;
}

/* -------------------------------------------------------------------------- */
/*  Harvard (Cite Them Right, 12th edition)                                    */
/* -------------------------------------------------------------------------- */

/** "Smith, J.K." — Harvard closes up the initials. */
function harvardName(author: string): string {
  const i = initials(author).replace(/\. /g, '.');
  const suffix = nameSuffix(author);
  const name = i ? `${surname(author)}, ${i}` : surname(author);
  return suffix ? `${name}, ${suffix}` : name;
}

/** "Smith, J., Jones, K. and Brown, L." — every author, "and" before the last. */
function harvardAuthors(authors: string[]): string {
  return listWithAnd(authors.map(harvardName));
}

/** Editors in the "in …" of a chapter: "Oliver, M.B. and Raney, A.A. (eds)". */
function harvardEditors(editors: string[]): string {
  return `${listWithAnd(editors.map(harvardName))} (${editors.length > 1 ? 'eds' : 'ed.'})`;
}

/** "2nd edn." */
function harvardEdition(edition: string | undefined): string {
  return edition ? `${editionLabel(edition)} edn.` : '';
}

/**
 * "Available at: https://doi.org/… " for a DOI, or "Available at: URL
 * (Accessed: 18 July 2022)" for a web address, which may change.
 */
function harvardAvailability(reference: DisplayReference): ReferenceSegment | null {
  if (reference.doi) return upright(` Available at: ${doiUrl(reference.doi)}`);
  if (!reference.url) return null;
  const accessed = reference.accessed ? dayMonthYear(reference.accessed) : undefined;
  return upright(` Available at: ${reference.url}${accessed ? ` (Accessed: ${accessed})` : ''}.`);
}

/**
 * Harvard reference entries, following Cite Them Right:
 *
 *   Grady, J.S., Her, M., Moreno, G., Perez, C. and Yelinek, J. (2019)
 *   'Emotions in storybooks', Psychology of Popular Media Culture, 8(3),
 *   pp. 207–217. Available at: https://doi.org/10.1037/ppm0000185
 *
 * The year follows the authors without a full stop, the title of a part of a
 * larger work sits in single quotation marks, and the larger work — journal,
 * book, proceedings — is italic. A work that stands alone has its own title
 * in italics. Titles keep the capitals they were entered with.
 */
function formatHarvard(reference: DisplayReference, yearSuffix = ''): ReferenceSegment[] {
  const { authors, venue, volume, number, publisher, address } = reference;
  const title = stripBraces(reference.title).trim();
  const type = reference.type ?? 'misc';
  const year = reference.year
    ? `${reference.year}${yearSuffix}`
    : `no date${yearSuffix ? ` ${yearSuffix}` : ''}`;
  const { range, article } = pageField(reference.pages);
  const pages = range
    ? `${isRange(range) ? 'pp.' : 'p.'} ${range}`
    : article
      ? `article ${article}`
      : '';
  const imprint = [address, publisher].filter(Boolean).join(': ');
  const edition = harvardEdition(reference.edition);

  const lead: ReferenceSegment[] =
    authors.length > 0 ? [upright(`${harvardAuthors(authors)} (${year}) `)] : [];
  // With no author, the title moves to the front and the year follows it.
  const titleThenYear = (segment: ReferenceSegment) =>
    authors.length > 0 ? [segment] : [segment, upright(` (${year})`)];

  let body: (ReferenceSegment | null)[];
  switch (type) {
    case 'article':
      body = [
        ...titleThenYear(upright(`'${title}'`)),
        venue ? upright(', ') : null,
        venue ? italic(venue) : null,
        volume ? upright(`, ${volume}${number ? `(${number})` : ''}`) : null,
        pages ? upright(`, ${pages}`) : null,
        upright('.'),
      ];
      break;

    case 'inproceedings':
    case 'incollection':
      body = [
        ...titleThenYear(upright(`'${title}'`)),
        upright(', in '),
        reference.editors?.length ? upright(`${harvardEditors(reference.editors)} `) : null,
        venue ? italic(venue) : null,
        upright('.'),
        edition ? upright(` ${edition}`) : null,
        imprint ? upright(` ${imprint}`) : null,
        pages ? upright(`${imprint ? ',' : ''} ${pages}`) : null,
        imprint || pages ? upright('.') : null,
      ];
      break;

    case 'phdthesis':
      body = [
        ...titleThenYear(italic(title)),
        upright('. PhD thesis.'),
        venue || publisher ? upright(` ${endSentence((venue || publisher) as string)}`) : null,
      ];
      break;

    case 'techreport': {
      const issuer = venue || publisher;
      body = [
        ...titleThenYear(italic(title)),
        upright('.'),
        number ? upright(` Report ${number}.`) : null,
        issuer && !sameAsAuthor(authors, issuer)
          ? upright(` ${endSentence([address, issuer].filter(Boolean).join(': '))}`)
          : null,
      ];
      break;
    }

    case 'book':
      body = [
        ...titleThenYear(italic(title)),
        upright('.'),
        edition ? upright(` ${edition}`) : null,
        imprint && !sameAsAuthor(authors, publisher ?? '')
          ? upright(` ${endSentence(imprint)}`)
          : null,
      ];
      break;

    default:
      body = [
        ...titleThenYear(italic(title)),
        upright('.'),
        !reference.url && (publisher || venue)
          ? upright(` ${endSentence((publisher || venue) as string)}`)
          : null,
      ];
  }

  return joinSegments([...lead, ...body, harvardAvailability(reference)]);
}

/* -------------------------------------------------------------------------- */
/*  MLA (9th edition)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * MLA leaves every preposition lowercase in a title, however long, along with
 * articles, coordinating conjunctions, and the "to" of an infinitive.
 */
const MLA_MINOR_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'for',
  'nor',
  'or',
  'so',
  'yet',
  'about',
  'above',
  'across',
  'after',
  'against',
  'along',
  'among',
  'around',
  'as',
  'at',
  'before',
  'behind',
  'below',
  'beneath',
  'beside',
  'between',
  'beyond',
  'by',
  'despite',
  'down',
  'during',
  'except',
  'for',
  'from',
  'in',
  'inside',
  'into',
  'like',
  'near',
  'of',
  'off',
  'on',
  'onto',
  'out',
  'outside',
  'over',
  'past',
  'per',
  'since',
  'through',
  'throughout',
  'to',
  'toward',
  'towards',
  'under',
  'underneath',
  'until',
  'up',
  'upon',
  'via',
  'with',
  'within',
  'without',
]);

/** MLA's short month names: "Sept." and the unabbreviated May, June and July. */
const MLA_MONTHS = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
] as const;

export function mlaTitleCase(title: string): string {
  return toTitleCase(title, MLA_MINOR_WORDS);
}

/**
 * MLA shortens the second number of a page range to its last two digits when
 * nothing more is needed: 207–17, 1879–98, but 98–110 and 1296–1301.
 */
export function mlaPageRange(pages: string): string {
  return enDashPages(pages).replace(/(\d+)–(\d+)/g, (whole, start: string, end: string) => {
    if (Number(start) < 100 || start.length !== end.length) return whole;
    let keep = 2;
    while (
      keep < end.length &&
      start.slice(0, end.length - keep) !== end.slice(0, end.length - keep)
    ) {
      keep += 1;
    }
    return `${start}–${end.slice(end.length - keep)}`;
  });
}

/** "Smith, John" for the first author; "John Smith" for any other. */
function mlaName(author: string, inverted: boolean): string {
  if (isGroupAuthor(author)) return surname(author);
  const given = givenNames(author);
  const suffix = nameSuffix(author);
  if (!given) return suffix ? `${surname(author)}, ${suffix}` : surname(author);
  return inverted
    ? `${surname(author)}, ${given}${suffix ? `, ${suffix}` : ''}`
    : `${given} ${surname(author)}${suffix ? ` ${suffix}` : ''}`;
}

/**
 * One author: "Smith, John." Two: "Smith, John, and Kate Jones." Three or
 * more: "Smith, John, et al." — MLA never lists a third name.
 */
function mlaAuthors(authors: string[]): string {
  const first = mlaName(authors[0] as string, true);
  if (authors.length === 1) return first;
  if (authors.length === 2) return `${first}, and ${mlaName(authors[1] as string, false)}`;
  return `${first}, et al.`;
}

/** "edited by John Smith and Kate Jones" — names in normal order. */
function mlaEditors(editors: string[]): string {
  const names = editors.map((editor) => mlaName(editor, false));
  const list =
    names.length <= 2
      ? names.join(' and ')
      : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
  return `edited by ${list}`;
}

/** MLA prints a URL without its "https://"; a DOI keeps its doi.org form. */
function mlaLocation(reference: DisplayReference): string | undefined {
  if (reference.doi) return doiUrl(reference.doi);
  return reference.url?.replace(/^https?:\/\//i, '');
}

/**
 * MLA 9 entries, built from the core elements in their fixed order — author,
 * title of source, title of container, other contributors, version, number,
 * publisher, publication date, location — each followed by the punctuation
 * the handbook assigns it:
 *
 *   Grady, Jessica S., et al. "Emotions in Storybooks: A Comparison of
 *   Storybooks That Represent Ethnic and Racial Groups in the United States."
 *   Psychology of Popular Media Culture, vol. 8, no. 3, 2019, pp. 207–17,
 *   https://doi.org/10.1037/ppm0000185.
 *
 * Titles are in title case; a part of a larger work is quoted and the larger
 * work is italic. A group author who is also the publisher is not repeated as
 * author: the entry starts with the title.
 */
function formatMla(reference: DisplayReference, repeatedAuthor = false): ReferenceSegment[] {
  const { venue, volume, number, publisher } = reference;
  const type = reference.type ?? 'misc';
  const title = mlaTitleCase(reference.title.trim());
  const authors = sameAsAuthor(reference.authors, publisher || venue || '')
    ? []
    : reference.authors;
  const month =
    reference.month && reference.month >= 1 && reference.month <= 12
      ? MLA_MONTHS[reference.month - 1]
      : undefined;
  const date = reference.year
    ? month
      ? `${month} ${reference.year}`
      : String(reference.year)
    : undefined;
  const { range, article } = pageField(reference.pages);
  const pages = range ? `${isRange(range) ? 'pp.' : 'p.'} ${mlaPageRange(range)}` : article;
  const edition = reference.edition ? `${editionLabel(reference.edition)} ed.` : undefined;
  const location = mlaLocation(reference);
  const accessed =
    !reference.doi && reference.url && !reference.year && reference.accessed
      ? dayMonthYear(reference.accessed, MLA_MONTHS)
      : undefined;

  const author =
    authors.length === 0
      ? []
      : [upright(repeatedAuthor ? '---. ' : `${endSentence(mlaAuthors(authors))} `)];
  const quoted = upright(`"${endSentence(title)}"`);
  const standalone = [italic(title), upright(/[.?!]$/.test(title) ? '' : '.')];

  /** Container elements, separated by commas and closed with a period. */
  const container = (name: string | undefined, elements: (string | undefined)[]) => {
    const rest = elements.filter(Boolean) as string[];
    const out: ReferenceSegment[] = [];
    if (name) out.push(upright(' '), italic(name));
    if (rest.length) out.push(upright(`${name ? ', ' : ' '}${rest.join(', ')}`));
    if (name || rest.length) out.push(upright('.'));
    return out;
  };

  let body: ReferenceSegment[];
  switch (type) {
    case 'article':
      body = [
        quoted,
        ...container(venue, [
          volume ? `vol. ${volume}` : undefined,
          number ? `no. ${number}` : undefined,
          date,
          pages,
          location,
        ]),
      ];
      break;

    case 'inproceedings':
    case 'incollection':
      body = [
        quoted,
        ...container(venue, [
          reference.editors?.length ? mlaEditors(reference.editors) : undefined,
          edition,
          publisher,
          date,
          pages,
          location,
        ]),
      ];
      break;

    case 'book':
      body = [...standalone, ...container(undefined, [edition, publisher, date, location])];
      break;

    case 'techreport':
      body = [
        ...standalone,
        ...container(undefined, [
          number ? `Report no. ${number}` : undefined,
          venue || publisher,
          date,
          location,
        ]),
      ];
      break;

    // MLA puts the date before the institution and the kind of thesis last.
    case 'phdthesis':
      body = [
        ...standalone,
        ...container(undefined, [date]),
        ...container(undefined, [venue || publisher, 'PhD dissertation']),
        ...(location ? container(undefined, [location]) : []),
      ];
      break;

    default:
      body = isWebPage(reference)
        ? [quoted, ...container(venue || publisher, [date, location])]
        : [...standalone, ...container(undefined, [publisher || venue, date, location])];
  }

  return joinSegments([...author, ...body, accessed ? upright(` Accessed ${accessed}.`) : null]);
}

/* -------------------------------------------------------------------------- */
/*  Vancouver (ICMJE / NLM Citing Medicine)                                    */
/* -------------------------------------------------------------------------- */

const VANCOUVER_MAX_AUTHORS = 6;
const VANCOUVER_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "Grady JS" — surname, then initials with no periods or spaces. */
function vancouverName(author: string): string {
  if (isGroupAuthor(author)) return surname(author);
  const i = initials(author).replace(/[.\s-]/g, '');
  const suffix = nameSuffix(author).replace(/\./g, '');
  return [surname(author), i, suffix].filter(Boolean).join(' ');
}

/** Up to six names, then "et al."; the list closes with a period. */
function vancouverAuthors(names: string[]): string {
  const shown = names.slice(0, VANCOUVER_MAX_AUTHORS).map(vancouverName);
  return `${shown.join(', ')}${names.length > VANCOUVER_MAX_AUTHORS ? ', et al' : ''}.`;
}

/** NLM drops the repeated leading digits of a page range: 207-17. */
function vancouverPages(pages: string): string {
  return mlaPageRange(pages).replace(/–/g, '-');
}

/**
 * Vancouver entries, as the NLM's Citing Medicine sets them — the format
 * medical journals use:
 *
 *   Grady JS, Her M, Moreno G, Perez C, Yelinek J. Emotions in storybooks: a
 *   comparison of storybooks that represent ethnic and racial groups in the
 *   United States. Psychol Pop Media Cult. 2019;8(3):207-17. doi:
 *   10.1037/ppm0000185
 *
 * Nothing is italic. Titles are in sentence case. The journal is printed as
 * it was entered — NLM expects its own abbreviation, which only the author
 * can supply.
 */
function formatVancouver(reference: DisplayReference): ReferenceSegment[] {
  const { authors, venue, volume, number, publisher, address } = reference;
  const type = reference.type ?? 'misc';
  const title = endSentence(toSentenceCase(reference.title.trim()));
  const month =
    reference.month && reference.month >= 1 && reference.month <= 12
      ? VANCOUVER_MONTHS[reference.month - 1]
      : undefined;
  const year = reference.year ? String(reference.year) : '[date unknown]';
  const { range, article } = pageField(reference.pages);
  const pages = range ? vancouverPages(range) : article;
  const imprint = [address, publisher].filter(Boolean).join(': ');
  const edition = reference.edition ? ` ${editionLabel(reference.edition)} ed.` : '';
  const doi = reference.doi
    ? ` doi: ${reference.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')}`
    : '';
  const lead = authors.length > 0 ? `${vancouverAuthors(authors)} ` : '';

  let text: string;
  switch (type) {
    case 'article':
      text =
        `${lead}${title} ${venue ? `${endSentence(venue)} ` : ''}${year}${month ? ` ${month}` : ''}` +
        `${volume ? `;${volume}` : ''}${number ? `(${number})` : ''}${pages ? `:${pages}` : ''}.${doi}`;
      break;

    case 'inproceedings':
    case 'incollection': {
      const editors = reference.editors?.length
        ? ` ${reference.editors.map(vancouverName).join(', ')}, ${reference.editors.length > 1 ? 'editors' : 'editor'}.`
        : '';
      text =
        `${lead}${title} In:${editors} ${venue ? endSentence(venue) : ''}${edition}` +
        `${imprint ? ` ${imprint};` : ''} ${year}.${pages ? ` p. ${pages}.` : ''}${doi}`;
      break;
    }

    case 'book':
      text = `${lead}${title}${edition}${imprint ? ` ${imprint};` : ''} ${year}.${doi}`;
      break;

    case 'phdthesis':
      text = `${lead}${title.replace(/\.$/, '')} [dissertation]. ${[address, venue || publisher].filter(Boolean).join(': ')}${venue || publisher ? ';' : ''} ${year}.`;
      break;

    case 'techreport':
      text = `${lead}${title}${imprint || venue ? ` ${[address, venue || publisher].filter(Boolean).join(': ')};` : ''} ${year}.${number ? ` Report No.: ${number}.` : ''}${doi}`;
      break;

    default: {
      if (isWebPage(reference)) {
        const cited = reference.accessed ? new Date(reference.accessed) : undefined;
        const citedText =
          cited && !Number.isNaN(cited.getTime())
            ? ` [cited ${cited.getUTCFullYear()} ${VANCOUVER_MONTHS[cited.getUTCMonth()]} ${cited.getUTCDate()}]`
            : '';
        text = `${lead}${title.replace(/\.$/, '')} [Internet]. ${venue || publisher ? `${venue || publisher}; ` : ''}${year}${citedText}. Available from: ${reference.url}`;
      } else {
        text = `${lead}${title}${imprint ? ` ${imprint};` : ''} ${year}.${doi}`;
      }
    }
  }

  return [upright(text.replace(/\s{2,}/g, ' ').trim())];
}

/**
 * The heading the reference list goes under: MLA calls it "Works Cited" and
 * Cite Them Right Harvard "Reference list"; the rest say "References".
 */
export function bibliographyHeading(style: CitationStyle): string {
  if (style === 'mla') return 'Works Cited';
  if (style === 'harvard') return 'Reference list';
  return 'References';
}

/** Per-entry context a style may need from the rest of the list. */
export interface FormatContext {
  /**
   * The letter APA adds to the year when one author has several works from
   * the same year — "2020a", "2020b". It is a fact about the whole list, so
   * it is worked out by the caller (`authorDate.yearSuffixes`).
   */
  yearSuffix?: string;
  /**
   * MLA: this entry's authors are exactly those of the entry above it, so
   * their names are replaced by three hyphens, "---." See
   * `authorPage.repeatedAuthors`.
   */
  repeatedAuthor?: boolean;
}

/**
 * Renders one entry. The leading "[n]" for numbered styles is added by the
 * caller, so it can align the list and keep numbering in one place.
 */
export function formatReference(
  reference: DisplayReference,
  style: CitationStyle,
  context: FormatContext = {}
): ReferenceSegment[] {
  // APA does its own casing, which needs to see the braces; everything else
  // shows the title as typed, less the braces.
  if (style === 'apa') return formatApa(reference, context.yearSuffix);
  if (style === 'harvard') return formatHarvard(reference, context.yearSuffix);
  if (style === 'mla') return formatMla(reference, context.repeatedAuthor);
  if (style === 'vancouver') return formatVancouver(reference);

  const title = stripBraces(reference.title);
  const { authors, year, venue, volume, number, pages } = reference;
  const y = year ? String(year) : 'n.d.';

  switch (style) {
    case 'ieee':
      return formatIeee({ ...reference, title });

    case 'chicago': {
      const parts = [
        withPeriod(surnameFirst(authors)),
        `"${withPeriod(title)}"`,
        venue ? `${venue}${volume ? ` ${volume}` : ''}${number ? `, no. ${number}` : ''}` : '',
        `(${y})`,
        pages ? `: ${pages}.` : '.',
      ];
      return [upright(parts.filter(Boolean).join(' '))];
    }

    case 'acm': {
      const parts = [
        withPeriod(initialsFirst(authors)),
        `${y}.`,
        withPeriod(title),
        venue ? `${venue}${volume ? ` ${volume}` : ''}${number ? `, ${number}` : ''}` : '',
        pages ? `, ${pages}.` : '',
      ];
      return [upright(parts.filter(Boolean).join(' '))];
    }

    default: {
      const parts = [
        `${initialsFirst(authors)},`,
        `"${withPeriod(title)}"`,
        venue ? `${venue},` : '',
        volume ? `vol. ${volume},` : '',
        number ? `no. ${number},` : '',
        pages ? `pp. ${pages},` : '',
        `${y}.`,
      ];
      return [upright(parts.filter(Boolean).join(' '))];
    }
  }
}

/** The same entry as plain text, for contexts that cannot carry italics. */
export function formatReferenceText(
  reference: DisplayReference,
  style: CitationStyle,
  context: FormatContext = {}
): string {
  return formatReference(reference, style, context)
    .map((segment) => segment.text)
    .join('');
}

/** Styles that number their entries rather than using author-date. */
export function isNumberedStyle(style: CitationStyle): boolean {
  return style === 'ieee' || style === 'numeric' || style === 'acm' || style === 'vancouver';
}

/**
 * Styles whose in-text citations name the author — APA and Harvard with the
 * year, "(Smith, 2020)", MLA with the page, "(Smith 45)" — and whose reference
 * list is alphabetical with a hanging indent. See `authorDate.ts`.
 */
export function isAuthorDateStyle(style: CitationStyle): boolean {
  return style === 'apa' || style === 'harvard' || style === 'mla';
}

/**
 * How a style points from the text to the list: by number ("[1]", "(1)"), by
 * author and year ("(Smith, 2020)"), or — MLA — by author and page
 * ("(Smith 45)"). The last two share an alphabetical, hanging-indent list.
 */
export function citationSystem(style: CitationStyle): 'numbered' | 'author-date' | 'author-page' {
  if (style === 'mla') return 'author-page';
  return isAuthorDateStyle(style) ? 'author-date' : 'numbered';
}
