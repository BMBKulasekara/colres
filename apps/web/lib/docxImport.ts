/**
 * Word import: a `.docx` file as the HTML the editor stores.
 *
 * mammoth reads the document's structure (headings, paragraphs, lists,
 * tables, bold/italic, links, images) rather than its look, which is what the
 * editor wants: the template sets the look. Anything the editor has no node
 * for is dropped when the editor parses the HTML.
 */

import mammoth from 'mammoth';

/** Word's built-in styles that carry structure, mapped onto the editor's. */
const STYLE_MAP = [
  // By name (Word's own files) and by id (files from other tools).
  "p[style-name='Title'] => h1:fresh",
  'p.Title => h1:fresh',
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  // Captions become plain paragraphs; the editor numbers its own figures.
  "p[style-name='Caption'] => p:fresh",
  'u => u',
  'strike => s',
];

export interface DocxImport {
  title: string;
  html: string;
  /** Things that did not come across, in plain words. */
  warnings: string[];
}

/** "Thesis draft v3.docx" → "Thesis draft v3". */
export function titleFromFileName(name: string): string {
  return (
    name
      .replace(/\.docx$/i, '')
      .replace(/[_]+/g, ' ')
      .trim() || 'Untitled Document'
  );
}

/**
 * Tidies mammoth's output for the editor: drops empty paragraphs (Word uses
 * them for spacing, the editor does not) and anchors with no link.
 */
export function tidyImportedHtml(html: string): string {
  return html
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/g, '')
    .replace(/<a id="[^"]*"><\/a>/g, '')
    .trim();
}

/** Turns mammoth's messages into a short, de-duplicated list for the author. */
function describeMessages(messages: { type: string; message: string }[]): string[] {
  const out = new Set<string>();
  for (const { message } of messages) {
    if (/unrecognised (paragraph|run) style/i.test(message)) {
      out.add('Some custom Word styles were imported as plain text.');
    } else if (/image/i.test(message)) {
      out.add('Some images could not be imported.');
    } else if (/(footnote|endnote|comment)/i.test(message)) {
      out.add('Footnotes, endnotes and Word comments are not imported.');
    }
  }
  return [...out];
}

/**
 * Converts a Word file. `uploadImage` stores each embedded image and returns
 * its URL; when it is omitted, or fails for one image, that image is left out.
 */
export async function importDocx(
  file: { name: string; arrayBuffer: () => Promise<ArrayBuffer> },
  uploadImage?: (image: Blob) => Promise<string>
): Promise<DocxImport> {
  const warnings: string[] = [];
  let failedImages = 0;

  // mammoth's browser build reads `arrayBuffer`; its Node build (used by the
  // tests) reads `buffer`. Each ignores the other.
  const arrayBuffer = await file.arrayBuffer();
  const input = {
    arrayBuffer,
    ...(typeof Buffer !== 'undefined' ? { buffer: Buffer.from(arrayBuffer) } : {}),
  };

  const result = await mammoth.convertToHtml(input, {
    styleMap: STYLE_MAP,
    convertImage: mammoth.images.imgElement(async (image) => {
      if (!uploadImage) {
        failedImages += 1;
        return { src: '' };
      }
      try {
        const bytes = await image.read();
        const src = await uploadImage(new Blob([bytes as BlobPart], { type: image.contentType }));
        return { src };
      } catch {
        failedImages += 1;
        return { src: '' };
      }
    }),
  });

  if (failedImages > 0) {
    warnings.push(
      failedImages === 1
        ? 'One image could not be imported.'
        : `${failedImages} images could not be imported.`
    );
  }
  warnings.push(...describeMessages(result.messages));

  return {
    title: titleFromFileName(file.name),
    // Images that failed were given an empty src; drop them rather than
    // leaving broken boxes.
    html: tidyImportedHtml(result.value.replace(/<img src=""[^>]*\/?>/g, '')),
    warnings: [...new Set(warnings)],
  };
}
