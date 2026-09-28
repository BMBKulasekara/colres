import { Table, TableRow } from '@tiptap/extension-table';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { deleteTable, isInTable, selectedRect } from '@tiptap/pm/tables';
import type { EditorView } from '@tiptap/pm/view';

/**
 * The table editing the paper needs beyond what the stock extension offers:
 * row heights, exact column widths, and deleting a table without stranding
 * its caption.
 *
 * Column widths already live on the cells (`colwidth`, which the stock column
 * resizer writes), so exact widths are written to the same place and the two
 * never disagree. Row heights have no home in the stock schema, so one is
 * added to the row.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableLayout: {
      /** Fixes the width of every column the selection touches; `null` frees it. */
      setColumnWidth: (width: number | null) => ReturnType;
      /** Sets a minimum height on every row the selection touches; `null` frees it. */
      setRowHeight: (height: number | null) => ReturnType;
    };
  }
}

/** Below this a row is too short to click into. */
export const MIN_ROW_HEIGHT_PX = 16;

/** Matches the stock extension's `cellMinWidth`. */
export const MIN_COLUMN_WIDTH_PX = 25;

/**
 * The table node, with `deleteTable` taught about captions.
 *
 * A table in this editor lives inside a `tableFigure` whose content is
 * `floatCaption table`, so removing only the table leaves a figure that the
 * schema does not allow. Deleting a table therefore deletes its figure — the
 * caption and number go with it, which is what an author means by "delete
 * this table". The stock select-all-then-Backspace shortcut calls this same
 * command, so it gets the fix too.
 */
export const ResearchTable = Table.extend({
  addCommands() {
    return {
      ...this.parent?.(),

      deleteTable:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === 'tableFigure') {
              if (dispatch) tr.delete($from.before(depth), $from.after(depth)).scrollIntoView();
              return true;
            }
          }
          // A bare table, pasted in from elsewhere.
          return deleteTable(state, dispatch);
        },

      setColumnWidth:
        (width) =>
        ({ state, tr, dispatch }) => {
          if (!isInTable(state)) return false;
          if (!dispatch) return true;

          const rect = selectedRect(state);
          const { map, table, tableStart } = rect;
          const seen = new Set<number>();

          for (let col = rect.left; col < rect.right; col++) {
            for (let row = 0; row < map.height; row++) {
              const cellPos = map.map[row * map.width + col]!;
              // A merged cell covers several slots of the map; update it once
              // per column, but only through the first slot that reaches it.
              const key = cellPos * 1000 + col;
              if (seen.has(key)) continue;
              seen.add(key);

              const cell = table.nodeAt(cellPos);
              if (!cell) continue;
              const index = col - map.colCount(cellPos);
              const widths: number[] = cell.attrs.colwidth
                ? [...cell.attrs.colwidth]
                : Array.from({ length: cell.attrs.colspan }, () => 0);
              widths[index] = width ?? 0;

              tr.setNodeMarkup(tableStart + cellPos, undefined, {
                ...cell.attrs,
                // All zero means "no widths at all", which the schema spells null.
                colwidth: widths.some(Boolean) ? widths : null,
              });
            }
          }
          return true;
        },
    };
  },
});

/** A table row that can be given a height. */
export const ResearchTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null as number | null,
        parseHTML: (element: HTMLElement) => {
          const value = Number.parseInt(element.style.height, 10);
          return Number.isFinite(value) && value > 0 ? value : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.height ? { style: `height: ${attributes.height}px` } : {},
      },
    };
  },

  addCommands() {
    return {
      setRowHeight:
        (height) =>
        ({ state, tr, dispatch }) => {
          if (!isInTable(state)) return false;
          if (!dispatch) return true;

          const rect = selectedRect(state);
          rect.table.forEach((row, offset, index) => {
            if (index < rect.top || index >= rect.bottom) return;
            tr.setNodeMarkup(rect.tableStart + offset, undefined, { ...row.attrs, height });
          });
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [rowResizing()];
  },
});

/**
 * What the table toolbar needs to know about the current selection: how many
 * rows and columns it spans, and the sizes set on the first of each.
 */
export interface TableSelectionInfo {
  rows: number;
  cols: number;
  totalRows: number;
  totalCols: number;
  rowHeight: number | null;
  columnWidth: number | null;
}

export function getTableSelectionInfo(state: EditorState): TableSelectionInfo | null {
  if (!isInTable(state)) return null;
  try {
    const rect = selectedRect(state);
    const { map, table } = rect;
    const cellPos = map.map[rect.top * map.width + rect.left]!;
    const cell = table.nodeAt(cellPos);
    const width = cell?.attrs.colwidth?.[rect.left - map.colCount(cellPos)];
    const height = table.child(rect.top).attrs.height;

    return {
      rows: rect.bottom - rect.top,
      cols: rect.right - rect.left,
      totalRows: map.height,
      totalCols: map.width,
      rowHeight: typeof height === 'number' && height > 0 ? height : null,
      columnWidth: typeof width === 'number' && width > 0 ? width : null,
    };
  } catch {
    // Mid-transaction the selection can briefly point outside a valid table.
    return null;
  }
}

/**
 * Drag the bottom edge of a row to change its height — the row counterpart
 * of the stock column resizer, and styled the same way.
 */
function rowResizing({ handleHeight = 5 }: { handleHeight?: number } = {}) {
  /** The row whose bottom edge the pointer is over. */
  let hoverRow: HTMLTableRowElement | null = null;
  let dragging = false;

  const setHover = (view: EditorView, row: HTMLTableRowElement | null) => {
    if (row === hoverRow) return;
    hoverRow = row;
    view.dom.classList.toggle('row-resize-cursor', row !== null);
  };

  return new Plugin({
    key: new PluginKey('rowResizing'),
    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          if (dragging) return false;
          if (!view.editable) {
            setHover(view, null);
            return false;
          }
          const cell = (event.target as HTMLElement | null)?.closest?.('td, th');
          let row: HTMLTableRowElement | null = null;
          if (cell && view.dom.contains(cell)) {
            const { bottom } = cell.getBoundingClientRect();
            if (Math.abs(bottom - event.clientY) <= handleHeight) {
              row = cell.closest('tr');
            }
          }
          setHover(view, row);
          return false;
        },

        mouseleave(view) {
          if (!dragging) setHover(view, null);
          return false;
        },

        mousedown(view, event) {
          const row = hoverRow;
          if (!row || !view.editable || event.button !== 0) return false;
          event.preventDefault();

          dragging = true;
          const startY = event.clientY;
          const startHeight = row.getBoundingClientRect().height;
          const heightAt = (clientY: number) =>
            Math.round(Math.max(MIN_ROW_HEIGHT_PX, startHeight + clientY - startY));
          const rowPosOf = (el: HTMLTableRowElement) => {
            if (!el.isConnected) return null;
            try {
              return view.posAtDOM(el, 0) - 1;
            } catch {
              return null;
            }
          };
          const startRowPos = rowPosOf(row);

          const onMove = (moveEvent: MouseEvent) => {
            row.style.height = `${heightAt(moveEvent.clientY)}px`;
          };

          const onUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            dragging = false;
            setHover(view, null);

            // Located from the DOM at the end of the drag rather than
            // remembered from its start, so edits made meanwhile by a
            // collaborator cannot send the height to the wrong row. The row
            // may have been re-rendered mid-drag (detaching `row`), so fall
            // back to where it was at mousedown.
            const rowPos = rowPosOf(row) ?? startRowPos;
            if (rowPos === null || rowPos < 0 || rowPos >= view.state.doc.content.size) return;
            const node = view.state.doc.nodeAt(rowPos);
            if (node?.type.name !== 'tableRow') return;
            view.dispatch(
              view.state.tr.setNodeMarkup(rowPos, undefined, {
                ...node.attrs,
                height: heightAt(upEvent.clientY),
              })
            );
          };

          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
          return true;
        },
      },
    },
  });
}
