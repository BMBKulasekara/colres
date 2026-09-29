'use client';

import type { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Switch } from '@repo/ui/components/ui/switch';
import {
  IconCopy,
  IconDots,
  IconPencil,
  IconStar,
  IconStarOff,
  IconTrash,
} from '@tabler/icons-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { FunctionReturnType } from 'convex/server';
import Image from 'next/image';
import Link from 'next/link';
import { ColumnHeader } from '../../components/data-table/column-header';
import { StatusBadge } from '../../components/feedback/status-badge';
import { categoryLabel } from '../../lib/constants';
import { formatNumber } from '../../lib/format';
import type { useTemplateActions } from './use-template-actions';

export type TemplateRow = FunctionReturnType<typeof api.templates.adminListTemplates>[number];

export function TemplateThumb({
  template,
  className = 'h-10 w-8',
}: {
  template: TemplateRow;
  className?: string;
}) {
  return template.thumbnailUrl ? (
    // `unoptimized` serves the Convex storage URL as-is, so no per-deployment
    // image host needs configuring.
    <span className={`${className} relative block shrink-0 overflow-hidden rounded border`}>
      <Image
        src={template.thumbnailUrl}
        alt=""
        fill
        unoptimized
        sizes="160px"
        className="object-cover"
      />
    </span>
  ) : (
    <span
      className={`${className} shrink-0 rounded border bg-linear-to-br from-primary/15 to-primary/5`}
      aria-hidden="true"
    />
  );
}

export function templateColumns(
  actions: ReturnType<typeof useTemplateActions>
): ColumnDef<TemplateRow>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }) => <ColumnHeader column={column} title="Template" />,
      enableHiding: false,
      cell: ({ row }) => (
        <Link
          href={`/templates/${row.original._id}`}
          className="flex min-w-0 items-center gap-3 hover:underline"
        >
          <TemplateThumb template={row.original} />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 truncate font-medium">
              <span className="truncate">{row.original.name}</span>
              {row.original.featured && <StatusBadge status="featured" />}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              /{row.original.slug}
            </span>
          </span>
        </Link>
      ),
    },
    {
      id: 'category',
      accessorFn: (row) => categoryLabel(row.category),
      header: ({ column }) => <ColumnHeader column={column} title="Category" />,
      meta: { className: 'hidden md:table-cell', label: 'Category' },
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{String(getValue())}</span>
      ),
    },
    {
      id: 'format',
      header: 'Class · engine',
      enableSorting: false,
      meta: { className: 'hidden lg:table-cell', label: 'Class · engine' },
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.documentClass} · {row.original.engine}
        </span>
      ),
    },
    {
      id: 'citation',
      accessorKey: 'citationStyle',
      header: 'Citation',
      enableSorting: false,
      meta: { className: 'hidden xl:table-cell', label: 'Citation' },
      cell: ({ row }) => (
        <span className="text-xs font-medium uppercase">{row.original.citationStyle}</span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Published',
      enableSorting: false,
      meta: { label: 'Published' },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.status === 'published'}
            onCheckedChange={(checked) =>
              void actions.setStatus(row.original, checked ? 'published' : 'draft')
            }
            aria-label={`Published: ${row.original.name}`}
          />
          <StatusBadge status={row.original.status} className="hidden sm:inline-flex" />
        </div>
      ),
    },
    {
      id: 'usage',
      accessorKey: 'usageCount',
      header: ({ column }) => <ColumnHeader column={column} title="Uses" />,
      meta: { className: 'text-right', label: 'Uses' },
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{formatNumber(row.original.usageCount)}</span>
      ),
    },
    {
      id: 'version',
      accessorKey: 'version',
      header: 'Ver.',
      enableSorting: false,
      meta: { className: 'hidden md:table-cell', label: 'Version' },
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">v{row.original.version}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      enableSorting: false,
      meta: { className: 'w-12 text-right' },
      cell: ({ row }) => <TemplateRowMenu template={row.original} actions={actions} />,
    },
  ];
}

export function TemplateRowMenu({
  template,
  actions,
}: {
  template: TemplateRow;
  actions: ReturnType<typeof useTemplateActions>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Actions for ${template.name}`}
        >
          <IconDots size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/templates/${template._id}`}>
            <IconPencil aria-hidden="true" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.duplicate(template)}>
          <IconCopy aria-hidden="true" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.setFeatured(template, !template.featured)}>
          {template.featured ? <IconStarOff aria-hidden="true" /> : <IconStar aria-hidden="true" />}
          {template.featured ? 'Unfeature' : 'Feature'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(template)}>
          <IconTrash aria-hidden="true" />
          Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
