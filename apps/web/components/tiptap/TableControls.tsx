'use client';

import { Button } from '@repo/ui/components/ui/button';
import type { Editor } from '@tiptap/core';
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  TableColumnsSplit,
  Table as TableIcon,
  TableRowsSplit,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MIN_COLUMN_WIDTH_PX, MIN_ROW_HEIGHT_PX, type TableSelectionInfo } from './TableExtensions';

/** The hover grid's size; larger tables are typed into the fields below it. */
const GRID_ROWS = 8;
const GRID_COLS = 8;

const MAX_ROWS = 100;
const MAX_COLS = 20;

/** How many rows or columns one click of an insert button may add. */
const MAX_INSERT = 50;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min));
}

/**
 * The table button and the picker it opens: hover the grid for a small
 * table, or type the size for a larger one.
 */
export function TableInsertMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ rows: number; cols: number } | null>(null);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const insert = (rowCount: number, colCount: number) => {
    editor
      .chain()
      .focus()
      .insertTableFigure({
        rows: clamp(rowCount, 1, MAX_ROWS),
        cols: clamp(colCount, 1, MAX_COLS),
      })
      .run();
    setOpen(false);
    setHover(null);
  };

  const shown = hover ?? { rows, cols };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant={open ? 'secondary' : 'ghost'}
        size="icon-xs"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="Insert a table — captioned TABLE N above"
      >
        <TableIcon className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-background p-2.5 shadow-md">
          <p className="mb-1.5 text-[11px] font-semibold text-foreground">
            {shown.rows} × {shown.cols} table
          </p>

          {/* biome-ignore lint/a11y/noStaticElementInteractions: the grid is a
              pointer shortcut; the fields below are the accessible route. */}
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
            onMouseLeave={() => setHover(null)}
          >
            {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, index) => {
              const row = Math.floor(index / GRID_COLS) + 1;
              const col = (index % GRID_COLS) + 1;
              const active = row <= shown.rows && col <= shown.cols;
              return (
                <button
                  key={`${row}-${col}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={`${row} by ${col} table`}
                  onMouseEnter={() => setHover({ rows: row, cols: col })}
                  onClick={() => insert(row, col)}
                  className={`aspect-square rounded-[2px] border ${
                    active ? 'border-primary bg-primary/20' : 'border-border bg-muted/40'
                  }`}
                />
              );
            })}
          </div>

          <div className="mt-2.5 flex items-end gap-2 border-t border-border pt-2.5">
            <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
              Rows
              <input
                type="number"
                min={1}
                max={MAX_ROWS}
                value={rows}
                onChange={(event) => setRows(Number(event.target.value))}
                className="h-6 w-14 rounded border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
              Columns
              <input
                type="number"
                min={1}
                max={MAX_COLS}
                value={cols}
                onChange={(event) => setCols(Number(event.target.value))}
                className="h-6 w-14 rounded border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus:border-primary"
              />
            </label>
            <Button
              type="button"
              size="sm"
              className="ml-auto h-6 px-2 text-[11px]"
              onClick={() => insert(rows, cols)}
            >
              Insert
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            The first row is a header row.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * A size field that commits on Enter or blur, and clears the size when left
 * empty so the row or column goes back to fitting its content.
 */
function SizeField({
  label,
  value,
  min,
  onCommit,
}: {
  label: string;
  value: number | null;
  min: number;
  onCommit: (value: number | null) => void;
}) {
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    const next = Math.max(min, Math.round(parsed));
    if (next !== value) onCommit(next);
  };

  return (
    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
      {label}
      <input
        // Remounted when the selection moves to a differently sized row or
        // column, so the field shows that one's size, not the last typed.
        key={value ?? 'auto'}
        type="number"
        min={min}
        defaultValue={value ?? ''}
        placeholder="auto"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(event.currentTarget.value);
          }
        }}
        onBlur={(event) => commit(event.currentTarget.value)}
        className="h-6 w-14 rounded border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus:border-primary"
      />
      px
    </label>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Editing controls for the table the caret is in: insert and delete rows and
 * columns, size them, and delete the whole table.
 *
 * Inserts add as many as the count field says. Deletes remove every row or
 * column the selection touches, so drag across cells to remove several.
 */
export function TableToolbar({ editor, info }: { editor: Editor; info: TableSelectionInfo }) {
  const [count, setCount] = useState(1);
  const n = clamp(count, 1, MAX_INSERT);

  const repeat = (
    command: 'addRowBefore' | 'addRowAfter' | 'addColumnBefore' | 'addColumnAfter'
  ) => {
    // One chain, so the whole insert is a single undo step.
    let chain = editor.chain().focus();
    for (let i = 0; i < n; i++) chain = chain[command]();
    chain.run();
  };

  // Deleting every row or column would leave an empty table, which the
  // schema does not allow; the author means "delete the table" then.
  const deletesAllRows = info.rows >= info.totalRows;
  const deletesAllCols = info.cols >= info.totalCols;

  return (
    <div className="flex basis-full flex-wrap items-center gap-1 border-t border-border pt-1.5 mt-0.5">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Table
      </span>

      <label
        className="flex items-center gap-1 text-[10px] text-muted-foreground"
        title="How many rows or columns each insert button adds"
      >
        Insert
        <input
          type="number"
          min={1}
          max={MAX_INSERT}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          onBlur={() => setCount(n)}
          className="h-6 w-11 rounded border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus:border-primary"
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => repeat('addRowBefore')}
        title={`Insert ${plural(n, 'row')} above`}
      >
        <BetweenHorizontalStart className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => repeat('addRowAfter')}
        title={`Insert ${plural(n, 'row')} below`}
      >
        <BetweenHorizontalEnd className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => repeat('addColumnBefore')}
        title={`Insert ${plural(n, 'column')} to the left`}
      >
        <BetweenVerticalStart className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => repeat('addColumnAfter')}
        title={`Insert ${plural(n, 'column')} to the right`}
      >
        <BetweenVerticalEnd className="h-4 w-4" />
      </Button>

      <div className="w-px h-5 bg-border mx-1 self-center" />

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={deletesAllRows}
        onClick={() => editor.chain().focus().deleteRow().run()}
        title={
          deletesAllRows
            ? 'Every row is selected — use Delete table instead'
            : `Delete ${plural(info.rows, 'row')} (select across cells to delete several)`
        }
        className="text-destructive hover:bg-destructive/10"
      >
        <TableRowsSplit className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={deletesAllCols}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        title={
          deletesAllCols
            ? 'Every column is selected — use Delete table instead'
            : `Delete ${plural(info.cols, 'column')} (select across cells to delete several)`
        }
        className="text-destructive hover:bg-destructive/10"
      >
        <TableColumnsSplit className="h-4 w-4" />
      </Button>

      <div className="w-px h-5 bg-border mx-1 self-center" />

      <SizeField
        label="Row height"
        value={info.rowHeight}
        min={MIN_ROW_HEIGHT_PX}
        onCommit={(height) => editor.chain().focus().setRowHeight(height).run()}
      />
      <SizeField
        label="Column width"
        value={info.columnWidth}
        min={MIN_COLUMN_WIDTH_PX}
        onCommit={(width) => editor.chain().focus().setColumnWidth(width).run()}
      />

      <div className="w-px h-5 bg-border mx-1 self-center" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().deleteTable().run()}
        title="Delete this table, with its caption"
        className="h-6 gap-1 px-2 text-[11px] text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete table
      </Button>
    </div>
  );
}
