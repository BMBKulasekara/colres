'use client';

import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { cn } from '@repo/ui/lib/utils';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { TableSkeletonRows } from '../feedback/table-skeleton';
import { type BulkAction, BulkActionBar } from './bulk-action-bar';
import { ViewOptions } from './view-options';

/** Clicks on these never open the row. */
const INTERACTIVE =
  'button, a, input, select, textarea, [role="menuitem"], [role="checkbox"], [data-no-row-click]';

export type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading: boolean;
  /** Filters, search and anything else shown above the table. */
  toolbar?: React.ReactNode;
  /** Opens the row, e.g. a detail sheet. Also bound to Enter. */
  onRowClick?: (row: T) => void;
  /** Highlights the row whose detail view is open. */
  activeRowId?: string;
  bulkActions?: BulkAction[];
  /** Sort in the browser. Leave off for server-sorted lists. */
  enableSorting?: boolean;
  initialSorting?: SortingState;
  /** Persists hidden columns per table; also shows the Columns menu. */
  storageKey?: string;
  empty: React.ReactNode;
  footer?: React.ReactNode;
  caption: string;
};

function readVisibility(key?: string): VisibilityState {
  if (!key || typeof window === 'undefined') return {};
  try {
    return JSON.parse(
      window.localStorage.getItem(`table:${key}:columns`) ?? '{}'
    ) as VisibilityState;
  } catch {
    return {};
  }
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  toolbar,
  onRowClick,
  activeRowId,
  bulkActions,
  enableSorting,
  initialSorting = [],
  storageKey,
  empty,
  footer,
  caption,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    setColumnVisibility(readVisibility(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(`table:${storageKey}:columns`, JSON.stringify(columnVisibility));
    } catch {
      // Unavailable storage just means the choice isn't remembered.
    }
  }, [storageKey, columnVisibility]);

  // Drop selections for rows that are no longer in the list (deleted, filtered out).
  useEffect(() => {
    const present = new Set(data.map(getRowId));
    setRowSelection((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => present.has(id)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [data, getRowId]);

  const selectable = Boolean(bulkActions?.length);

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selectable) return columns;
    const select: ColumnDef<T, unknown> = {
      id: 'select',
      enableSorting: false,
      enableHiding: false,
      size: 36,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows"
          checked={
            table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
    };
    return [select, ...columns];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
    enableSorting: Boolean(enableSorting),
    enableRowSelection: selectable,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const rows = table.getRowModel().rows;
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  const onRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    row: (typeof rows)[number]
  ) => {
    if (event.target !== event.currentTarget) return;
    const tr = event.currentTarget;
    if (event.key === 'Enter' && onRowClick) {
      event.preventDefault();
      onRowClick(row.original);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      (tr.nextElementSibling as HTMLElement | null)?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      (tr.previousElementSibling as HTMLElement | null)?.focus();
    } else if (event.key === 'x' && selectable) {
      event.preventDefault();
      row.toggleSelected();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {(toolbar || storageKey) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          {storageKey && <ViewOptions table={table} />}
        </div>
      )}

      <div className="overflow-hidden surface">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader className="bg-muted/50 [&_th]:text-[11px] [&_th]:tracking-wide [&_th]:uppercase">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      style={header.column.id === 'select' ? { width: 36 } : undefined}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className={cn(
                        'h-10 text-xs font-medium text-muted-foreground',
                        (header.column.columnDef.meta as ColumnMeta | undefined)?.className
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          {isLoading ? (
            <TableSkeletonRows columns={visibleColumnCount} />
          ) : rows.length === 0 ? (
            <TableBody>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="p-0">
                  {empty}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  aria-current={activeRowId === row.id ? 'true' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(event) => onRowKeyDown(event, row)}
                  onClick={(event) => {
                    if (!onRowClick) return;
                    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                    onRowClick(row.original);
                  }}
                  className={cn(
                    onRowClick &&
                      'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none',
                    activeRowId === row.id && 'bg-primary/5'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'py-2.5',
                        (cell.column.columnDef.meta as ColumnMeta | undefined)?.className
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>

      {footer}

      {bulkActions && selectedIds.length > 0 && (
        <BulkActionBar
          count={selectedIds.length}
          actions={bulkActions}
          selectedIds={selectedIds}
          onClear={() => setRowSelection({})}
        />
      )}
    </div>
  );
}

/** Per-column extras, set through `meta` on a column definition. */
export type ColumnMeta = {
  className?: string;
  /** Name in the Columns menu when the header isn't plain text. */
  label?: string;
};
