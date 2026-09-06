import type { PageGeometry } from '../../lib/pageGeometry';

/**
 * Prints the document content on its own, rather than the surrounding page.
 *
 * The obvious approach — an `@media print` block over the live DOM — has to
 * fight the app: sticky toolbars, the collaboration drawer, the card chrome,
 * the dark theme painting a dark background, and Liveblocks' own decorations
 * (comment highlights, presence carets) all reach the paper unless each one is
 * suppressed by hand.
 *
 * Rendering the editor's HTML into an isolated iframe sidesteps all of it: the
 * app's stylesheet is simply not there. The trade is that the print styles are
 * written once, here — which is also what makes them reusable for a PDF or
 * LaTeX export later.
 *
 * Page size and margins come from the same `PageGeometry` the on-screen paged
 * view measures against, so the breaks the author saw while writing are the
 * breaks the browser produces here.
 */

const CLEANUP_FALLBACK_MS = 60_000;

const ASSET_WAIT_TIMEOUT_MS = 3_000;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildStyles(geometry: PageGeometry) {
  return `
    @page {
      size: ${geometry.cssPageSize};
      margin: ${geometry.marginIn}in;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body {
      color: #111;
      font-family: Georgia, 'Times New Roman', Times, serif;
      font-size: ${geometry.bodyFontPx}px;
      line-height: 1.625;
      /* Belt and braces: some browsers ignore @page margins when printing an
         iframe, in which case this keeps the measure identical anyway. */
      max-width: ${geometry.contentWidthPx}px;
      margin: 0 auto;
    }

    h1, h2, h3, h4, h5, h6 {
      font-weight: 700;
      line-height: 1.25;
      margin: 1.5em 0 0.75em;
      /* Never leave a heading stranded at the foot of a page. */
      break-after: avoid;
      break-inside: avoid;
    }

    h1 { font-size: 1.8em; }
    h2 { font-size: 1.4em; }
    h3 { font-size: 1.2em; }

    p {
      margin: 0.5em 0;
      orphans: 2;
      widows: 2;
    }

    ul, ol { margin: 0.75em 0; padding-left: 1.5rem; }
    ul { list-style-type: disc; }
    ol { list-style-type: decimal; }
    li { margin: 0.25em 0; }
    li > p { margin: 0; }

    blockquote {
      border-left: 3px solid #999;
      padding-left: 1rem;
      margin: 1.25em 0;
      font-style: italic;
      break-inside: avoid;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.875em;
    }

    pre {
      background: #f4f4f5;
      color: #111;
      padding: 0.75rem;
      border: 1px solid #d4d4d8;
      border-radius: 4px;
      margin: 1.25em 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      break-inside: avoid;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.875em;
    }

    pre code { background: none; padding: 0; font-size: inherit; }

    hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }

    a { color: inherit; text-decoration: underline; }

    img, table, figure { break-inside: avoid; max-width: 100%; }

    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 0.35em 0.5em; text-align: left; }

    /* Citations print as the plain marker they show on screen. Resolving them
       to a numbered or author-year form, and appending a bibliography, is a
       separate piece of work. */
    [data-citation] {
      background: none;
      color: inherit;
      padding: 0;
      font: inherit;
    }

    /* The author's hard breaks. */
    [data-page-break] {
      break-after: page;
      height: 0;
      border: none;
      margin: 0;
    }

    /* Collaboration artefacts that ride along in the document HTML. */
    [data-comment-id], .lb-comment-mark, .tiptap-thread--inline {
      background: none;
      border: none;
    }
  `;
}

function buildDocument(title: string, contentHtml: string, geometry: PageGeometry) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${buildStyles(geometry)}</style>
</head>
<body>${contentHtml}</body>
</html>`;
}

/** Resolves once webfonts and images are ready, or after a short timeout. */
function whenReady(frameWindow: Window) {
  const doc = frameWindow.document;

  const images = Array.from(doc.images).map((image) =>
    image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        })
  );

  const assets = Promise.all([doc.fonts?.ready ?? Promise.resolve(), ...images]);

  // Never block the print dialog on an asset that will not arrive.
  return Promise.race([
    assets,
    new Promise((resolve) => frameWindow.setTimeout(resolve, ASSET_WAIT_TIMEOUT_MS)),
  ]);
}

export interface PrintDocumentArgs {
  title: string;
  /** `editor.getHTML()` — the document content, without any app chrome. */
  contentHtml: string;
  geometry: PageGeometry;
}

export function printDocument({ title, contentHtml, geometry }: PrintDocumentArgs) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  let cleanedUp = false;
  const cleanUp = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    iframe.remove();
  };

  iframe.addEventListener('load', () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanUp();
      return;
    }

    void whenReady(frameWindow).then(() => {
      frameWindow.addEventListener('afterprint', cleanUp, { once: true });
      // Not every browser fires afterprint; without a fallback the iframe would
      // leak into the page for the rest of the session.
      window.setTimeout(cleanUp, CLEANUP_FALLBACK_MS);

      frameWindow.focus();
      frameWindow.print();
    });
  });

  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    cleanUp();
    return;
  }

  frameDocument.open();
  frameDocument.write(buildDocument(title, contentHtml, geometry));
  frameDocument.close();
}
