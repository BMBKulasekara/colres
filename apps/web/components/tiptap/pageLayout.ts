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
