'use client';

import { cn } from '@repo/ui/lib/utils';
import { IconArrowDown, IconArrowUp, IconSelector } from '@tabler/icons-react';
import type { Column } from '@tanstack/react-table';

/** A sortable header: click cycles ascending → descending. */
export function ColumnHeader<T>({
  column,
  title,
  className,
}: {
  column: Column<T, unknown>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) return <span className={className}>{title}</span>;
  const sorted = column.getIsSorted();
  const SortIcon =
    sorted === 'asc' ? IconArrowUp : sorted === 'desc' ? IconArrowDown : IconSelector;

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={cn(
        '-ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        className
      )}
    >
      {title}
      <SortIcon
        size={13}
        aria-hidden="true"
        className={sorted ? 'text-foreground' : 'opacity-50'}
      />
    </button>
  );
}
