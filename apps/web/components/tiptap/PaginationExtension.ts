import type { Editor } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { DEFAULT_PAGE_GEOMETRY, type PageGeometry } from '../../lib/pageGeometry';
import { computePageLayout, EPSILON, type MeasuredBlock } from './pageLayout';

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

function measure(view: EditorView, options: PaginationOptions, storage: PaginationStorage) {
  const dom = view.dom as HTMLElement;
  if (!storage.enabled || !dom.isConnected) return;

  // Measure against the pristine layout. A padding push can change how margins
  // collapse *inside* the block it is applied to, so natural heights are only
  // trustworthy with every decoration removed. Clearing and re-applying within
  // a single task means the browser never paints the undecorated state.
  if ((paginationKey.getState(view.state)?.find().length ?? 0) > 0) {
    applyDecorations(view, DecorationSet.empty);
  }

  const positions: Block[] = [];
  const measured: MeasuredBlock[] = [];

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
    });
  });

  if (!mappingIsSound) {
    // Leaving the document unbroken is better than drawing breaks in the
    // wrong places.
    return;
  }

  const { geometry, gapPx } = options;

  const layout = computePageLayout(
    measured,
    geometry.pageHeightPx + gapPx,
    geometry.contentHeightPx
  );

  const decorations: Decoration[] = [];
  layout.pushPx.forEach((push, index) => {
    const block = positions[index];
    if (!block || push <= 0) return;
    decorations.push(
      Decoration.node(block.pos, block.pos + block.size, { style: `padding-top:${push}px` })
    );
  });

  applyDecorations(view, DecorationSet.create(view.state.doc, decorations));

  if (layout.pageCount !== storage.pageCount) {
    storage.pageCount = layout.pageCount;
    options.onPagesChange?.(layout.pageCount);
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
