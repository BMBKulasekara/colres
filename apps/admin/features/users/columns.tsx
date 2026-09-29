'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { IconCrown, IconDots, IconEye, IconFileText, IconUser } from '@tabler/icons-react';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '../../components/feedback/status-badge';
import { UserCell } from '../../components/user-avatar';
import { formatDate, formatNumber } from '../../lib/format';
import type { Role, UserRow } from './types';

type Handlers = {
  currentAdminId: string;
  open: (row: UserRow) => void;
  changeRole: (row: UserRow, role: Role) => void;
};

export function userColumns({ currentAdminId, open, changeRole }: Handlers): ColumnDef<UserRow>[] {
  return [
    {
      id: 'user',
      header: 'User',
      enableHiding: false,
      cell: ({ row }) => (
        <UserCell
          name={row.original.name || row.original.email}
          secondary={row.original.email}
          imageUrl={row.original.imageUrl}
          badge={
            row.original._id === currentAdminId ? (
              <span className="rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                you
              </span>
            ) : undefined
          }
        />
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => <StatusBadge status={row.original.role === 'admin' ? 'admin' : 'user'} />,
    },
    {
      id: 'orgs',
      header: 'Orgs',
      meta: { className: 'hidden md:table-cell text-right' },
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">{row.original.orgCount}</span>
      ),
    },
    {
      id: 'documents',
      header: 'Documents',
      meta: { className: 'text-right' },
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{formatNumber(row.original.docCount)}</span>
      ),
    },
    {
      id: 'joined',
      header: 'Joined',
      meta: { className: 'hidden md:table-cell' },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { className: 'w-12 text-right' },
      cell: ({ row }) => {
        const isSelf = row.original._id === currentAdminId;
        const isAdmin = row.original.role === 'admin';
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${row.original.name}`}
              >
                <IconDots size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => open(row.original)}>
                <IconEye aria-hidden="true" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/documents?author=${row.original._id}`}>
                  <IconFileText aria-hidden="true" />
                  View documents
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isSelf}
                onSelect={() => changeRole(row.original, isAdmin ? 'user' : 'admin')}
              >
                {isAdmin ? <IconUser aria-hidden="true" /> : <IconCrown aria-hidden="true" />}
                {isAdmin ? 'Remove admin role' : 'Make admin'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
