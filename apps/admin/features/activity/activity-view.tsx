'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import { FacetFilter, ResetFiltersButton } from '../../components/data-table/toolbar';
import { ErrorBoundary } from '../../components/feedback/error-state';
import { PageBody, PageHeader } from '../../components/page-header';
import { useUrlState } from '../../hooks/use-url-state';
import { ActivityFeed, type ActivityFilters } from './activity-feed';

const ENTITY_OPTIONS = [
  { value: 'document', label: 'Documents' },
  { value: 'template', label: 'Templates' },
  { value: 'user', label: 'Users' },
  { value: 'catalog', label: 'Catalog' },
];

const RANGE_OPTIONS = [
  { value: '1d', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: '90d', label: 'Last 90 days', ms: 90 * 24 * 60 * 60 * 1000 },
];

/** Rounded to the minute so the query args (and subscription) stay stable. */
function sinceFor(range: string | undefined): number | undefined {
  const option = RANGE_OPTIONS.find((r) => r.value === range);
  if (!option) return undefined;
  return Math.floor((Date.now() - option.ms) / 60_000) * 60_000;
}

export function ActivityView() {
  const url = useUrlState();
  const admins = useQuery(api.admin.users.admins, {});

  const entityType = url.get('type') as ActivityFilters['entityType'];
  const actorId = url.get('actor') as Id<'users'> | undefined;
  const range = url.get('range');
  const hasFilters = Boolean(entityType || actorId || range);

  // Fixed when the range is picked, so the subscription doesn't churn every render.
  const since = useMemo(() => sinceFor(range), [range]);
  const filters: ActivityFilters = { entityType, actorId, since };

  return (
    <PageBody>
      <PageHeader
        title="Activity"
        description="Every change made through the admin console, newest first."
      />

      <div className="flex flex-wrap items-center gap-2">
        <FacetFilter
          label="Actor"
          value={actorId}
          options={(admins ?? []).map((a) => ({ value: a._id, label: a.name || a.email }))}
          onChange={(value) => url.set({ actor: value })}
        />
        <FacetFilter
          label="Type"
          value={entityType}
          options={ENTITY_OPTIONS}
          onChange={(value) => url.set({ type: value })}
        />
        <FacetFilter
          label="Period"
          value={range}
          options={RANGE_OPTIONS}
          onChange={(value) => url.set({ range: value })}
        />
        {hasFilters && (
          <ResetFiltersButton onReset={() => url.set({ actor: null, type: null, range: null })} />
        )}
      </div>

      <section className="surface p-5 md:p-6">
        <ErrorBoundary title="Couldn't load activity">
          <ActivityFeed
            key={JSON.stringify(filters)}
            filters={filters}
            emptyHint={hasFilters ? 'Nothing matches these filters.' : undefined}
          />
        </ErrorBoundary>
      </section>
    </PageBody>
  );
}
