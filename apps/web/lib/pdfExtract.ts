/**
 * Reads an uploaded PDF in the browser: its metadata and the text of its
 * first pages, as the `PdfSnapshot` that `pdfReference.analyzePdf` works on.
 *
 * The file never leaves the author's machine. Only what is needed to find the
 * published record — a DOI, or a title — is sent on, to Crossref.
 *
 * PDF.js is loaded on demand through unpdf, whose build needs no web worker,
 * so it costs nothing until someone actually drops a PDF.
 */

import type { PdfSnapshot, PdfTextLine } from './pdfReference';

/** Large enough for any journal article or thesis chapter. */
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Only the opening pages carry the title, byline and issue details. */
const PAGES_TO_READ = 2;

/**
 * Checks a file before it is read: a PDF by type or extension, not empty, and
 * within the size limit. Returns the problem, or null when the file is fine.
 */
export function validatePdfFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return `"${file.name}" is not a PDF. Upload a .pdf file.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_PDF_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `"${file.name}" is ${mb} MB. The limit is ${MAX_PDF_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}

/**
 * True when the bytes begin like a PDF. The header may follow a little junk,
 * which the format allows, so the first kilobyte is searched.
 */
function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}

interface RawItem {
  str: string;
  transform: number[];
}

/** Groups a page's text items into lines, top to bottom. */
function toLines(items: RawItem[], pageHeight: number, page: number): PdfTextLine[] {
  const positioned = items
    .filter((item) => item.str.trim())
    .map((item) => ({
      text: item.str,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
      size: Math.hypot(item.transform[2] ?? 0, item.transform[3] ?? 0),
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: { y: number; size: number; parts: { x: number; text: string }[] }[] = [];
  for (const item of positioned) {
    const line = lines.find(
      (candidate) => Math.abs(candidate.y - item.y) < Math.max(2, item.size * 0.5)
    );
    if (line) {
      line.parts.push({ x: item.x, text: item.text });
      line.size = Math.max(line.size, item.size);
    } else {
      lines.push({ y: item.y, size: item.size, parts: [{ x: item.x, text: item.text }] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => ({
      text: line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      fontSize: line.size,
      page,
      top: pageHeight > 0 ? Math.min(1, Math.max(0, 1 - line.y / pageHeight)) : 0,
    }))
    .filter((line) => line.text.length > 0);
}

/** Pulls the few XMP fields PDF.js's parser does not reliably expose. */
function rawXmpFields(raw: unknown): Record<string, string> {
  if (typeof raw !== 'string') return {};
  const out: Record<string, string> = {};
  for (const name of [
    'prism:doi',
    'prism:publicationName',
    'prism:volume',
    'prism:number',
    'prism:startingPage',
    'prism:endingPage',
    'prism:coverDate',
  ]) {
    const match =
      new RegExp(`<${name}>([^<]+)</${name}>`, 'i').exec(raw) ??
      new RegExp(`${name}="([^"]+)"`, 'i').exec(raw);
    if (match?.[1]) out[name.toLowerCase()] = match[1].trim();
  }
  return out;
}

/**
 * Opens a PDF and returns its metadata and first pages as lines of text.
 * Throws with a readable message when the file is not a PDF, is damaged, or
 * is password-protected.
 */
export async function readPdf(file: File): Promise<PdfSnapshot> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfHeader(bytes)) {
    throw new Error(`"${file.name}" does not contain PDF data, although it is named like one.`);
  }

  const { getDocumentProxy, getMeta } = await import('unpdf');

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // PDF.js takes ownership of the buffer it is given, so it gets a copy.
    pdf = await getDocumentProxy(bytes.slice());
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw new Error(
      /password/i.test(message)
        ? 'This PDF is password-protected. Remove the password and upload it again.'
        : 'This PDF could not be read. It may be damaged.'
    );
  }

  try {
    const meta = await getMeta(pdf).catch(() => ({ info: {}, metadata: null }));
    const info = (meta.info ?? {}) as Record<string, unknown>;

    // XMP, when the file has any. unpdf returns an empty object otherwise.
    const xmp: PdfSnapshot['xmp'] = {};
    const metadata = meta.metadata as
      | (Partial<Iterable<[string, string | string[]]>> & { getRaw?: () => unknown })
      | null;
    if (metadata && typeof metadata.getRaw === 'function') {
      if (typeof metadata[Symbol.iterator] === 'function') {
        for (const [key, value] of metadata as Iterable<[string, string | string[]]>) {
          xmp[key.toLowerCase()] = value;
        }
      }
      Object.assign(xmp, { ...rawXmpFields(metadata.getRaw()), ...xmp });
    }

    const lines: PdfTextLine[] = [];
    for (let n = 1; n <= Math.min(PAGES_TO_READ, pdf.numPages); n++) {
      const page = await pdf.getPage(n);
      const { height } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      lines.push(...toLines(content.items as RawItem[], height, n));
    }

    const text = (key: string) =>
      typeof info[key] === 'string' ? (info[key] as string) : undefined;
    return {
      fileName: file.name,
      pageCount: pdf.numPages,
      info: {
        title: text('Title'),
        author: text('Author'),
        subject: text('Subject'),
        keywords: text('Keywords'),
        creationDate: text('CreationDate'),
      },
      xmp,
      lines,
    };
  } finally {
    // Frees the parsed document; the loading task owns it.
    void pdf.loadingTask.destroy();
  }
}
