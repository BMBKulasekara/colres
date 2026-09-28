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
}

export type CitationStyle = 'ieee' | 'apa' | 'acm' | 'vancouver' | 'chicago' | 'numeric';

/** One run of an entry. `italic` marks the container title. */
export interface ReferenceSegment {
  text: string;
  italic?: boolean;
}

export function surname(author: string): string {
  const name = author.trim();
  if (name.includes(',')) return name.split(',')[0]?.trim() ?? name;
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

export function initials(author: string): string {
  const name = author.trim();
  const given = name.includes(',')
    ? (name.split(',')[1] ?? '').trim()
    : name.split(/\s+/).slice(0, -1).join(' ');

  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase()}.`)
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

/** "J. K. Smith" — initials before the surname. */
function initialed(author: string): string {
  const i = initials(author);
  return i ? `${i} ${surname(author)}` : surname(author);
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

  const names = authors.map(initialed);
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

/** "A. Vaswani, N. Shazeer, et al." — the shape the other numbered styles use. */
function initialsFirst(authors: string[], max = 6): string {
  if (authors.length === 0) return 'Unknown author';
  const shown = authors.slice(0, max).map(initialed);
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
function joinSegments(segments: (ReferenceSegment | null | undefined)[]): ReferenceSegment[] {
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

const upright = (text: string): ReferenceSegment => ({ text });
const italic = (text: string): ReferenceSegment => ({ text, italic: true });

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
              `, ${reference.editors.map(initialed).join(', ')}, ${reference.editors.length > 1 ? 'Eds.' : 'Ed.'}`
            )
          : null,
        address ? upright(`, ${address}`) : null,
        publisher ? upright(`, ${abbreviateContainer(publisher)}`) : null,
        pages ? upright(`, pp. ${enDashPages(pages)}`) : null,
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
        pages ? upright(`, pp. ${enDashPages(pages)}`) : null,
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
  return i ? `${surname(author)}, ${i}` : surname(author);
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
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://doi.org/${trimmed.replace(/^doi:\s*/i, '')}`;
}

/**
 * The trailing link. A DOI wins over a URL when both are known. APA puts no
 * period after either, since the period could be taken as part of the link.
 */
function apaLink(reference: DisplayReference): ReferenceSegment | null {
  if (reference.doi) return upright(` ${doiUrl(reference.doi)}`);
  if (reference.url) return upright(` ${reference.url}`);
  return null;
}

/**
 * Editors in the "In …" of a chapter: initials first, "&" before the last,
 * and a comma before it only when there are three or more.
 */
function apaEditors(editors: string[]): string {
  const names = editors.map(initialed);
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

    case 'techreport':
      titleSegments = italicTitle(title, number ? ` (Report No. ${number})` : '');
      source = [
        venue || publisher ? upright(` ${endSentence((venue || publisher) as string)}`) : null,
      ];
      break;

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
      source = [outlet ? upright(` ${endSentence(outlet)}`) : null];
    }
  }

  const lead: (ReferenceSegment | null)[] =
    authors.length > 0
      ? [upright(`${endSentence(apaAuthors(authors))} ${date}. `), ...titleSegments]
      : [...titleSegments, upright(` ${date}.`)];

  return joinSegments([...lead, ...source, apaLink(reference)]);
}

/** Per-entry context a style may need from the rest of the list. */
export interface FormatContext {
  /**
   * The letter APA adds to the year when one author has several works from
   * the same year — "2020a", "2020b". It is a fact about the whole list, so
   * it is worked out by the caller (`authorDate.yearSuffixes`).
   */
  yearSuffix?: string;
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

    case 'vancouver': {
      const parts = [
        withPeriod(initialsFirst(authors, 6)),
        withPeriod(title),
        venue ? `${venue}.` : '',
        `${y}`,
        volume ? `;${volume}` : '',
        number ? `(${number})` : '',
        pages ? `:${pages}` : '',
      ];
      return [upright(`${parts.filter(Boolean).join(' ')}.`)];
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
 * Styles whose in-text citations name the author and year — "(Smith, 2020)" —
 * and whose reference list is alphabetical. See `authorDate.ts`.
 */
export function isAuthorDateStyle(style: CitationStyle): boolean {
  return style === 'apa';
}
