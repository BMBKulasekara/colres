/**
 * Lays a printed document out into explicit pages ("sheets"), each with its
 * own header.
 *
 * The browser's own print pagination cannot put a page number on each page
 * except through `@page` margin boxes, which only Chromium supports: Firefox
 * and Safari print them blank. No element in a continuous flow can know which
 * page it lands on either, because the browser decides that while printing.
 * So for formats with a page header (APA), the pages are made here instead:
 * every sheet is exactly one physical page, with the margins as padding and
 * the header drawn inside the top margin, and the printer is told to add no
 * margins of its own. Any browser prints that the same way.
 *
 * Content is moved into sheets one top-level block at a time and measured in
 * place, so what is measured is exactly what prints — floats, run-in headings
 * and all. A paragraph that does not fit is split between lines; a list is
 * split between items; anything else moves whole to the next page, taking
 * any heading that would otherwise be stranded at the foot of the page with
 * it. A single block taller than a page is left to overflow its sheet, which
 * the browser then carries onto the next sheet of paper — the one case where
 * a page number can drift, and the same known limit the on-screen page view
 * has.
 *
 * Self-contained, with no imports, because it runs inside the print iframe.
 */

export interface SheetOptions {
  pageWidthPx: number;
  pageHeightPx: number;
  margin: { top: number; right: number; bottom: number; left: number };
  /** Printed in capitals at the top left of every page, when given. */
  runningHead?: string;
}

/** Sub-pixel rounding in layout is not overflow. */
const TOLERANCE = 0.5;

const HEADING = /^H[1-6]$/;

export function paginateIntoSheets(doc: Document, options: SheetOptions): number {
  const { pageWidthPx, pageHeightPx, margin } = options;
  const contentHeight = pageHeightPx - margin.top - margin.bottom;

  const blocks = Array.from(doc.body.children) as HTMLElement[];
  for (const block of blocks) block.remove();

  let pageCount = 0;
  let body = newSheet();

  function newSheet(): HTMLElement {
    pageCount += 1;

    const sheet = doc.createElement('section');
    sheet.className = 'sheet';
    sheet.style.cssText =
      `width:${pageWidthPx}px;height:${pageHeightPx}px;` +
      `padding:${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px;`;

    const header = doc.createElement('div');
    header.className = 'sheet-header';
    header.style.cssText = `top:${margin.top / 2}px;left:${margin.left}px;right:${margin.right}px;`;

    const head = doc.createElement('span');
    head.className = 'sheet-running-head';
    head.textContent = options.runningHead ? options.runningHead.toUpperCase() : '';

    const number = doc.createElement('span');
    number.className = 'sheet-number';
    number.textContent = String(pageCount);

    header.append(head, number);

    const content = doc.createElement('div');
    content.className = 'sheet-body';
    content.style.height = `${contentHeight}px`;

    sheet.append(header, content);
    doc.body.append(sheet);
    return content;
  }

  /** How far down the sheet's content reaches, margins of the last block excluded. */
  function filledHeight(sheetBody: HTMLElement): number {
    const top = sheetBody.getBoundingClientRect().top;
    let bottom = 0;
    for (const child of Array.from(sheetBody.children)) {
      bottom = Math.max(bottom, child.getBoundingClientRect().bottom - top);
    }
    return bottom;
  }

  const fits = () => filledHeight(body) <= contentHeight + TOLERANCE;

  /** A block starting a page drops its top margin, as a typesetter would. */
  function append(block: HTMLElement) {
    if (body.children.length === 0 && pageCount > 1) block.style.marginTop = '0';
    body.append(block);

    // APA's Author Note sits in the bottom half of the title page.
    if (block.getAttribute('data-apa-role') === 'author-note') {
      const offset = block.getBoundingClientRect().top - body.getBoundingClientRect().top;
      const lift = contentHeight / 2 - offset;
      if (lift > 0) {
        const style = doc.defaultView?.getComputedStyle(block);
        const current = Number.parseFloat(style?.marginTop ?? '0') || 0;
        block.style.marginTop = `${current + lift}px`;
      }
    }
  }

  function place(block: HTMLElement, freshPage = false) {
    append(block);
    if (fits()) return;
    block.remove();

    const split = splitBlock(block);
    if (split) {
      body.append(split.head);
      if (fits()) {
        body = newSheet();
        place(split.tail, true);
        return;
      }
      split.head.remove();
    }

    // Keep headings with what follows them, rather than leaving one at the
    // foot of a page with its text overleaf.
    const carried: HTMLElement[] = [];
    if (!freshPage) {
      while (body.lastElementChild && HEADING.test(body.lastElementChild.tagName)) {
        const heading = body.lastElementChild as HTMLElement;
        heading.remove();
        carried.unshift(heading);
      }
    }

    if (freshPage || (body.children.length === 0 && carried.length === 0)) {
      // Already on a page of its own and still too tall: let it overflow.
      body.append(block);
      body.parentElement?.classList.add('sheet--overflow');
      body = newSheet();
      return;
    }

    // A page that held nothing but the carried headings is reused, not left blank.
    if (body.children.length > 0) body = newSheet();
    for (const heading of carried) append(heading);
    place(block, true);
  }

  /**
   * Splits a block at the last point that still fits the page, or returns
   * null when nothing of it fits.
   */
  function splitBlock(block: HTMLElement): { head: HTMLElement; tail: HTMLElement } | null {
    if (block.tagName === 'P') return splitParagraph(block);
    if (block.tagName === 'UL' || block.tagName === 'OL') return splitList(block);
    return null;
  }

  function splitParagraph(paragraph: HTMLElement) {
    body.append(paragraph);
    const limit = body.getBoundingClientRect().top + contentHeight + TOLERANCE;

    // Every character position in the paragraph, in order.
    const positions: { node: Text; offset: number }[] = [];
    const walker = doc.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      for (let offset = 0; offset < text.length; offset++) positions.push({ node: text, offset });
    }

    const bottomOf = (index: number) => {
      const position = positions[index] as { node: Text; offset: number };
      const range = doc.createRange();
      range.setStart(position.node, position.offset);
      range.setEnd(position.node, position.offset + 1);
      const rects = range.getClientRects();
      return rects.length ? (rects[rects.length - 1] as DOMRect).bottom : 0;
    };

    // Lines only go down, so the first character past the limit is found by
    // binary search. It opens the first line that does not fit.
    let low = 0;
    let high = positions.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (bottomOf(mid) > limit) high = mid;
      else low = mid + 1;
    }
    paragraph.remove();

    // Nothing fits, or everything does (the overflow was something else).
    if (low === 0 || low >= positions.length) return null;

    const at = positions[low] as { node: Text; offset: number };
    const head = paragraph.cloneNode(false) as HTMLElement;
    const tail = paragraph.cloneNode(false) as HTMLElement;

    const range = doc.createRange();
    range.setStart(paragraph, 0);
    range.setEnd(at.node, at.offset);
    head.append(range.cloneContents());

    range.setStart(at.node, at.offset);
    range.setEnd(paragraph, paragraph.childNodes.length);
    tail.append(range.cloneContents());

    // The rest of a paragraph carries on flush left, with no new indent.
    tail.classList.add('continued');
    return { head, tail };
  }

  function splitList(list: HTMLElement) {
    const items = Array.from(list.children);
    if (items.length < 2) return null;

    const head = list.cloneNode(false) as HTMLElement;
    body.append(head);

    let taken = 0;
    for (const item of items) {
      head.append(item.cloneNode(true));
      if (!fits()) {
        head.lastChild?.remove();
        break;
      }
      taken += 1;
    }
    head.remove();

    if (taken === 0 || taken === items.length) return null;

    const tail = list.cloneNode(false) as HTMLElement;
    for (const item of items.slice(taken)) tail.append(item.cloneNode(true));
    if (list.tagName === 'OL') {
      const start = Number(list.getAttribute('start') ?? '1');
      tail.setAttribute('start', String(start + taken));
    }
    return { head, tail };
  }

  for (const block of blocks) {
    // Author page breaks start a new sheet and are not printed themselves.
    if (block.hasAttribute('data-page-break')) {
      if (body.children.length > 0) body = newSheet();
      continue;
    }
    place(block);
  }

  // A trailing page break can leave an empty last sheet behind.
  const last = doc.body.lastElementChild;
  if (pageCount > 1 && last?.querySelector('.sheet-body')?.children.length === 0) {
    last.remove();
    pageCount -= 1;
  }

  return pageCount;
}
