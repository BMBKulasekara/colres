'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { IconBuilding, IconSearchOff } from '@tabler/icons-react';
import type { ColumnDef } from '@tanstack/react-table';
import { usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useCallback } from 'react';
import { DataTable } from '../../components/data-table/data-table';
import { LoadMoreFooter } from '../../components/data-table/pagination';
import { SearchInput } from '../../components/data-table/toolbar';
import { EmptyState } from '../../components/feedback/empty-state';
import { PageBody, PageHeader } from '../../components/page-header';
import { RelativeTime } from '../../components/relative-time';
import { UserCell } from '../../components/user-avatar';
import { useUrlState } from '../../hooks/use-url-state';
import { PAGE_SIZE } from '../../lib/constants';
import { formatNumber } from '../../lib/format';
import { OrgSheet } from './org-sheet';

type OrgRow = FunctionReturnType<typeof api.admin.organizations.list>['page'][number];

const columns: ColumnDef<OrgRow>[] = [
  {
    id: 'name',
    header: 'Organization',
    cell: ({ row }) => (
      <UserCell
        name={row.original.name}
        secondary={`/${row.original.slug}`}
        imageUrl={row.original.imageUrl}
        square
      />
    ),
  },
  {
    id: 'members',
    header: 'Members',
    meta: { className: 'text-right' },
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{formatNumber(row.original.memberCount)}</span>
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
    id: 'updated',
    header: 'Last synced',
    meta: { className: 'hidden md:table-cell' },
    cell: ({ row }) => (
      <RelativeTime timestamp={row.original.updatedAt} className="text-sm text-muted-foreground" />
    ),
  },
];

export function OrganizationsView() {
  const url = useUrlState();
  const q = url.get('q') ?? '';
  const openId = url.get('open') as Id<'organizations'> | undefined;

  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.organizations.list,
    { q: q || undefined },
    { initialNumItems: PAGE_SIZE }
  );
  const counts = useQuery(api.admin.stats.navCounts, {});
  const open = useCallback((row: OrgRow) => url.set({ open: row._id }, { push: true }), [url]);

  return (
    <PageBody>
      <PageHeader
        title="Organizations"
        description="Team spaces, synced from the sign-in provider."
      />

      <DataTable
        caption="Organizations"
        columns={columns}
        data={results}
        getRowId={(row) => row._id}
        isLoading={status === 'LoadingFirstPage'}
        onRowClick={open}
        activeRowId={openId}
        toolbar={
          <SearchInput
            value={q}
            onChange={(value) => url.set({ q: value })}
            placeholder="Search organizations…"
          />
        }
        empty={
          q ? (
            <EmptyState icon={IconSearchOff} title="No organizations match" />
          ) : (
            <EmptyState
              icon={IconBuilding}
              title="No organizations yet"
              description="They appear once a member opens the app inside one."
            />
          )
        }
        footer={
          <LoadMoreFooter
            shown={results.length}
            total={q ? undefined : counts?.organizations}
            status={status}
            loadMore={loadMore}
          />
        }
      />

      <OrgSheet id={openId} onClose={() => url.set({ open: null })} />
    </PageBody>
  );
}
