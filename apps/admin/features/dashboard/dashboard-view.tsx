'use client';

import { Button } from '@repo/ui/components/ui/button';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { FilterTabs } from '../../components/data-table/toolbar';
import { ErrorBoundary } from '../../components/feedback/error-state';
import { PageBody, PageHeader } from '../../components/page-header';
import { useCurrentAdmin } from '../../hooks/use-current-admin';
import { useUrlState } from '../../hooks/use-url-state';
import { ActivityFeed } from '../activity/activity-feed';
import { GrowthChart } from './growth-chart';
import { KpiGrid } from './kpi-grid';
import { NewestDocuments } from './newest-documents';
import { parseRange, RANGES } from './range';
import { TopTemplates } from './top-templates';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function DashboardView() {
  const admin = useCurrentAdmin();
  const url = useUrlState();
  const range = parseRange(url.get('range'));
  const firstName = admin.name.split(' ')[0] || admin.name;

  return (
    <PageBody>
      <PageHeader
        hero
        title={`${greeting()}, ${firstName}`}
        description="Here's what's happening across Colres."
        actions={
          <Button asChild>
            <Link href="/templates?create=1">
              <IconPlus size={16} aria-hidden="true" />
              New template
            </Link>
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-2">
        <FilterTabs
          label="Period"
          value={range}
          options={RANGES}
          onChange={(value) => url.set({ range: value === '7d' ? null : value })}
        />
      </div>

      <ErrorBoundary title="Couldn't load the numbers">
        <KpiGrid range={range} />
      </ErrorBoundary>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ErrorBoundary title="Couldn't load the chart">
            <GrowthChart range={range} />
          </ErrorBoundary>
        </div>
        <ErrorBoundary title="Couldn't load templates">
          <TopTemplates />
        </ErrorBoundary>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="recent-activity-heading"
          className="flex flex-col gap-3 surface p-5"
        >
          <div className="flex items-baseline justify-between">
            <h2 id="recent-activity-heading" className="font-semibold">
              Recent activity
            </h2>
            <Link href="/activity" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ErrorBoundary title="Couldn't load activity">
            <ActivityFeed compact pageSize={8} />
          </ErrorBoundary>
        </section>
        <ErrorBoundary title="Couldn't load documents">
          <NewestDocuments />
        </ErrorBoundary>
      </div>
    </PageBody>
  );
}
