'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import {
  IconDownload,
  IconFileCheck,
  IconFilePencil,
  IconFileText,
  IconSearchOff,
  IconTrash,
} from '@tabler/icons-react';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { useCallback, useMemo } from 'react';
import { DataTable } from '../../components/data-table/data-table';
import { LoadMoreFooter } from '../../components/data-table/pagination';
import { FacetFilter, ResetFiltersButton, SearchInput } from '../../components/data-table/toolbar';
import { EmptyState } from '../../components/feedback/empty-state';
import { PageBody, PageHeader } from '../../components/page-header';
import { useUrlState } from '../../hooks/use-url-state';
import { PAGE_SIZE } from '../../lib/constants';
import { downloadCsv } from '../../lib/csv';
import { documentColumns } from './columns';
import { DocumentSheet } from './document-sheet';
import type { DocumentRow } from './types';
import { useDocumentActions } from './use-document-actions';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
];
const SORT_OPTIONS = [{ value: 'created', label: 'Newest first' }];

export function DocumentsView() {
  const url = useUrlState();
  const q = url.get('q') ?? '';
  const statusParam = url.get('status');
  const orgId = url.get('org');
  const templateId = url.get('template') as Id<'templates'> | undefined;
  const authorId = url.get('author') as Id<'users'> | undefined;
  const sort = url.get('sort') === 'created' ? 'created' : undefined;
  const openId = url.get('open') as Id<'documents'> | undefined;
  const status = statusParam === 'active' ? true : statusParam === 'draft' ? false : undefined;
  const hasFilters = Boolean(q || statusParam || orgId || templateId || authorId || sort);

  const {
    results,
    status: pageStatus,
    loadMore,
  } = usePaginatedQuery(
    api.admin.documents.list,
    { q: q || undefined, status, orgId, templateId, authorId, sort },
    { initialNumItems: PAGE_SIZE }
  );
  const counts = useQuery(api.admin.stats.navCounts, {});
  const orgs = useQuery(api.admin.organizations.options, {});
  const templates = useQuery(api.templates.adminListTemplates, {});
  const author = useQuery(api.admin.users.get, authorId ? { id: authorId } : 'skip');

  const actions = useDocumentActions();
  const open = useCallback((row: DocumentRow) => url.set({ open: row._id }, { push: true }), [url]);

  const columns = useMemo(
    () =>
      documentColumns({
        open,
        setStatus: (row, next) => void actions.setStatus(row, next),
        remove: (row) => void actions.deleteOne(row),
      }),
    [open, actions]
  );

  const exportCsv = () =>
    downloadCsv(`documents-${new Date().toISOString().slice(0, 10)}.csv`, results, [
      { header: 'Title', value: (d) => d.title },
      { header: 'Slug', value: (d) => d.slug },
      { header: 'Status', value: (d) => (d.status ? 'active' : 'draft') },
      { header: 'Author', value: (d) => d.author?.name },
      { header: 'Author email', value: (d) => d.author?.email },
      { header: 'Organization', value: (d) => d.organization?.name },
      { header: 'Template', value: (d) => d.template?.name },
      { header: 'Created', value: (d) => new Date(d.createdAt).toISOString() },
      { header: 'Updated', value: (d) => new Date(d.updatedAt).toISOString() },
    ]);

  return (
    <PageBody>
      <PageHeader
        title="Documents"
        description="Every document across all users and organizations."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={results.length === 0}>
            <IconDownload size={16} aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <DataTable
        caption="Documents"
        columns={columns}
        data={results}
        getRowId={(row) => row._id}
        isLoading={pageStatus === 'LoadingFirstPage'}
        onRowClick={open}
        activeRowId={openId}
        storageKey="documents"
        toolbar={
          <>
            <SearchInput
              value={q}
              onChange={(value) => url.set({ q: value })}
              placeholder="Search titles…"
            />
            <FacetFilter
              label="Status"
              value={statusParam}
              options={STATUS_OPTIONS}
              onChange={(value) => url.set({ status: value })}
            />
            <FacetFilter
              label="Organization"
              value={orgId}
              options={(orgs ?? []).map((o) => ({ value: o.clerkOrgId, label: o.name }))}
              onChange={(value) => url.set({ org: value })}
            />
            <FacetFilter
              label="Template"
              value={templateId}
              options={(templates ?? []).map((t) => ({
                value: t._id,
                label: t.name,
                count: t.usageCount,
              }))}
              onChange={(value) => url.set({ template: value })}
            />
            {authorId && (
              <FacetFilter
                label="Author"
                value={authorId}
                options={[{ value: authorId, label: author?.name ?? '…' }]}
                onChange={(value) => url.set({ author: value })}
              />
            )}
            {!q && (
              <FacetFilter
                label="Sort"
                value={sort}
                options={SORT_OPTIONS}
                onChange={(value) => url.set({ sort: value })}
              />
            )}
            {hasFilters && (
              <ResetFiltersButton
                onReset={() =>
                  url.set({
                    q: null,
                    status: null,
                    org: null,
                    template: null,
                    author: null,
                    sort: null,
                  })
                }
              />
            )}
          </>
        }
        bulkActions={[
          {
            label: 'Set active',
            icon: IconFileCheck,
            run: (ids) => actions.setStatusMany(ids, true),
          },
          {
            label: 'Move to draft',
            icon: IconFilePencil,
            run: (ids) => actions.setStatusMany(ids, false),
          },
          { label: 'Delete', icon: IconTrash, destructive: true, run: actions.deleteMany },
        ]}
        empty={
          hasFilters ? (
            <EmptyState
              icon={IconSearchOff}
              title="No documents match"
              description="Try a different search or clear the filters."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    url.set({ q: null, status: null, org: null, template: null, author: null })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={IconFileText}
              title="No documents yet"
              description="Documents appear here as soon as users create them."
            />
          )
        }
        footer={
          <LoadMoreFooter
            shown={results.length}
            total={hasFilters ? undefined : counts?.documents}
            status={pageStatus}
            loadMore={loadMore}
          />
        }
      />

      <DocumentSheet id={openId} onClose={() => url.set({ open: null })} />
    </PageBody>
  );
}
