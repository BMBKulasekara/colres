import { labelAuthorDateCitations } from '../../lib/authorDate';
import { escapeHtml, renderBibliographyHtml } from '../../lib/bibliographyHtml';
import {
  type CitationStyle,
  type DisplayReference,
  isAuthorDateStyle,
} from '../../lib/citationFormat';
import { type CitationOccurrence, numberCitations } from '../../lib/citationNumbering';
import {
  EM_SPACE,
  type FloatOccurrence,
  type FloatScheme,
  numberFloats,
} from '../../lib/floatNumbering';
import type { PageGeometry } from '../../lib/pageGeometry';
import { paginateIntoSheets } from './printPages';

/** A bibliography entry as the print path needs it. */
export interface PrintableReference extends DisplayReference {
  citationKey: string;
}

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

function buildStyles(geometry: PageGeometry) {
  const { marginIn } = geometry;

  return `
    @page {
      size: ${geometry.cssPageSize};
      /* Paged formats draw their own margins and header on each sheet; see
         printPages.ts. */
      margin: ${
        geometry.pageNumbers
          ? '0'
          : `${marginIn.top}in ${marginIn.right}in ${marginIn.bottom}in ${marginIn.left}in`
      };
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

    /* Fixed layout so the column widths set in the editor are the ones printed. */
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #999; padding: 0.35em 0.5em; text-align: left; }

    /* Citation markers are resolved to their numbers before this stylesheet
       ever sees them, so on paper they are plain text with no chip around
       them — see prepareDocumentForOutput. NOTE: no backticks in comments
       inside this template literal; they end the string. */
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

    /*
     * Figures and tables. The caption's label was written into the markup by
     * resolveFloats, so nothing here generates content: a browser's print
     * pipeline does not reliably carry CSS generated content into a PDF.
     *
     * A float and its caption are one object. break-inside: avoid is what
     * stops a caption being stranded at the top of the next column, which is
     * the commonest defect in a typeset paper.
     */
    .float {
      margin: 1em 0;
      break-inside: avoid;
    }

    .float-caption {
      display: block;
      text-align: center;
      text-indent: 0;
      margin: 0;
      font-size: 0.8em;
      line-height: 1.2;
    }

    .float-figure > .float-caption { margin-top: 0.5em; }
    .float-table > .float-caption { margin-bottom: 0.35em; }

    /* The note under a table or figure, its "Note." label written in by
       resolveFloats. */
    .float-note {
      margin: 0.35em 0 0;
      text-align: left;
      text-indent: 0;
      font-size: 0.8em;
    }

    /* A table's label sits on its own line above the title. */
    .float-label-line {
      display: block;
      text-transform: uppercase;
    }

    .float img {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      height: auto;
    }

    .float table {
      margin: 0 auto;
      border-collapse: collapse;
      width: 100%;
      font-size: 0.9em;
    }

    .float th, .float td {
      border: 1px solid #999;
      padding: 0.25em 0.45em;
      text-align: left;
      vertical-align: top;
    }

    .float th { font-weight: 700; text-align: center; }

    /*
     * A float set across both columns. CSS multi-column fragments the flow on
     * its own, and column-span: all is what lifts a block out of the columns
     * to span the measure — which is exactly what figure* and table* do in
     * LaTeX. The browser places it at the point it occurs rather than floating
     * it to the top of the page, which is the one thing here that a real
     * typesetter would do differently.
     */
    .float[data-span="page"] {
      column-span: all;
      break-inside: avoid;
    }

    /* A cross-reference is plain text on paper, not a chip. */
    [data-xref] {
      background: none;
      color: inherit;
      padding: 0;
      font: inherit;
    }

    /* A reference whose figure was deleted. Visible, so it cannot be missed. */
    .xref-dangling { font-weight: 700; }

    /*
     * The reference list. A two-column grid is the hanging indent: the number
     * sits flush in the left margin and the entry wraps against its own left
     * edge rather than under the bracket. Entries are single-spaced, separated
     * by a little space rather than by a blank line.
     */
    .bib-list {
      list-style: none;
      margin: 0.5em 0 0;
      padding: 0;
    }

    .bib-item {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 0.5em;
      margin: 0 0 0.35em;
      text-indent: 0;
      line-height: 1.25;
      break-inside: avoid;
    }

    /*
     * "References", centred and bold directly above the list. Selected by
     * adjacency rather than by a class, because the heading is the author's
     * own text and carries no marker of its own.
     */
    h1:has(+ .bib-list),
    h2:has(+ .bib-list),
    h3:has(+ .bib-list) {
      text-align: center;
      font-weight: 700;
    }

    .bib-marker { white-space: nowrap; }

    .bib-uncited { font-style: italic; }

    /* The section is generated, so an empty one is a note, not printed matter. */
    .bib-empty { display: none; }

    /* A citation resolved to no reference. Visible, so it cannot be missed. */
    .citation-unresolved { font-weight: 700; }

    /* Collaboration artefacts that ride along in the document HTML. */
    [data-comment-id], .lb-comment-mark, .tiptap-thread--inline {
      background: none;
      border: none;
    }

    ${geometry.styleId === 'ieee' ? IEEE_PRINT_STYLES : ''}
    ${geometry.styleId === 'apa' ? APA_PRINT_STYLES : ''}
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

    /*
     * IEEEtran sets the References heading in centred small capitals like any
     * other section, not in bold — so the generic rule above is undone here.
     * The reference list itself is set a size smaller, as IEEEtran does.
     */
    h2:has(+ .bib-list),
    h3:has(+ .bib-list) { font-weight: 400; }

    .bib-list { font-size: 0.9em; }
`;

/**
 * APA 7 typography for print. Deliberately a near-copy of the `.doc-apa` rules
 * in `globals.css`, for the same reason as the IEEE block above.
 *
 * APA prints through explicit sheets (`printPages.ts`), which moves every block
 * out of the body and drops the page breaks, so structural selectors such as
 * "before the first page break" cannot work here. The title page is marked with
 * classes before pagination instead — see `markApaStructure`.
 */
const APA_PRINT_STYLES = `
    body {
      font-family: 'Times New Roman', Times, serif;
      line-height: 2;
      text-align: left;
      hyphens: manual;
      max-width: none;
      margin: 0;
    }

    .sheet {
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      break-after: page;
      page-break-after: always;
    }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
    .sheet--overflow { overflow: visible; height: auto !important; }

    .sheet-header {
      position: absolute;
      transform: translateY(-50%);
      display: flex;
      justify-content: space-between;
      gap: 1em;
      line-height: 1.2;
    }
    .sheet-running-head { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .sheet-body { position: relative; }
    .sheet-body > :not(p) { clear: both; }

    h1, h2, h3, h4, h5, h6 {
      font-size: 1em;
      font-weight: 700;
      line-height: 2;
      margin: 0;
    }

    h1 { text-align: center; }
    h2 { text-align: left; }
    h3 { text-align: left; font-style: italic; }

    /* Levels 4 and 5 run in: indented like a paragraph, with the text
       continuing on the same line. */
    h4, h5 {
      float: left;
      margin: 0 0.3em 0 0.5in;
    }
    h5 { font-style: italic; }
    h4 + p, h5 + p { text-indent: 0; }

    p { margin: 0; text-indent: 0.5in; }
    p.continued { text-indent: 0; }

    /* The title page. */
    .title-page-title { margin-top: 6em; }
    p.title-page { text-align: center; text-indent: 0; }
    h1.title-page:not([data-apa-role]) + p.title-page { margin-top: 2em; }

    /* The author note: a bold centred label in the bottom half of the page,
       with at least one blank line above it, then ordinary paragraphs. */
    [data-apa-role="author-note"] { margin-top: 2em; }
    [data-apa-role="author-note"] ~ p.title-page { text-align: left; text-indent: 0.5in; }

    /* The abstract's first line is flush left. */
    [data-apa-role="abstract"] + p { text-indent: 0; }

    blockquote {
      border: none;
      padding: 0;
      margin: 0 0 0 0.5in;
      font-style: normal;
      break-inside: auto;
    }
    blockquote p { text-indent: 0; }
    blockquote p + p { text-indent: 0.5in; }

    ul, ol { margin: 0; padding-left: 0.5in; }
    li { margin: 0; }

    /* Tables and figures: bold number, italic title, both flush left above the
       body; an optional note below; a blank double-spaced line between the
       float and the text around it. */
    .float { margin: 2em 0; }
    .float-caption {
      text-align: left;
      font-size: 1em;
      line-height: 2;
      font-style: italic;
      margin: 0;
    }
    .float-figure > .float-caption, .float-table > .float-caption { margin: 0; }
    .float-label-line { font-weight: 700; font-style: normal; text-transform: none; }
    .float img { margin: 0; }
    .float-note { text-indent: 0; font-size: 1em; }

    /* APA tables have horizontal rules only: above and below the column
       headings, and at the foot of the table. */
    .float table { font-size: 1em; margin: 0; }
    .float th, .float td { border: none; padding: 0 0.5em; line-height: 1.5; }
    .float table { border-top: 1px solid #000; border-bottom: 1px solid #000; }
    .float th { border-bottom: 1px solid #000; }
    .float td p, .float th p { text-indent: 0; line-height: 1.5; }

    /* References: alphabetical, double-spaced, 0.5 in. hanging indent. */
    .bib-list { margin: 0; }
    .bib-item--hanging {
      display: block;
      margin: 0;
      padding-left: 0.5in;
      text-indent: -0.5in;
      line-height: 2;
      break-inside: auto;
    }
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

/**
 * Replaces every citation marker with its resolved label — a number, or for an
 * author–date style such as APA, "(Smith, 2020)".
 *
 * The document stores keys, not numbers — see `CitationExtension` — and the
 * marker carries no text of its own, so on paper it would be invisible unless
 * it is resolved here. This is the same labelling the editor draws, recomputed
 * from the same pure functions over the same document, so the printed "[3]" is
 * always the "[3]" the author was looking at.
 */
function resolveCitations(
  root: HTMLElement,
  references: readonly PrintableReference[],
  citationStyle: CitationStyle
) {
  const marks = Array.from(root.querySelectorAll('[data-citation]'));

  const occurrences: CitationOccurrence[] = marks.map((mark, index) => ({
    citationKey: mark.getAttribute('data-citation') ?? '',
    locator: mark.getAttribute('data-locator') || undefined,
    narrative: mark.getAttribute('data-narrative') === 'true',
    // Adjacency is read off the rendered HTML: anything but whitespace or a
    // separator between two markers keeps them as separate bracket groups.
    adjacentToPrevious:
      index > 0 && /^[\s,;]*$/.test(textBetween(marks[index - 1] as Element, mark)),
  }));

  const { labels } = isAuthorDateStyle(citationStyle)
    ? labelAuthorDateCitations(occurrences, references)
    : numberCitations(occurrences, new Set(references.map((reference) => reference.citationKey)));

  marks.forEach((mark, index) => {
    const label = labels[index];
    if (label?.hidden) {
      // The leader carries the whole group's label, separators included, so
      // the commas the author typed between the markers have to go with the
      // markers themselves — otherwise "[1], [2]" prints as "[1], [2], ".
      removeSeparatorBefore(mark);
      mark.remove();
      return;
    }
    mark.textContent = label?.text ?? '[?]';
    if (label?.unresolved) mark.classList.add('citation-unresolved');
  });
}

/**
 * Numbers the figures and tables, and every mention of them in the prose.
 *
 * The document stores a float's identity, never its number — see `FloatNodes`
 * — so on paper a caption would read as a bare sentence and a cross-reference
 * would be invisible unless they are resolved here. This is the same numbering
 * the editor draws, recomputed from the same pure functions over the same
 * document, so the printed "Fig. 3" is the "Fig. 3" the author was looking at.
 *
 * Unlike the editor, which can leave the label to CSS, print writes it into
 * the markup: `content: attr(...)` is generated content, and generated content
 * is not reliably carried into a PDF by every browser's print pipeline.
 */
function resolveFloats(root: HTMLElement, scheme: FloatScheme) {
  const floats = Array.from(root.querySelectorAll('[data-float]'));

  const occurrences: FloatOccurrence[] = floats.map((float) => ({
    id: float.getAttribute('data-float-id') ?? '',
    kind: float.getAttribute('data-float') === 'table' ? 'table' : 'figure',
  }));

  const labels = numberFloats(occurrences, scheme);

  floats.forEach((float, index) => {
    const id = occurrences[index]?.id ?? '';
    const caption = float.querySelector('figcaption');
    const label = labels.captionLabels.get(id);
    if (!caption || !label) return;

    // APA sets both labels on a line of their own, above the title, and
    // puts a figure's caption above the image — the opposite of IEEE. The
    // editor does the same move with CSS; here it is done in the markup.
    if (scheme === 'apa') {
      const line = root.ownerDocument.createElement('span');
      line.className = 'float-label-line';
      line.textContent = label;
      caption.prepend(line);
      float.prepend(caption);
      return;
    }

    // A table's label sits on its own line above the title; a figure's runs
    // into the caption after an em space.
    if (occurrences[index]?.kind === 'table') {
      const line = root.ownerDocument.createElement('span');
      line.className = 'float-label-line';
      line.textContent = label;
      caption.prepend(line);
    } else {
      caption.prepend(root.ownerDocument.createTextNode(`${label}${EM_SPACE}`));
    }
  });

  // "Note." is drawn by CSS in the editor; on paper it has to be real text.
  for (const note of Array.from(root.querySelectorAll('[data-float-note]'))) {
    const label = root.ownerDocument.createElement('i');
    label.textContent = 'Note.';
    note.prepend(label, root.ownerDocument.createTextNode(' '));
  }

  for (const mark of Array.from(root.querySelectorAll('[data-xref]'))) {
    const label = labels.referenceLabels.get(mark.getAttribute('data-xref') ?? '');
    mark.textContent = label ?? '[missing figure]';
    if (!label) mark.classList.add('xref-dangling');
  }
}

/** Strips the whitespace and punctuation joining a citation to the one before. */
function removeSeparatorBefore(mark: Element) {
  let node = mark.previousSibling;

  while (node && node.nodeType === Node.TEXT_NODE && /^[\s,;]*$/.test(node.textContent ?? '')) {
    const previous = node.previousSibling;
    node.parentNode?.removeChild(node);
    node = previous;
  }
}

/** The text lying between two elements in document order. */
function textBetween(from: Element, to: Element): string {
  let text = '';
  const walker = from.ownerDocument.createTreeWalker(
    from.ownerDocument.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );

  let seenFrom = false;
  let node = walker.nextNode();
  while (node) {
    if (node === to) break;
    if (seenFrom && node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
    // A block boundary separates citations regardless of the text.
    if (seenFrom && node instanceof HTMLElement && isBlockLevel(node)) text += '\n';
    if (node === from) seenFrom = true;
    node = walker.nextNode();
  }

  return text;
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

function isBlockLevel(element: HTMLElement): boolean {
  return BLOCK_TAGS.has(element.tagName);
}

/**
 * Puts the rendered list where the document says the References section is.
 *
 * Three cases, in order of how much the author has told us:
 *
 *  - a References section the author placed with the toolbar leaves an empty
 *    `<div data-bibliography>` behind, which is replaced outright. The author
 *    chose that spot, so it wins over anything inferred;
 *  - failing that, a heading reading "References" — matched on its text,
 *    because it is ordinary editable content with no marker on it;
 *  - failing that, the end of the document, which is where it belongs anyway.
 *
 * An empty bibliography still has to clear the placeholder, or the printout
 * carries an empty section the author cannot see to delete.
 */
function appendBibliography(root: HTMLElement, bibliographyHtml: string, singular = false) {
  const placeholder = root.querySelector('[data-bibliography]');

  // APA allows "Reference", singular, over a list of one. The editor hides the
  // plural "s" with a decoration; here the printed copy is simply changed.
  if (singular && placeholder) {
    const heading = placeholder.previousElementSibling;
    if (heading && /^H[1-6]$/.test(heading.tagName) && heading.textContent === 'References') {
      heading.textContent = 'Reference';
    }
  }

  if (!bibliographyHtml) {
    placeholder?.remove();
    return;
  }

  const container = root.ownerDocument.createElement('div');
  container.innerHTML = bibliographyHtml;
  const list = container.firstElementChild;
  if (!list) return;

  if (placeholder) {
    placeholder.replaceWith(list);
    return;
  }

  const headings = Array.from(root.querySelectorAll('h1, h2, h3'));
  const referencesHeading = headings.find((heading) =>
    /^\s*references\s*$/i.test(heading.textContent ?? '')
  );

  if (referencesHeading) referencesHeading.after(list);
  else root.append(list);
}

export interface BuildDocumentArgs {
  title: string;
  contentHtml: string;
  geometry: PageGeometry;
  references: readonly PrintableReference[];
  citationOrder: readonly string[];
  citationStyle: CitationStyle;
}

export function buildDocument({
  title,
  contentHtml,
  geometry,
  references,
  citationOrder,
  citationStyle,
}: BuildDocumentArgs) {
  const prepared = prepareDocumentForOutput(
    contentHtml,
    references,
    citationOrder,
    citationStyle,
    geometry.styleId === 'apa' ? 'apa' : 'ieee'
  );
  const { banner, flow } = splitAtBannerRule(prepared, geometry.columns);
  const apa = geometry.styleId === 'apa' ? markApaStructure(prepared) : null;

  const body =
    geometry.columns > 1
      ? `${banner ? `<div class="print-banner">${banner}</div>` : ''}<div class="print-flow">${flow}</div>`
      : (apa?.html ?? prepared);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
${apa?.runningHead ? `<meta name="running-head" content="${escapeHtml(apa.runningHead)}">` : ''}
<style>${buildStyles(geometry)}</style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * Marks the structure the APA stylesheet needs before the paper is cut into
 * sheets, which removes the page breaks those selectors would otherwise use:
 *
 *  - everything before the first page break is the title page, and the first
 *    heading on it is the paper title;
 *  - the running head is taken out of the flow, to be printed in every page's
 *    header instead.
 */
export function markApaStructure(html: string): { html: string; runningHead: string } {
  if (typeof DOMParser === 'undefined') return { html, runningHead: '' };

  const body = new DOMParser().parseFromString(html, 'text/html').body;

  const heads = Array.from(body.querySelectorAll('[data-running-head]'));
  const runningHead = heads[0]?.textContent?.trim() ?? '';
  for (const head of heads) head.remove();

  let titleSeen = false;
  for (const child of Array.from(body.children)) {
    if (child.hasAttribute('data-page-break')) break;
    child.classList.add('title-page');
    if (!titleSeen && child.tagName === 'H1') {
      child.classList.add('title-page-title');
      titleSeen = true;
    }
  }

  return { html: body.innerHTML, runningHead };
}

/**
 * Turns stored document HTML into output-ready HTML: citation markers resolved
 * to their numbers, and the reference list rendered under the References
 * heading.
 *
 * Exported because this is the step any exporter needs, not just printing — a
 * PDF or DOCX writer would start here too. Returns the content unchanged where
 * there is no DOM to parse with.
 */
export function prepareDocumentForOutput(
  contentHtml: string,
  references: readonly PrintableReference[],
  citationOrder: readonly string[],
  citationStyle: CitationStyle,
  floatScheme: FloatScheme = 'ieee'
): string {
  if (typeof DOMParser === 'undefined') return contentHtml;

  const parsed = new DOMParser().parseFromString(contentHtml, 'text/html');

  resolveCitations(parsed.body, references, citationStyle);
  resolveFloats(parsed.body, floatScheme);
  appendBibliography(
    parsed.body,
    renderBibliographyHtml(references, citationOrder, citationStyle),
    isAuthorDateStyle(citationStyle) && references.length === 1
  );

  return parsed.body.innerHTML;
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
  /** The bibliography, rendered under the document's References heading. */
  references?: readonly PrintableReference[];
  /** Citation keys in first-appearance order, for numbering that list. */
  citationOrder?: readonly string[];
  citationStyle?: CitationStyle;
}

export function printDocument({
  title,
  contentHtml,
  geometry,
  references = [],
  citationOrder = [],
  citationStyle = 'numeric',
}: PrintDocumentArgs) {
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
      // Formats with a page header are cut into explicit sheets once fonts and
      // images have settled, since every measurement depends on them.
      if (geometry.pageNumbers) {
        const frameDoc = frameWindow.document;
        paginateIntoSheets(frameDoc, {
          pageWidthPx: geometry.pageWidthPx,
          pageHeightPx: geometry.pageHeightPx,
          margin: geometry.margin,
          runningHead:
            frameDoc.querySelector('meta[name="running-head"]')?.getAttribute('content') ??
            undefined,
        });
      }

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
  frameDocument.write(
    buildDocument({ title, contentHtml, geometry, references, citationOrder, citationStyle })
  );
  frameDocument.close();
}
