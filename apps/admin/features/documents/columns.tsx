'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  IconDots,
  IconExternalLink,
  IconEye,
  IconFileCheck,
  IconFilePencil,
  IconTrash,
} from '@tabler/icons-react';
import type { ColumnDef } from '@tanstack/react-table';
import { StatusBadge } from '../../components/feedback/status-badge';
import { RelativeTime } from '../../components/relative-time';
import { UserCell } from '../../components/user-avatar';
import { WEB_APP_URL } from '../../lib/constants';
import type { DocumentRow } from './types';

type Handlers = {
  open: (row: DocumentRow) => void;
  setStatus: (row: DocumentRow, status: boolean) => void;
  remove: (row: DocumentRow) => void;
};

export function documentColumns({ open, setStatus, remove }: Handlers): ColumnDef<DocumentRow>[] {
  return [
    {
      id: 'title',
      header: 'Title',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex min-w-0 max-w-xs flex-col">
          <span className="truncate font-medium" title={row.original.title}>
            {row.original.title}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            /{row.original.slug}
          </span>
        </div>
      ),
    },
    {
      id: 'author',
      header: 'Author',
      cell: ({ row }) =>
        row.original.author ? (
          <UserCell
            name={row.original.author.name}
            imageUrl={row.original.author.imageUrl}
            secondary={row.original.author.email}
          />
        ) : (
          <span className="text-sm text-muted-foreground">Unknown</span>
        ),
    },
    {
      id: 'organization',
      header: 'Organization',
      meta: { className: 'hidden lg:table-cell' },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.organization?.name ?? 'Personal'}
        </span>
      ),
    },
    {
      id: 'template',
      header: 'Template',
      meta: { className: 'hidden xl:table-cell' },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.template?.name ?? '—'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status ? 'active' : 'draft'} />,
    },
    {
      id: 'updated',
      header: 'Updated',
      meta: { className: 'hidden md:table-cell' },
      cell: ({ row }) => (
        <RelativeTime
          timestamp={row.original.updatedAt}
          className="text-sm text-muted-foreground"
        />
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { className: 'w-12 text-right' },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Actions for ${row.original.title}`}
            >
              <IconDots size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => open(row.original)}>
              <IconEye aria-hidden="true" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`${WEB_APP_URL}/docs/${row.original.slug}`} target="_blank" rel="noreferrer">
                <IconExternalLink aria-hidden="true" />
                Open in app
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatus(row.original, !row.original.status)}>
              {row.original.status ? (
                <IconFilePencil aria-hidden="true" />
              ) : (
                <IconFileCheck aria-hidden="true" />
              )}
              {row.original.status ? 'Move to draft' : 'Set active'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => remove(row.original)}>
              <IconTrash aria-hidden="true" />
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
