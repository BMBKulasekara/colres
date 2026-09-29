'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { IconSearchOff, IconUsers } from '@tabler/icons-react';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { useCallback, useMemo } from 'react';
import { DataTable } from '../../components/data-table/data-table';
import { LoadMoreFooter } from '../../components/data-table/pagination';
import { FilterTabs, SearchInput } from '../../components/data-table/toolbar';
import { EmptyState } from '../../components/feedback/empty-state';
import { PageBody, PageHeader } from '../../components/page-header';
import { useCurrentAdmin } from '../../hooks/use-current-admin';
import { useUrlState } from '../../hooks/use-url-state';
import { PAGE_SIZE } from '../../lib/constants';
import { userColumns } from './columns';
import type { Role, UserRow } from './types';
import { useChangeRole } from './use-change-role';
import { UserSheet } from './user-sheet';

type RoleTab = 'all' | Role;

export function UsersView() {
  const url = useUrlState();
  const admin = useCurrentAdmin();
  const q = url.get('q') ?? '';
  const roleParam = url.get('role');
  const role: Role | undefined =
    roleParam === 'admin' || roleParam === 'user' ? roleParam : undefined;
  const openId = url.get('open') as Id<'users'> | undefined;

  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.users.list,
    { q: q || undefined, role },
    { initialNumItems: PAGE_SIZE }
  );
  const counts = useQuery(api.admin.users.roleCounts, {});
  const changeRole = useChangeRole();

  const open = useCallback((row: UserRow) => url.set({ open: row._id }, { push: true }), [url]);
  const columns = useMemo(
    () =>
      userColumns({
        currentAdminId: admin._id,
        open,
        changeRole: (row, next) => void changeRole(row, next),
      }),
    [admin._id, open, changeRole]
  );

  const tabs: { value: RoleTab; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: counts?.all },
    { value: 'admin', label: 'Admins', count: counts?.admin },
    { value: 'user', label: 'Users', count: counts?.user },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Users"
        description="Profiles sync from sign-in accounts. Here you manage roles and remove accounts."
      />

      <FilterTabs
        label="Role"
        value={role ?? 'all'}
        options={tabs}
        onChange={(value) => url.set({ role: value === 'all' ? null : value })}
      />

      <DataTable
        caption="Users"
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
            placeholder="Search by name or email…"
          />
        }
        empty={
          q ? (
            <EmptyState
              icon={IconSearchOff}
              title="No users match"
              description="Names match on whole words; emails match from the start."
            />
          ) : (
            <EmptyState icon={IconUsers} title={role === 'admin' ? 'No admins' : 'No users yet'} />
          )
        }
        footer={
          <LoadMoreFooter
            shown={results.length}
            total={q ? undefined : role ? counts?.[role] : counts?.all}
            status={status}
            loadMore={loadMore}
          />
        }
      />

      <UserSheet id={openId} onClose={() => url.set({ open: null })} />
    </PageBody>
  );
}
