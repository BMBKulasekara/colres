/**
 * The pagination arithmetic, with no DOM and no editor in sight.
 *
 * Kept separate from the ProseMirror plugin so the part most likely to be
 * subtly wrong — the page arithmetic — can be exercised directly in Node.
 *
 * Coordinates are relative to the top of the editor's content box, which is
 * also the top of page 1's writable area: the gutter above it is the editor's
 * own top padding. So page `n` (zero-based) accepts content in
 * `[n * period, n * period + contentHeight]`, where `period` is one page plus
 * the visual gap drawn beneath it.
 */

/** Anything below this is layout noise and must not trigger a push. */
export const EPSILON = 0.5;

/**
 * Nudge applied before flooring to a page index. A block pushed exactly onto a
 * page boundary can land a hair below it in floating point, which would floor
 * back to the previous page and push it a second time.
 */
const FLOOR_BIAS = 1e-6;

/** One measured block: where it sits in the pristine layout, and how tall it is. */
export interface MeasuredBlock {
  naturalTop: number;
  height: number;
  isHardBreak: boolean;
  /**
   * The highest the block may start within its page, measured from the top
   * of the writable area. APA's Author Note uses it to sit in the bottom half
   * of the title page however short the page above it is.
   */
  minOffsetInPage?: number;
}

export interface PageLayout {
  /** `pushPx[i]` is the padding to add to block `i`; zero means leave it alone. */
  pushPx: number[];
  pageCount: number;
}

/**
 * Works out how far each block has to be pushed down so that no block straddles
 * a page boundary.
 *
 * Blocks are visited in order carrying a running `shift`: a push displaces
 * everything after it by the same amount, which is why the natural tops can be
 * measured once against the undecorated layout and reused, rather than being
 * re-read from the DOM after every push.
 */
export function computePageLayout(
  blocks: readonly MeasuredBlock[],
  period: number,
  contentHeight: number
): PageLayout {
  const pushPx: number[] = new Array(blocks.length).fill(0);

  let shift = 0;
  // Top of the page the next block is forced onto by a hard break, if any.
  let forcedTop: number | null = null;
  // Highest page index reached. Counted directly rather than derived from the
  // bottom of the content, because a hard break opens a page whose content
  // bottom is zero — the page exists, it is simply empty.
  let lastPage = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) break;

    let finalTop = block.naturalTop + shift;
    let push = 0;

    if (forcedTop !== null && finalTop < forcedTop - EPSILON) {
      push += forcedTop - finalTop;
      finalTop = forcedTop;
    }
    forcedTop = null;

    if (block.minOffsetInPage !== undefined) {
      const anchor =
        Math.max(0, Math.floor(finalTop / period + FLOOR_BIAS)) * period + block.minOffsetInPage;
      if (finalTop < anchor - EPSILON) {
        push += anchor - finalTop;
        finalTop = anchor;
      }
    }

    const page = Math.max(0, Math.floor(finalTop / period + FLOOR_BIAS));
    const pageBottom = page * period + contentHeight;

    // A block taller than a whole page can never be made to fit, so pushing it
    // would only leave a blank page above it and still overflow.
    if (block.height <= contentHeight && finalTop + block.height > pageBottom + EPSILON) {
      push += (page + 1) * period - finalTop;
    }

    if (push > EPSILON) {
      const rounded = Math.round(push);
      shift += rounded;
      pushPx[i] = rounded;
      finalTop = block.naturalTop + shift;
    }

    // The last page this block reaches. Normally its own, but a block taller
    // than a page spills across several.
    const bottom = finalTop + block.height;
    lastPage = Math.max(lastPage, Math.floor(Math.max(0, bottom - EPSILON) / period));

    if (block.isHardBreak) {
      const breakPage = Math.floor(finalTop / period + FLOOR_BIAS) + 1;
      forcedTop = breakPage * period;
      // A hard break opens its page even when nothing follows it.
      lastPage = Math.max(lastPage, breakPage);
    }
  }

  return { pushPx, pageCount: lastPage + 1 };
}

export interface RunInPageLayout extends PageLayout {
  /** `marginPx[i]` is the top margin to add to run-in block `i`; zero otherwise. */
  marginPx: number[];
}

/**
 * `computePageLayout` for a flow containing run-in blocks — APA's Level 4 and
 * 5 headings, floated into the start of the paragraph after them.
 *
 * A run-in block shares its first line with that paragraph, so it is not a
 * block of its own on the page: it is left out of the arithmetic and goes
 * wherever the paragraph goes. It cannot be moved the same way, though.
 * Padding on the paragraph does not move a float that precedes it; but the
 * float's top margin starts where the paragraph's box starts, so the same
 * amount applied as margin keeps the two on one line.
 *
 * `runIn[i]` marks block `i` as run-in. A run-in block with nothing after it
 * is treated as an ordinary block.
 */
export function computePageLayoutWithRunIns(
  blocks: readonly MeasuredBlock[],
  runIn: readonly boolean[],
  period: number,
  contentHeight: number
): RunInPageLayout {
  const glued = blocks.map((_, index) => Boolean(runIn[index]) && index < blocks.length - 1);
  const flowIndex = blocks.map((_, index) => index).filter((index) => !glued[index]);

  const layout = computePageLayout(
    flowIndex.map((index) => blocks[index] as MeasuredBlock),
    period,
    contentHeight
  );

  const pushPx: number[] = new Array(blocks.length).fill(0);
  const marginPx: number[] = new Array(blocks.length).fill(0);

  layout.pushPx.forEach((push, flowPosition) => {
    const index = flowIndex[flowPosition] as number;
    pushPx[index] = push;
    for (let previous = index - 1; previous >= 0 && glued[previous]; previous--) {
      marginPx[previous] = push;
    }
  });

  return { pushPx, marginPx, pageCount: layout.pageCount };
}

/* -------------------------------------------------------------------------- */
/*  Multi-column flow                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A block's displacement from where it naturally sits to where the column
 * layout puts it. Applied as a relative offset, so the block is painted (and
 * hit-tested) in its column while the surrounding flow is left alone.
 */
export interface BlockOffset {
  dx: number;
  dy: number;
}

export interface ColumnLayout {
  offsets: BlockOffset[];
  pageCount: number;
}

export interface ColumnLayoutOptions {
  /** Text columns on a page. Two for the IEEE conference and journal formats. */
  columnsPerPage: number;
  columnWidth: number;
  columnGap: number;
  /** Writable height of a page, before any banner is subtracted. */
  contentHeight: number;
  /** One page plus the gutter drawn beneath it. */
  period: number;
  /**
   * Number of leading blocks that span the full measure — the title, authors,
   * and anything else above the banner rule. They stay in natural flow.
   */
  bannerCount: number;
}

/**
 * Lays blocks out across the columns of a sequence of pages.
 *
 * Unlike the single-column case, this cannot be expressed as padding: a block
 * has to move sideways as well as down, which means each one is displaced
 * individually rather than carried along by a running shift. The natural flow
 * underneath is a single stack of column-width blocks, which is exactly what
 * makes the measured heights reusable — line breaking in the flow is already
 * the line breaking the column will get.
 *
 * Vertical positions are derived from the measured natural tops rather than by
 * accumulating heights, so the margins between two blocks survive the move.
 * The margin above the block that opens a column is dropped, which is what
 * every typesetter does at the top of a column.
 */
export function computeColumnLayout(
  blocks: readonly MeasuredBlock[],
  options: ColumnLayoutOptions
): ColumnLayout {
  const { columnsPerPage, columnWidth, columnGap, contentHeight, period, bannerCount } = options;

  const offsets: BlockOffset[] = blocks.map(() => ({ dx: 0, dy: 0 }));

  // The banner keeps its natural position, so its extent is simply how far the
  // last of those blocks reaches. Columns on page one start below it.
  let bannerHeight = 0;
  for (let i = 0; i < bannerCount && i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;
    bannerHeight = Math.max(bannerHeight, block.naturalTop + block.height);
  }

  const pageOf = (column: number) => Math.floor(column / columnsPerPage);
  const slotOf = (column: number) => column % columnsPerPage;
  const columnX = (column: number) => slotOf(column) * (columnWidth + columnGap);
  /** Columns on the first page are shortened by the banner above them. */
  const columnTop = (column: number) =>
    pageOf(column) * period + (pageOf(column) === 0 ? bannerHeight : 0);
  const columnHeight = (column: number) =>
    pageOf(column) === 0 ? Math.max(0, contentHeight - bannerHeight) : contentHeight;

  let column = 0;
  /** Natural top of the block that opens the current column. */
  let base: number | null = null;
  let forcedBreak = false;
  let lastColumn = 0;

  for (let i = bannerCount; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) break;

    if (forcedBreak) {
      column = (pageOf(column) + 1) * columnsPerPage;
      base = null;
      forcedBreak = false;
    }

    if (base === null) base = block.naturalTop;

    let top = block.naturalTop - base;
    const available = columnHeight(column);

    // A block taller than a whole column can never be made to fit, so moving
    // it would only leave an empty column behind and still overflow.
    if (top > EPSILON && top + block.height > available + EPSILON && block.height <= available) {
      column += 1;
      base = block.naturalTop;
      top = 0;
    }

    offsets[i] = {
      dx: Math.round(columnX(column)),
      dy: Math.round(columnTop(column) + top - block.naturalTop),
    };

    lastColumn = Math.max(lastColumn, column);

    // An over-tall block spills onto the pages below its own.
    const bottom = columnTop(column) + top + block.height;
    const spilledPage = Math.floor(Math.max(0, bottom - EPSILON) / period);
    if (spilledPage > pageOf(lastColumn)) {
      lastColumn = Math.max(lastColumn, spilledPage * columnsPerPage);
    }

    if (block.isHardBreak) forcedBreak = true;
  }

  // A hard break with nothing after it still opens its page.
  if (forcedBreak) lastColumn = (pageOf(lastColumn) + 1) * columnsPerPage;

  return { offsets, pageCount: pageOf(lastColumn) + 1 };
}
