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
  const { marginIn } = geometry;

  return `
    @page {
      size: ${geometry.cssPageSize};
      margin: ${marginIn.top}in ${marginIn.right}in ${marginIn.bottom}in ${marginIn.left}in;
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

    /*
     * Two-column formats. Unlike the on-screen preview, which has to move each
     * block itself, print can hand the whole job to CSS multi-column layout:
     * the flow container fragments across pages on its own, filling the left
     * column of each page before the right. column-fill: auto is what makes it
     * fill rather than balance, which is what a page-filling column layout
     * needs and what LaTeX does.
     *
     * The title block sits outside the container, so it spans the measure at
     * the top of page one, the way maketitle does in a publisher class.
     */
    .print-flow {
      column-count: ${geometry.columns};
      column-gap: ${geometry.columnGapPx}px;
      column-fill: auto;
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

    /* The banner rule is a layout marker in the editor, not printed matter:
       on paper its job is done by the title block simply ending. */
    .print-banner > hr:last-child { display: none; }

    /* Collaboration artefacts that ride along in the document HTML. */
    [data-comment-id], .lb-comment-mark, .tiptap-thread--inline {
      background: none;
      border: none;
    }

    ${geometry.styleId === 'ieee' ? IEEE_PRINT_STYLES : ''}
  `;
}

/**
 * IEEE typography for print. Deliberately a near-copy of the `.doc-ieee` rules
 * in `globals.css` rather than a shared file: the print document is rendered
 * into an iframe that has none of the app's stylesheets, and keeping the two
 * textually parallel is what lets them be compared when one is changed.
 */
const IEEE_PRINT_STYLES = `
    body {
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.25;
      text-align: justify;
      hyphens: auto;
      counter-reset: ieee-section;
    }

    h1 {
      font-size: 2.4em;
      font-weight: 400;
      line-height: 1.15;
      text-align: center;
      margin: 0 0 0.5em;
    }

    h2 {
      font-size: 1em;
      font-weight: 400;
      font-variant: small-caps;
      text-align: center;
      margin: 1.25em 0 0.5em;
      counter-increment: ieee-section;
      counter-reset: ieee-subsection;
    }

    h2::before { content: counter(ieee-section, upper-roman) "."; margin-right: 0.4em; }

    h3 {
      font-size: 1em;
      font-weight: 400;
      font-style: italic;
      text-align: left;
      margin: 1em 0 0.35em;
      counter-increment: ieee-subsection;
    }

    h3::before { content: counter(ieee-subsection, upper-alpha) "."; margin-right: 0.4em; }

    h2[data-unnumbered="true"], h3[data-unnumbered="true"] { counter-increment: none; }
    h2[data-unnumbered="true"]::before, h3[data-unnumbered="true"]::before { content: none; }

    p { margin: 0; text-indent: 1em; }

    .print-banner > h1, .print-banner > p { text-align: center; text-indent: 0; }

    /* The abstract runs in from the margin, as Abstract— does in IEEEtran. */
    .print-flow > p:first-child { text-indent: 0; }

    ul, ol { margin: 0.4em 0; padding-left: 1.4em; }
    li { margin: 0; }
`;

/**
 * How far into the document a horizontal rule is still taken to end the title
 * block. Must match `BANNER_SCAN_LIMIT` in the pagination extension, or the
 * printout would put the columns somewhere the preview did not.
 */
const BANNER_SCAN_LIMIT = 16;

/**
 * Splits the document into the part that spans the measure and the part that
 * flows into columns, at the first horizontal rule near the top — the same
 * banner-rule convention the paged view uses.
 *
 * In a one-column document there is nothing to split, and a document with no
 * rule near the top has no title block: it all flows.
 */
function splitAtBannerRule(contentHtml: string, columns: number) {
  if (columns < 2 || typeof DOMParser === 'undefined') {
    return { banner: '', flow: contentHtml };
  }

  const body = new DOMParser().parseFromString(contentHtml, 'text/html').body;
  const children = Array.from(body.children);

  const ruleIndex = children.findIndex(
    (child, index) => index < BANNER_SCAN_LIMIT && child.tagName === 'HR'
  );

  if (ruleIndex < 0) return { banner: '', flow: contentHtml };

  const html = (nodes: Element[]) => nodes.map((node) => node.outerHTML).join('');

  return {
    banner: html(children.slice(0, ruleIndex + 1)),
    flow: html(children.slice(ruleIndex + 1)),
  };
}

function buildDocument(title: string, contentHtml: string, geometry: PageGeometry) {
  const { banner, flow } = splitAtBannerRule(contentHtml, geometry.columns);

  const body =
    geometry.columns > 1
      ? `${banner ? `<div class="print-banner">${banner}</div>` : ''}<div class="print-flow">${flow}</div>`
      : contentHtml;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${buildStyles(geometry)}</style>
</head>
<body>${body}</body>
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
