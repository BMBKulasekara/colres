/**
 * Bibliographic details from an uploaded PDF.
 *
 * A PDF says very little about itself reliably. There are three places to
 * look, in falling order of trust, and this module reads all three:
 *
 *  1. Its identifier — a DOI or arXiv ID printed on the first page or stored
 *     in the XMP metadata. With one, Crossref returns the published record,
 *     and every field is *verified*.
 *  2. The metadata dictionary the producing program wrote (Title, Author,
 *     XMP `prism:` fields). Often right, often "Microsoft Word - draft3.docx".
 *  3. The layout of the first page: the title is the largest type near the
 *     top, the authors the line under it, and journals print a running line
 *     with the volume, issue and pages.
 *
 * Every field records where it came from and how far to trust it, so the
 * review form can say which ones the author should check before the reference
 * is added. Nothing is invented: a field no source supplies stays empty and
 * is reported as missing.
 *
 * Pure functions over a `PdfSnapshot` — the browser-side loader in
 * `pdfExtract.ts` produces one — so the rules can be tested in Node.
 */

import type { ReferenceType } from './citationFormat.ts';

/** One line of text on a page, top to bottom. */
export interface PdfTextLine {
  text: string;
  /** The largest font size on the line, in PDF points. */
  fontSize: number;
  /** 1-based page number. */
  page: number;
  /** Distance from the top of the page as a fraction of its height, 0–1. */
  top: number;
}

/** What the loader reads out of a PDF: its metadata and its first pages. */
export interface PdfSnapshot {
  fileName: string;
  pageCount: number;
  /** The document information dictionary. */
  info: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creationDate?: string;
  };
  /** XMP properties by qualified name, e.g. "prism:doi", "dc:creator". */
  xmp: Record<string, string | string[] | undefined>;
  /** Lines of the first pages, in reading order. */
  lines: PdfTextLine[];
}

/**
 * How far a field can be trusted:
 *  - `verified`: from the published record (Crossref);
 *  - `likely`: from the file's metadata, or two sources that agree;
 *  - `uncertain`: read off the page layout — check it.
 */
export type Confidence = 'verified' | 'likely' | 'uncertain';
export type FieldSource = 'crossref' | 'pdf-metadata' | 'pdf-text' | 'file-name';

export interface FieldValue<T> {
  value: T;
  source: FieldSource;
  confidence: Confidence;
}

export interface ExtractedFields {
  type?: FieldValue<ReferenceType>;
  title?: FieldValue<string>;
  authors?: FieldValue<string[]>;
  year?: FieldValue<number>;
  month?: FieldValue<number>;
  venue?: FieldValue<string>;
  volume?: FieldValue<string>;
  number?: FieldValue<string>;
  pages?: FieldValue<string>;
  doi?: FieldValue<string>;
  publisher?: FieldValue<string>;
  url?: FieldValue<string>;
  edition?: FieldValue<string>;
  editors?: FieldValue<string[]>;
  address?: FieldValue<string>;
}

export type FieldName = keyof ExtractedFields;

export interface PdfAnalysis {
  fields: ExtractedFields;
  /** A DOI to resolve with Crossref, if the PDF carries one. */
  doi?: string;
  arxivId?: string;
  /** Things the author should know that are not about a single field. */
  warnings: string[];
}

const field = <T>(value: T, source: FieldSource, confidence: Confidence): FieldValue<T> => ({
  value,
  source,
  confidence,
});

/* -------------------------------------------------------------------------- */
/*  Identifiers                                                                */
/* -------------------------------------------------------------------------- */

const DOI_PATTERN = /\b(10\.\d{4,9}\/[^\s"<>]+)/i;

/** The first DOI in a string, without the trailing punctuation a sentence adds. */
export function findDoi(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = DOI_PATTERN.exec(text.replace(/doi\.org\/\s+/gi, 'doi.org/'));
  if (!match) return undefined;
  let doi = (match[1] as string).replace(/[.,;:]+$/, '');
  // An unbalanced closing parenthesis belongs to the sentence, not the DOI.
  while (doi.endsWith(')') && (doi.match(/\(/g)?.length ?? 0) < (doi.match(/\)/g)?.length ?? 0)) {
    doi = doi.slice(0, -1);
  }
  return doi;
}

/** A new-style arXiv identifier, "2101.00001", without its version suffix. */
export function findArxivId(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = /\barxiv[:\s]*(\d{4}\.\d{4,5})(?:v\d+)?/i.exec(text);
  return match?.[1];
}

/* -------------------------------------------------------------------------- */
/*  Text helpers                                                               */
/* -------------------------------------------------------------------------- */

function clean(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

/** Lowercase words with punctuation removed — the basis of every comparison. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * How alike two titles are, 0–1. A published title and the one on a preprint
 * often differ only by a subtitle, so a title wholly contained in the other
 * counts almost as a match.
 */
export function titleSimilarity(a: string, b: string): number {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const word of wa) if (wb.has(word)) shared += 1;
  const dice = (2 * shared) / (wa.size + wb.size);
  const smaller = Math.min(wa.size, wb.size);
  const containment = smaller >= 5 ? (shared / smaller) * 0.95 : 0;
  return Math.max(dice, containment);
}

const CURRENT_YEAR = new Date().getUTCFullYear();

function plausibleYear(year: number): boolean {
  return year >= 1900 && year <= CURRENT_YEAR + 1;
}

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

/** XMP names are matched without regard to case; PDF.js lowercases them. */
function xmpValue(xmp: PdfSnapshot['xmp'], key: string) {
  return xmp[key] ?? xmp[key.toLowerCase()];
}

function xmpText(xmp: PdfSnapshot['xmp'], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = xmpValue(xmp, key);
    const text = Array.isArray(value) ? value[0] : value;
    if (text?.trim()) return clean(text);
  }
  return undefined;
}

function xmpList(xmp: PdfSnapshot['xmp'], key: string): string[] {
  const value = xmpValue(xmp, key);
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map(clean).filter(Boolean);
}

/**
 * A metadata title is only worth having when a person wrote it. Programs
 * fill the field with the file name, "Untitled", or "Microsoft Word - …".
 */
export function plausibleMetadataTitle(title: string | undefined): string | undefined {
  const value = title ? clean(title) : '';
  if (value.length < 8 || !/\s/.test(value)) return undefined;
  if (/^(untitled|microsoft word|document\d*|slide \d|title)\b/i.test(value)) return undefined;
  if (/\.(docx?|pdf|tex|dvi|indd|rtf|odt)$/i.test(value)) return undefined;
  return value;
}

/** Splits an author field — "Jane Smith; Tom Jones", "Smith, J., Jones, T." — into names. */
export function splitAuthorField(value: string | undefined): string[] {
  const text = value ? clean(value) : '';
  if (!text || /\b(user|admin|owner|author|unknown)\b/i.test(text)) return [];
  const parts = text.includes(';')
    ? text.split(';')
    : /,\s*[A-Z]\.(\s|$)/.test(text)
      ? // "Smith, J., Jones, T." — pair each surname with the initials after it.
        (text.match(/[^,]+,\s*(?:[A-Z]\.\s*)+/g) ?? [text])
      : text.split(/,|\s+and\s+|\s*&\s*/);
  return parts.map((part) => clean(part).replace(/,$/, '')).filter((part) => part.length > 1);
}

/* -------------------------------------------------------------------------- */
/*  Page layout                                                                */
/* -------------------------------------------------------------------------- */

/** Lines that are furniture — journal banners, licences, dates — not the title. */
const FURNITURE =
  /(journal|vol\.|volume|issn|isbn|doi|https?:|www\.|©|copyright|received|accepted|published|arxiv|preprint|proceedings|conference|licen[cs]e|creative commons|open access|research article|original article|review article|^article$|^page \d|^\d+$|contents lists|elsevier|springer|wiley|taylor & francis|sage|downloaded|citation:)/i;

const AFFILIATION =
  /(universit|department|dept\.|institut|school|college|laborator|hospital|cent(er|re)|faculty|academy|@|e-?mail|corresponding|\b\d{5}\b)/i;

/** The body text size: the most common font size on the first page. */
function bodyFontSize(lines: PdfTextLine[]): number {
  const counts = new Map<number, number>();
  for (const line of lines) {
    const size = Math.round(line.fontSize * 2) / 2;
    counts.set(size, (counts.get(size) ?? 0) + line.text.length);
  }
  let best = 0;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The title: the largest type in the top part of the first page, taken with
 * any lines that continue it at the same size. Only accepted when it stands
 * clearly above the body text, as a title does.
 */
function titleFromLayout(
  lines: PdfTextLine[]
): { title: string; endIndex: number; size: number } | undefined {
  const firstPage = lines.filter((line) => line.page === 1);
  const body = bodyFontSize(firstPage);
  const candidates = firstPage
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.top < 0.6 && line.text.length >= 3 && !FURNITURE.test(line.text));
  if (candidates.length === 0) return undefined;

  const size = Math.max(...candidates.map(({ line }) => line.fontSize));
  if (size < body * 1.15) return undefined;

  const start = candidates.find(({ line }) => Math.abs(line.fontSize - size) < 0.5);
  if (!start) return undefined;

  const parts = [start.line.text];
  let endIndex = start.index;
  for (let i = start.index + 1; i < firstPage.length; i++) {
    const line = firstPage[i] as PdfTextLine;
    if (Math.abs(line.fontSize - size) >= 0.5 || FURNITURE.test(line.text)) break;
    parts.push(line.text);
    endIndex = i;
  }

  // Line-end hyphens join words split across lines: "develop-" + "ment".
  const title = clean(parts.join(' ').replace(/(\w)- (\w)/g, '$1$2'));
  if (words(title).length < 3) return undefined;
  return { title, endIndex, size };
}

const NAME_TOKEN = /^\p{Lu}[\p{L}'’.-]*$/u;
const NAME_PARTICLE = /^(van|von|de|der|den|da|di|du|le|la|del|dos|das|bin|al|el|ter|ten)$/i;

/** True when a piece of a byline reads as a personal name. */
function looksLikeName(candidate: string): boolean {
  if (AFFILIATION.test(candidate) || /\d/.test(candidate)) return false;
  const tokens = candidate.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 5) return false;
  return tokens.every((token) => NAME_TOKEN.test(token) || NAME_PARTICLE.test(token));
}

/**
 * The authors: the byline lines under the title, read until the affiliations
 * start. Footnote markers — digits, asterisks, daggers, superscript letters —
 * are stripped before a line is split into names.
 */
function authorsFromLayout(lines: PdfTextLine[], titleEnd: number, titleSize: number): string[] {
  const firstPage = lines.filter((line) => line.page === 1);
  const names: string[] = [];

  for (let i = titleEnd + 1; i < Math.min(firstPage.length, titleEnd + 7); i++) {
    const line = firstPage[i] as PdfTextLine;
    if (line.fontSize >= titleSize - 0.1) continue;
    if (AFFILIATION.test(line.text) && names.length > 0) break;

    const found = line.text
      .replace(/[*†‡§¶∗⁎]|\d+|\(\s*\)/g, ' ')
      .replace(/\s+[a-z](?=\s*(,|$|\s+and\b))/g, ' ')
      .split(/,|;|\s+and\s+|\s*&\s*/)
      .map(clean)
      .filter(looksLikeName);

    if (found.length === 0 && names.length > 0) break;
    names.push(...found);
    if (names.length >= 30) break;
  }

  return names;
}

/** Month names and abbreviations to 1–12. */
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * The publication year (and month, when printed with it) from the first
 * pages. "Published", "Available online" and a copyright line are trusted, in
 * that order; a received or accepted date is not a publication date.
 */
function dateFromText(text: string): { year: number; month?: number } | undefined {
  const patterns = [
    /(?:published(?:\s+online)?|available online|publication date|first published)[:\s]*(?:(\d{1,2})\s+)?(?:([A-Za-z]{3,9})\.?\s+)?(?:\d{1,2},?\s+)?((?:19|20)\d{2})/i,
    /(?:©|\(c\)|copyright)\s*((?:19|20)\d{2})/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const year = Number(match[match.length - 1]);
    if (!plausibleYear(year)) continue;
    const monthWord = match.length > 3 ? match[2] : undefined;
    const month = monthWord ? MONTHS[monthWord.slice(0, 3).toLowerCase()] : undefined;
    return { year, month };
  }
  return undefined;
}

interface SourceLine {
  venue?: string;
  volume?: string;
  number?: string;
  pages?: string;
  year?: number;
}

/**
 * The line journals print with the issue details: "Psychology of Popular
 * Media Culture, Vol. 8, No. 3, 207–217", "Ageing & Society 42(8), 1879–1898",
 * or the medical "2019;8(3):207-17".
 */
export function sourceFromLine(line: string): SourceLine | undefined {
  const text = clean(line);

  const labelled =
    /^(.*?[A-Za-z].*?)[,\s]+vol(?:ume)?\.?\s*(\d+)(?:[,\s]+(?:no|issue|iss|number)\.?\s*(\d+))?(?:[,\s]*\(?((?:19|20)\d{2})\)?)?(?:[,\s]*(?:pp?\.?\s*)?(\d+)\s*[-–—]\s*(\d+))?/i.exec(
      text
    );
  if (labelled) {
    const venue = clean(
      (labelled[1] as string).replace(/^(published in|in)\s+/i, '').replace(/[,.]$/, '')
    );
    return {
      venue: venue.length >= 3 ? venue : undefined,
      volume: labelled[2],
      number: labelled[3],
      year: labelled[4] ? Number(labelled[4]) : undefined,
      pages: labelled[5] && labelled[6] ? `${labelled[5]}–${labelled[6]}` : undefined,
    };
  }

  const vancouver = /((?:19|20)\d{2})\s*;\s*(\d+)\s*(?:\((\d+)\))?\s*:\s*(\d+)\s*[-–]\s*(\d+)/.exec(
    text
  );
  if (vancouver) {
    const before = clean(text.slice(0, vancouver.index).replace(/[.;,]\s*$/, ''));
    return {
      venue: before.length >= 3 ? before : undefined,
      year: Number(vancouver[1]),
      volume: vancouver[2],
      number: vancouver[3],
      pages: `${vancouver[4]}–${vancouver[5]}`,
    };
  }

  const compact =
    /([A-Z][A-Za-z&.,:'’\- ]{2,90}?)[,\s]+(\d{1,4})\s*\((\d{1,4}(?:[-–]\d{1,4})?)\)\s*[,:]?\s*(?:pp?\.?\s*)?(\d+)\s*[-–]\s*(\d+)/.exec(
      text
    );
  if (compact) {
    return {
      venue: clean((compact[1] as string).replace(/[,.]$/, '')),
      volume: compact[2],
      number: compact[3],
      pages: `${compact[4]}–${compact[5]}`,
    };
  }

  return undefined;
}

const KNOWN_PUBLISHERS = [
  'American Psychological Association',
  'Elsevier',
  'Springer Nature',
  'Springer',
  'Wiley',
  'Taylor & Francis',
  'SAGE Publications',
  'Oxford University Press',
  'Cambridge University Press',
  'IEEE',
  'Association for Computing Machinery',
  'MDPI',
  'Frontiers Media',
  'Public Library of Science',
  'Nature Publishing Group',
  'BMJ Publishing Group',
  'Emerald Publishing',
  'De Gruyter',
  'Routledge',
];

/* -------------------------------------------------------------------------- */
/*  Analysis                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Reads everything the PDF itself can tell about the work it contains.
 *
 * The result is a first draft: `mergeRecord` then lays the published record
 * over it when the DOI (or a title search) finds one.
 */
export function analyzePdf(snapshot: PdfSnapshot): PdfAnalysis {
  const { info, xmp, lines } = snapshot;
  const fields: ExtractedFields = {};
  const warnings: string[] = [];

  const firstPageText = lines
    .filter((line) => line.page === 1)
    .map((line) => line.text)
    .join('\n');
  const openingText = lines
    .filter((line) => line.page <= 2)
    .map((line) => line.text)
    .join('\n');

  // Identifiers: metadata first, then the first page. Later pages are not
  // searched — a reference list is full of other papers' DOIs.
  const doi =
    findDoi(xmpText(xmp, 'prism:doi', 'pdfx:doi', 'dc:identifier')) ??
    findDoi(info.subject) ??
    findDoi(info.keywords) ??
    findDoi(firstPageText);
  const arxivId = findArxivId(firstPageText) ?? findArxivId(info.subject);

  if (doi) {
    fields.doi = field(doi, xmpValue(xmp, 'prism:doi') ? 'pdf-metadata' : 'pdf-text', 'likely');
  }
  if (arxivId) {
    fields.url = field(`https://arxiv.org/abs/${arxivId}`, 'pdf-text', 'likely');
    if (!doi) fields.doi = field(`10.48550/arXiv.${arxivId}`, 'pdf-text', 'likely');
  }

  // Title: metadata and layout, trusted more when they agree.
  const metaTitle = plausibleMetadataTitle(xmpText(xmp, 'dc:title') ?? info.title);
  const layout = titleFromLayout(lines);
  if (metaTitle && layout && titleSimilarity(metaTitle, layout.title) >= 0.8) {
    fields.title = field(metaTitle, 'pdf-metadata', 'likely');
  } else if (layout) {
    fields.title = field(layout.title, 'pdf-text', 'uncertain');
  } else if (metaTitle) {
    fields.title = field(metaTitle, 'pdf-metadata', 'uncertain');
  } else {
    const fromName = clean(snapshot.fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '));
    if (fromName.length >= 4) fields.title = field(fromName, 'file-name', 'uncertain');
  }

  // Authors: XMP creators, the Author field, or the byline under the title.
  const metaAuthors = xmpList(xmp, 'dc:creator').length
    ? xmpList(xmp, 'dc:creator')
    : splitAuthorField(info.author);
  const layoutAuthors = layout ? authorsFromLayout(lines, layout.endIndex, layout.size) : [];
  if (metaAuthors.length > 0) {
    const agree =
      layoutAuthors.length > 0 &&
      layoutAuthors.some((name) => metaAuthors.some((meta) => titleSimilarity(name, meta) > 0.4));
    fields.authors = field(metaAuthors, 'pdf-metadata', agree ? 'likely' : 'uncertain');
  } else if (layoutAuthors.length > 0) {
    fields.authors = field(layoutAuthors, 'pdf-text', 'uncertain');
  }

  // Journal, volume, issue, pages: XMP prism fields, then the running line.
  const prismVenue = xmpText(xmp, 'prism:publicationName');
  if (prismVenue) fields.venue = field(prismVenue, 'pdf-metadata', 'likely');
  const prismVolume = xmpText(xmp, 'prism:volume');
  if (prismVolume) fields.volume = field(prismVolume, 'pdf-metadata', 'likely');
  const prismNumber = xmpText(xmp, 'prism:number', 'prism:issueIdentifier');
  if (prismNumber) fields.number = field(prismNumber, 'pdf-metadata', 'likely');
  const startPage = xmpText(xmp, 'prism:startingPage');
  const endPage = xmpText(xmp, 'prism:endingPage');
  if (startPage) {
    fields.pages = field(endPage ? `${startPage}–${endPage}` : startPage, 'pdf-metadata', 'likely');
  }

  let sourceYear: number | undefined;
  for (const line of lines.filter((l) => l.page <= 2)) {
    const source = sourceFromLine(line.text);
    if (!source) continue;
    if (source.venue && !fields.venue) fields.venue = field(source.venue, 'pdf-text', 'uncertain');
    if (source.volume && !fields.volume)
      fields.volume = field(source.volume, 'pdf-text', 'uncertain');
    if (source.number && !fields.number)
      fields.number = field(source.number, 'pdf-text', 'uncertain');
    if (source.pages && !fields.pages) fields.pages = field(source.pages, 'pdf-text', 'uncertain');
    if (source.year && plausibleYear(source.year)) sourceYear ??= source.year;
    break;
  }

  // Year: a stated publication date, the issue line, XMP dates, and last of
  // all the date the file was made — which is not when the work was published.
  const stated = dateFromText(openingText);
  const coverDate = xmpText(xmp, 'prism:coverDate', 'prism:publicationDate', 'dc:date');
  const coverYear = coverDate ? Number(/(19|20)\d{2}/.exec(coverDate)?.[0]) : undefined;
  const createdYear = info.creationDate
    ? Number(/(19|20)\d{2}/.exec(info.creationDate)?.[0])
    : undefined;
  if (stated) {
    fields.year = field(
      stated.year,
      'pdf-text',
      sourceYear === stated.year ? 'likely' : 'uncertain'
    );
    if (stated.month) fields.month = field(stated.month, 'pdf-text', 'uncertain');
  } else if (coverYear && plausibleYear(coverYear)) {
    fields.year = field(coverYear, 'pdf-metadata', 'likely');
  } else if (sourceYear) {
    fields.year = field(sourceYear, 'pdf-text', 'uncertain');
  } else if (createdYear && plausibleYear(createdYear)) {
    fields.year = field(createdYear, 'pdf-metadata', 'uncertain');
    warnings.push(
      'The year is the date the file was created, which may not be the publication year.'
    );
  }

  // Publisher: XMP, or a well-known name on the first page.
  const metaPublisher = xmpText(xmp, 'dc:publisher');
  if (metaPublisher) {
    fields.publisher = field(metaPublisher, 'pdf-metadata', 'likely');
  } else {
    const named = KNOWN_PUBLISHERS.find((name) => firstPageText.includes(name));
    if (named) fields.publisher = field(named, 'pdf-text', 'uncertain');
  }

  fields.type = field(inferType(fields, openingText, arxivId), 'pdf-text', 'uncertain');

  return {
    fields,
    doi: doi ?? (arxivId ? `10.48550/arXiv.${arxivId}` : undefined),
    arxivId,
    warnings,
  };
}

/** What kind of work the fields describe, from the clues the PDF offers. */
function inferType(
  fields: ExtractedFields,
  text: string,
  arxivId: string | undefined
): ReferenceType {
  const venue = fields.venue?.value ?? '';
  if (/\b(proceedings|conference|symposium|workshop)\b/i.test(venue)) return 'inproceedings';
  if (/\b(a )?(dissertation|thesis) (submitted|presented)\b|\bdoctor of philosophy\b/i.test(text)) {
    return 'phdthesis';
  }
  if (/\btechnical report\b/i.test(text)) return 'techreport';
  if (arxivId && !fields.volume) return 'misc';
  if (fields.venue || fields.volume) return 'article';
  return fields.doi ? 'article' : 'misc';
}

/* -------------------------------------------------------------------------- */
/*  The published record                                                       */
/* -------------------------------------------------------------------------- */

/** A reference as Crossref describes it — the shape `lookupDoi` returns. */
export interface PublishedRecord {
  type: ReferenceType;
  title: string;
  authors: string[];
  editors?: string[];
  edition?: string;
  year?: number;
  month?: number;
  venue?: string;
  publisher?: string;
  address?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
}

/** How close a search result has to be to the PDF's title to be taken as it. */
export const TITLE_MATCH_THRESHOLD = 0.85;

/**
 * The best search result, if one is plainly the same work: its title matches
 * and, when both are known, its year is within one of the PDF's (a preprint
 * and its journal version are often a year apart).
 */
export function pickMatchingRecord(
  candidates: readonly PublishedRecord[],
  title: string,
  year?: number
): PublishedRecord | undefined {
  let best: PublishedRecord | undefined;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = titleSimilarity(candidate.title, title);
    const yearOk = !year || !candidate.year || Math.abs(candidate.year - year) <= 1;
    if (score >= TITLE_MATCH_THRESHOLD && yearOk && score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Lays the published record over what the PDF said. Every field the record
 * has is verified and wins; fields it lacks keep the PDF's value and its
 * confidence.
 *
 * A DOI printed in a PDF usually belongs to the paper, but can belong to a
 * work it cites on the first page. When the record's title is nothing like
 * the title on the page, the author is told.
 */
export function mergeRecord(analysis: PdfAnalysis, record: PublishedRecord): PdfAnalysis {
  const fields: ExtractedFields = { ...analysis.fields };
  const warnings = [...analysis.warnings];
  const set = <K extends FieldName>(
    name: K,
    value: ExtractedFields[K] extends FieldValue<infer T> | undefined ? T | undefined : never
  ) => {
    const empty =
      value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    if (!empty) (fields as Record<string, unknown>)[name] = field(value, 'crossref', 'verified');
  };

  const pageTitle = analysis.fields.title;
  if (
    pageTitle &&
    pageTitle.source !== 'file-name' &&
    titleSimilarity(pageTitle.value, record.title) < 0.5
  ) {
    warnings.push(
      `The DOI found in the PDF resolves to "${record.title}", which does not match the title on the first page. Check that it is this paper's DOI and not one it cites.`
    );
  }

  set('type', record.type);
  set('title', record.title === 'Untitled' ? undefined : record.title);
  set('authors', record.authors);
  set('editors', record.editors);
  set('edition', record.edition);
  set('year', record.year);
  set('month', record.month);
  set('venue', record.venue);
  set('publisher', record.publisher);
  set('address', record.address);
  set('volume', record.volume);
  set('number', record.number);
  set('pages', record.pages);
  set('doi', record.doi);
  // A DOI is the link every style prefers; the doi.org URL Crossref also
  // returns would only duplicate it.
  if (!record.doi) set('url', record.url);

  return { ...analysis, fields, warnings };
}

/* -------------------------------------------------------------------------- */
/*  Review                                                                     */
/* -------------------------------------------------------------------------- */

/** The fields a reference of each type needs before any style can set it fully. */
export const EXPECTED_FIELDS: Record<ReferenceType, FieldName[]> = {
  article: ['title', 'authors', 'year', 'venue', 'volume', 'number', 'pages', 'doi'],
  inproceedings: ['title', 'authors', 'year', 'venue', 'pages', 'publisher'],
  book: ['title', 'authors', 'year', 'publisher'],
  incollection: ['title', 'authors', 'year', 'venue', 'editors', 'publisher', 'pages'],
  techreport: ['title', 'authors', 'year', 'publisher'],
  phdthesis: ['title', 'authors', 'year', 'venue'],
  misc: ['title', 'authors', 'year', 'url'],
};

/**
 * What the author should look at before adding the reference: fields the
 * type needs that nothing supplied, and fields read off the page layout.
 */
export function reviewFields(fields: ExtractedFields): {
  missing: FieldName[];
  uncertain: FieldName[];
} {
  const type = fields.type?.value ?? 'misc';
  const missing = EXPECTED_FIELDS[type].filter((name) => {
    const value = fields[name]?.value;
    return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  });
  const uncertain = (Object.keys(fields) as FieldName[]).filter(
    (name) => name !== 'type' && fields[name]?.confidence === 'uncertain'
  );
  return { missing, uncertain };
}
