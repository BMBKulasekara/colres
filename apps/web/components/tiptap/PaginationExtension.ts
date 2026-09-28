import type { Editor } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { DEFAULT_PAGE_GEOMETRY, type PageGeometry } from '../../lib/pageGeometry';
import {
  computeColumnLayout,
  computePageLayoutWithRunIns,
  EPSILON,
  type MeasuredBlock,
} from './pageLayout';

/**
 * Word-style page simulation for a single continuous ProseMirror document.
 *
 * ProseMirror is one contenteditable region; splitting content into real page
 * containers would break selection, caret movement and copy/paste across page
 * boundaries. So pages are simulated instead: the editor is constrained to the
 * width of a page, and any block that would overflow the bottom of its page is
 * pushed to the top of the next one.
 *
 * Two decisions are load-bearing:
 *
 * 1. Breaks are ProseMirror *decorations*, never document nodes. A computed
 *    break is a measurement of one client's layout — fonts, zoom, browser. If
 *    it were written into the document it would sync through Yjs to every
 *    collaborator, who would then re-measure and sync back. Decorations are
 *    view-only, so each client paginates for itself and the shared document
 *    never notices. (Hard breaks the author inserts are a different thing and
 *    are a real node — see `PageBreakNode`.)
 *
 * 2. Blocks are pushed with `padding-top` rather than a spacer element.
 *    Inserting an element between two blocks stops their margins collapsing
 *    and so changes the very heights being measured; padding never collapses
 *    and never affects a sibling.
 *
 * Known limit: breaks land on block boundaries. A single block taller than one
 * page — a very long paragraph, a tall table — still straddles the boundary,
 * because splitting inside a block needs line-box measurement.
 *
 * Two-column documents (the IEEE conference and journal formats) take a second
 * path through the same machinery. Padding cannot express a column layout —
 * blocks have to move sideways — so there each block is displaced individually
 * with a relative offset instead. Relative positioning moves the painted box
 * and its hit-testing box together, so the caret still lands where the text is
 * drawn, while the flow underneath stays the single column ProseMirror
 * expects.
 */

/** Where a top-level node sits in the document, for anchoring its decoration. */
interface Block {
  pos: number;
  size: number;
}

export interface PaginationOptions {
  geometry: PageGeometry;
  /** Visual gutter drawn between two pages, in px. */
  gapPx: number;
  onPagesChange?: (pageCount: number) => void;
}

interface PaginationStorage {
  enabled: boolean;
  pageCount: number;
  /** Set by the plugin view so the imperative helpers below can trigger a pass. */
  schedule: (() => void) | null;
  /** Mirrored from the options so the helpers can report a reset to one page. */
  onPagesChange: ((pageCount: number) => void) | null;
}

const paginationKey = new PluginKey<DecorationSet>('pagination');

const MEASURE_DEBOUNCE_MS = 150;

function applyDecorations(view: EditorView, decorations: DecorationSet) {
  const tr = view.state.tr;
  tr.setMeta(paginationKey, decorations);
  // Presentation only: it must not enter the undo stack and must not mark the
  // document dirty. It carries no steps, so Yjs has nothing to broadcast.
  tr.setMeta('addToHistory', false);
  tr.setMeta('preventUpdate', true);
  view.dispatch(tr);
}

/**
 * How far into the document a banner rule is still taken to end the title
 * block. Past this, a horizontal rule is just a divider the author wanted.
 */
const BANNER_SCAN_LIMIT = 16;

/**
 * Number of leading blocks that span the full measure in a two-column layout.
 *
 * The convention is the one the templates already follow: the title block runs
 * from the top of the document to the first horizontal rule, and the columns
 * start after it. That is how the publisher classes work too — `\maketitle`
 * and the abstract span both columns in IEEEtran — and it keeps the marker
 * visible and deletable in the editor rather than hiding it in metadata.
 *
 * A document with no rule near the top has no banner: everything flows into
 * the columns.
 */
function countBannerBlocks(doc: EditorView['state']['doc']): number {
  let banner = 0;
  let index = 0;

  doc.forEach((node) => {
    if (banner > 0 || index >= BANNER_SCAN_LIMIT) {
      index += 1;
      return;
    }
    if (node.type.name === 'horizontalRule') banner = index + 1;
    index += 1;
  });

  return banner;
}

/**
 * Decorations that follow from the document's structure alone, never from a
 * measurement: which blocks span the measure and which are column width.
 *
 * They have to stay applied while natural heights are being measured, because
 * they set the width every line break depends on. Only the positional
 * decorations are stripped for the measuring pass.
 */
function spanDecorations(doc: EditorView['state']['doc'], bannerCount: number): Decoration[] {
  const decorations: Decoration[] = [];
  let index = 0;

  doc.forEach((node, offset) => {
    decorations.push(
      Decoration.node(offset, offset + node.nodeSize, {
        class: index < bannerCount ? 'page-flow__span' : 'page-flow__column',
      })
    );
    index += 1;
  });

  return decorations;
}

function measure(view: EditorView, options: PaginationOptions, storage: PaginationStorage) {
  const dom = view.dom as HTMLElement;
  if (!storage.enabled || !dom.isConnected) return;

  const { geometry, gapPx } = options;
  const isColumnFlow = geometry.columns > 1;
  const bannerCount = isColumnFlow ? countBannerBlocks(view.state.doc) : 0;

  // Width-setting decorations are re-derived every pass and kept applied
  // throughout, so the heights measured below are the heights the final layout
  // gets. Without them a column-width paragraph would be measured at the full
  // measure and come out half as tall as it really is.
  const structural = isColumnFlow ? spanDecorations(view.state.doc, bannerCount) : [];

  // Measure against the pristine layout. A padding push can change how margins
  // collapse *inside* the block it is applied to, so natural heights are only
  // trustworthy with every positional decoration removed. Clearing and
  // re-applying within a single task means the browser never paints the
  // undecorated state.
  applyDecorations(view, DecorationSet.create(view.state.doc, structural));

  const positions: Block[] = [];
  const measured: MeasuredBlock[] = [];
  /**
   * Blocks floated into the start of the block after them — APA's run-in
   * Level 4 and 5 headings. They share a line with that paragraph, so on the
   * page they are not blocks of their own: they go wherever it goes.
   */
  const runIn: boolean[] = [];

  const paddingTop = Number.parseFloat(getComputedStyle(dom).paddingTop) || 0;
  const originTop = dom.getBoundingClientRect().top + dom.clientTop + paddingTop;

  let mappingIsSound = true;
  view.state.doc.forEach((node, offset) => {
    if (!mappingIsSound) return;

    // Asking the view for each node's element, rather than pairing document
    // children with DOM children by index, keeps this correct even when another
    // plugin renders extra top-level DOM of its own.
    const element = view.nodeDOM(offset);
    if (!(element instanceof HTMLElement)) {
      mappingIsSound = false;
      return;
    }

    const rect = element.getBoundingClientRect();
    positions.push({ pos: offset, size: node.nodeSize });
    measured.push({
      naturalTop: rect.top - originTop,
      height: rect.height,
      isHardBreak: node.type.name === 'pageBreak',
      // APA's Author Note sits in the bottom half of the title page.
      minOffsetInPage:
        element.getAttribute('data-apa-role') === 'author-note'
          ? geometry.contentHeightPx / 2
          : undefined,
    });
    runIn.push(!isColumnFlow && getComputedStyle(element).float !== 'none');
  });

  if (!mappingIsSound) {
    // Leaving the document unbroken is better than drawing breaks in the
    // wrong places.
    return;
  }

  const period = geometry.pageHeightPx + gapPx;

  const decorations: Decoration[] = [];
  let pageCount: number;

  if (isColumnFlow) {
    const layout = computeColumnLayout(measured, {
      columnsPerPage: geometry.columns,
      columnWidth: geometry.columnWidthPx,
      columnGap: geometry.columnGapPx,
      contentHeight: geometry.contentHeightPx,
      period,
      bannerCount,
    });

    pageCount = layout.pageCount;

    // One decoration per block carrying both the width class and the offset,
    // rather than layering a second decoration over the structural one.
    layout.offsets.forEach((offset, index) => {
      const block = positions[index];
      if (!block) return;
      decorations.push(
        Decoration.node(block.pos, block.pos + block.size, {
          class: index < bannerCount ? 'page-flow__span' : 'page-flow__column',
          // `relative` leaves the block in the flow the measuring pass read,
          // so the next pass measures the same natural layout again.
          style: `position:relative;left:${offset.dx}px;top:${offset.dy}px`,
        })
      );
    });
  } else {
    // Run-in headings follow the paragraph they sit in; see
    // computePageLayoutWithRunIns for why they are moved by margin.
    const layout = computePageLayoutWithRunIns(measured, runIn, period, geometry.contentHeightPx);

    pageCount = layout.pageCount;

    positions.forEach((block, index) => {
      const push = layout.pushPx[index] ?? 0;
      const margin = layout.marginPx[index] ?? 0;
      if (push > 0) {
        decorations.push(
          Decoration.node(block.pos, block.pos + block.size, { style: `padding-top:${push}px` })
        );
      }
      if (margin > 0) {
        decorations.push(
          Decoration.node(block.pos, block.pos + block.size, { style: `margin-top:${margin}px` })
        );
      }
    });
  }

  applyDecorations(view, DecorationSet.create(view.state.doc, decorations));

  if (pageCount !== storage.pageCount) {
    storage.pageCount = pageCount;
    options.onPagesChange?.(pageCount);
  }
}

export const Pagination = Extension.create<PaginationOptions, PaginationStorage>({
  name: 'pagination',

  addOptions() {
    return {
      geometry: DEFAULT_PAGE_GEOMETRY,
      gapPx: 24,
      onPagesChange: undefined,
    };
  },

  addStorage() {
    return {
      enabled: false,
      pageCount: 1,
      schedule: null,
      onPagesChange: null,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const storage = this.storage;
    storage.onPagesChange = options.onPagesChange ?? null;

    return [
      new Plugin({
        key: paginationKey,

        state: {
          init: () => DecorationSet.empty,
          apply(tr, current) {
            const next = tr.getMeta(paginationKey) as DecorationSet | undefined;
            if (next) return next;
            return current.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return paginationKey.getState(state) ?? DecorationSet.empty;
          },
        },

        view(view) {
          let timer: number | undefined;
          let frame: number | undefined;

          const schedule = () => {
            if (timer !== undefined) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
              if (frame !== undefined) cancelAnimationFrame(frame);
              frame = requestAnimationFrame(() => measure(view, options, storage));
            }, MEASURE_DEBOUNCE_MS);
          };

          storage.schedule = schedule;

          // Only width matters. Observing height would re-trigger on the very
          // padding this extension applies.
          let lastWidth = view.dom.getBoundingClientRect().width;
          const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? 0;
            if (Math.abs(width - lastWidth) < EPSILON) return;
            lastWidth = width;
            schedule();
          });
          observer.observe(view.dom);

          // Web fonts land after first paint and change every line height.
          void document.fonts?.ready.then(schedule);

          return {
            update(_view, prevState) {
              if (!prevState.doc.eq(view.state.doc)) schedule();
            },
            destroy() {
              observer.disconnect();
              if (timer !== undefined) window.clearTimeout(timer);
              if (frame !== undefined) cancelAnimationFrame(frame);
              storage.schedule = null;
            },
          };
        },
      }),
    ];
  },
});

function getStorage(editor: Editor): PaginationStorage | null {
  const storage = editor.storage as unknown as Record<string, PaginationStorage | undefined>;
  return storage.pagination ?? null;
}

/**
 * Turns the paged view on or off.
 *
 * Kept as a plain function rather than a Tiptap command because switching off
 * has to dispatch a transaction of its own to drop the decorations, which does
 * not compose with a command chain.
 */
export function setPagedView(editor: Editor, enabled: boolean) {
  const storage = getStorage(editor);
  if (!storage || storage.enabled === enabled) return;

  storage.enabled = enabled;

  if (enabled) {
    storage.schedule?.();
    return;
  }

  applyDecorations(editor.view, DecorationSet.empty);
  storage.pageCount = 1;
  storage.onPagesChange?.(1);
}

/** Forces a pagination pass, for changes the plugin cannot observe itself. */
export function recalculatePages(editor: Editor) {
  getStorage(editor)?.schedule?.();
}
