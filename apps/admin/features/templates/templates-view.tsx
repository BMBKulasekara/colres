'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@repo/ui/components/ui/toggle-group';
import {
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconRefresh,
  IconSearchOff,
} from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/data-table/data-table';
import {
  FacetFilter,
  FilterTabs,
  ResetFiltersButton,
  SearchInput,
} from '../../components/data-table/toolbar';
import { EmptyState } from '../../components/feedback/empty-state';
import { PageBody, PageHeader } from '../../components/page-header';
import { useUrlState } from '../../hooks/use-url-state';
import { TEMPLATE_CATEGORIES } from '../../lib/constants';
import { templateColumns } from './columns';
import { CreateTemplateDialog } from './create-template-dialog';
import { SyncCatalogDialog } from './sync-catalog-dialog';
import { TemplateGrid } from './template-grid';
import { useTemplateActions } from './use-template-actions';

type StatusTab = 'all' | 'published' | 'draft' | 'featured';
type ViewMode = 'table' | 'grid';
const VIEW_KEY = 'templates:view';

export function TemplatesView() {
  const url = useUrlState();
  const templates = useQuery(api.templates.adminListTemplates, {});
  const actions = useTemplateActions();
  const [view, setView] = useState<ViewMode>('table');
  const [syncOpen, setSyncOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === 'grid') setView('grid');
    } catch {
      // Keep the default view when storage is unavailable.
    }
  }, []);

  const q = (url.get('q') ?? '').toLowerCase();
  const statusParam = url.get('status');
  const tab: StatusTab =
    statusParam === 'published' || statusParam === 'draft' || statusParam === 'featured'
      ? statusParam
      : 'all';
  const category = url.get('category');
  const createOpen = url.get('create') === '1';

  const all = templates ?? [];
  const tabs: { value: StatusTab; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: templates ? all.length : undefined },
    {
      value: 'published',
      label: 'Published',
      count: templates ? all.filter((t) => t.status === 'published').length : undefined,
    },
    {
      value: 'draft',
      label: 'Drafts',
      count: templates ? all.filter((t) => t.status === 'draft').length : undefined,
    },
    {
      value: 'featured',
      label: 'Featured',
      count: templates ? all.filter((t) => t.featured).length : undefined,
    },
  ];

  const filtered = all.filter((t) => {
    if (tab === 'published' && t.status !== 'published') return false;
    if (tab === 'draft' && t.status !== 'draft') return false;
    if (tab === 'featured' && !t.featured) return false;
    if (category && t.category !== category) return false;
    if (!q) return true;
    return [t.name, t.slug, t.publisher ?? '', t.documentClass, ...t.tags]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const columns = useMemo(() => templateColumns(actions), [actions]);
  const hasFilters = Boolean(q || category);

  const empty = hasFilters ? (
    <EmptyState
      icon={IconSearchOff}
      title="No templates match"
      action={
        <Button variant="outline" size="sm" onClick={() => url.set({ q: null, category: null })}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={IconLayoutGrid}
      title={tab === 'all' ? 'No templates yet' : `No ${tab} templates`}
      description={tab === 'all' ? 'Create one, or sync the built-in catalog.' : undefined}
      action={
        tab === 'all' ? (
          <Button size="sm" variant="outline" onClick={() => setSyncOpen(true)}>
            <IconRefresh size={15} aria-hidden="true" />
            Sync built-ins
          </Button>
        ) : undefined
      }
    />
  );

  const toolbar = (
    <>
      <SearchInput
        value={url.get('q') ?? ''}
        onChange={(value) => url.set({ q: value })}
        placeholder="Search name, class or tag…"
      />
      <FacetFilter
        label="Category"
        value={category}
        options={TEMPLATE_CATEGORIES.map((c) => ({
          value: c.value,
          label: c.label,
          count: all.filter((t) => t.category === c.value).length,
        }))}
        onChange={(value) => url.set({ category: value })}
      />
      {hasFilters && <ResetFiltersButton onReset={() => url.set({ q: null, category: null })} />}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={view}
        onValueChange={(value) => {
          if (!value) return;
          setView(value as ViewMode);
          try {
            window.localStorage.setItem(VIEW_KEY, value);
          } catch {
            // Not remembered; still switches for this visit.
          }
        }}
        className="ml-auto"
        aria-label="Layout"
      >
        <ToggleGroupItem value="table" aria-label="Table view">
          <IconList size={15} />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <IconLayoutGrid size={15} />
        </ToggleGroupItem>
      </ToggleGroup>
    </>
  );

  return (
    <PageBody>
      <PageHeader
        title="Templates"
        description="The gallery users choose from when they start a document."
        actions={
          <>
            <Button variant="outline" onClick={() => setSyncOpen(true)}>
              <IconRefresh size={16} aria-hidden="true" />
              Sync built-ins
            </Button>
            <Button onClick={() => url.set({ create: '1' })}>
              <IconPlus size={16} aria-hidden="true" />
              New template
            </Button>
          </>
        }
      />

      <FilterTabs
        label="Status"
        value={tab}
        options={tabs}
        onChange={(value) => url.set({ status: value === 'all' ? null : value })}
      />

      {view === 'table' ? (
        <DataTable
          caption="Templates"
          columns={columns}
          data={filtered}
          getRowId={(row) => row._id}
          isLoading={templates === undefined}
          enableSorting
          toolbar={toolbar}
          empty={empty}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          <TemplateGrid
            templates={filtered}
            isLoading={templates === undefined}
            actions={actions}
            empty={empty}
          />
        </div>
      )}

      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={(open) => url.set({ create: open ? '1' : null })}
        templates={all}
      />
      <SyncCatalogDialog open={syncOpen} onOpenChange={setSyncOpen} />
    </PageBody>
  );
}
