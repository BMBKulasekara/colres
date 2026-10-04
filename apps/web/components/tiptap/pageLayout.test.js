import assert from 'node:assert/strict';
import { test } from 'vitest';
import { computePageLayout, computePageLayoutWithRunIns } from './pageLayout.ts';

// A4 at 96dpi with one-inch margins and the 24px on-screen gutter.
const PERIOD = 1123 + 24;
const CONTENT_HEIGHT = 1123 - 96 * 2;

/** Builds blocks stacked back to back, as an unpaginated flow would lay them out. */
function stack(heights, hardBreakIndices = []) {
  let top = 0;
  return heights.map((height, index) => {
    const block = {
      naturalTop: top,
      height,
      isHardBreak: hardBreakIndices.includes(index),
    };
    top += height;
    return block;
  });
}

/** Final top of each block once the computed pushes are applied. */
function finalTops(blocks, pushPx) {
  let shift = 0;
  return blocks.map((block, index) => {
    shift += pushPx[index];
    return block.naturalTop + shift;
  });
}

test('leaves a document that fits on one page untouched', () => {
  const blocks = stack([100, 200, 300]);
  const layout = computePageLayout(blocks, PERIOD, CONTENT_HEIGHT);

  assert.deepEqual(layout.pushPx, [0, 0, 0]);
  assert.equal(layout.pageCount, 1);
});

test('pushes a block that would straddle the page boundary onto the next page', () => {
  // Three 400px blocks: the third would run from 800 to 1200, past the 931px
  // writable height, so it has to start page two.
  const blocks = stack([400, 400, 400]);
  const layout = computePageLayout(blocks, PERIOD, CONTENT_HEIGHT);

  assert.deepEqual(layout.pushPx, [0, 0, PERIOD - 800]);
  assert.deepEqual(finalTops(blocks, layout.pushPx), [0, 400, PERIOD]);
  assert.equal(layout.pageCount, 2);
});

test('never pushes a block taller than a page, which could not fit anywhere', () => {
  const blocks = stack([100, CONTENT_HEIGHT + 500]);
  const layout = computePageLayout(blocks, PERIOD, CONTENT_HEIGHT);

  assert.deepEqual(layout.pushPx, [0, 0], 'an oversized block stays where it is');
});

test('a block landing exactly on the page boundary is not pushed twice', () => {
  // The second block is pushed to exactly PERIOD; flooring that back to page 0
  // would push it a second time and leave a blank page.
  const blocks = stack([CONTENT_HEIGHT - 50, 100, 100]);
  const layout = computePageLayout(blocks, PERIOD, CONTENT_HEIGHT);

  const tops = finalTops(blocks, layout.pushPx);
  assert.equal(tops[1], PERIOD, 'second block starts page two');
  assert.equal(layout.pushPx[2], 0, 'the block after it still fits on page two');
  assert.equal(layout.pageCount, 2);
});

test('a hard break sends the following block to the next page', () => {
  const blocks = stack([100, 2, 100], [1]);
  const layout = computePageLayout(blocks, PERIOD, CONTENT_HEIGHT);

  const tops = finalTops(blocks, layout.pushPx);
  assert.equal(tops[2], PERIOD, 'content after the break starts page two');
  assert.equal(layout.pageCount, 2);
});

test('a hard break at the end of the document still opens a page', () => {
  const blocks = stack([100, 2], [1]);
  const layout = computePageLayout(blocks, PERIOD, CONTENT_HEIGHT);

  assert.equal(layout.pageCount, 2);
});

test('consecutive hard breaks produce one empty page each', () => {
  const blocks = stack([100, 2, 2, 100], [1, 2]);
  const layout = computePageLayout(blocks, PERIOD, CONTENT_HEIGHT);

  const tops = finalTops(blocks, layout.pushPx);
  assert.equal(tops[2], PERIOD, 'the second break sits on page two');
  assert.equal(tops[3], PERIOD * 2, 'content resumes on page three');
  assert.equal(layout.pageCount, 3);
});

test('pushes accumulate across several pages', () => {
  const blocks = stack(Array.from({ length: 12 }, () => 300));
  const layout = computePageLayout(blocks, PERIOD, CONTENT_HEIGHT);

  const tops = finalTops(blocks, layout.pushPx);
  for (const [index, top] of tops.entries()) {
    const page = Math.floor(top / PERIOD);
    const offsetInPage = top - page * PERIOD;
    assert.ok(
      offsetInPage + blocks[index].height <= CONTENT_HEIGHT + 0.5,
      `block ${index} overflows page ${page + 1}`
    );
  }
  // Three 300px blocks fit per 931px page, so twelve blocks fill four pages.
  assert.equal(layout.pageCount, 4);
});

test('handles an empty document', () => {
  const layout = computePageLayout([], PERIOD, CONTENT_HEIGHT);

  assert.deepEqual(layout.pushPx, []);
  assert.equal(layout.pageCount, 1);
});

test('a block with a minimum offset is held down to it within its page', () => {
  const { pushPx } = computePageLayout(
    [
      { naturalTop: 0, height: 40, isHardBreak: false },
      { naturalTop: 40, height: 40, isHardBreak: false, minOffsetInPage: 500 },
      { naturalTop: 80, height: 40, isHardBreak: false },
    ],
    1100,
    1000
  );
  assert.deepEqual(pushPx, [0, 460, 0]);
});

test('a run-in heading moves by margin with the paragraph it runs into', () => {
  // Heading and paragraph share a top; the paragraph overflows page one.
  const layout = computePageLayoutWithRunIns(
    [
      { naturalTop: 0, height: 960, isHardBreak: false },
      { naturalTop: 960, height: 40, isHardBreak: false },
      { naturalTop: 960, height: 80, isHardBreak: false },
    ],
    [false, true, false],
    1100,
    1000
  );
  assert.deepEqual(layout.pushPx, [0, 0, 140]);
  assert.deepEqual(layout.marginPx, [0, 140, 0]);
  assert.equal(layout.pageCount, 2);
});

test('a run-in heading with nothing after it is an ordinary block', () => {
  const layout = computePageLayoutWithRunIns(
    [{ naturalTop: 990, height: 40, isHardBreak: false }],
    [true],
    1100,
    1000
  );
  assert.deepEqual(layout.pushPx, [110]);
  assert.deepEqual(layout.marginPx, [0]);
});
