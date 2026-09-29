'use client';

import { api } from '@repo/convex/_generated/api';
import { IconBuilding, IconFileText, IconLayoutGrid, IconUsers } from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { StatCard, StatCardSkeleton } from '../../components/stat-card';
import { pluralize } from '../../lib/format';
import { placeholderKeys } from '../../lib/placeholders';
import type { Range } from './range';

export function KpiGrid({ range }: { range: Range }) {
  const overview = useQuery(api.admin.stats.overview, { range });
  const periodLabel = `in ${range === '7d' ? '7' : range === '30d' ? '30' : '90'} days`;

  if (!overview) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {placeholderKeys(4, 'i').map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const { totals, periods, sparklines } = overview;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Users"
        icon={IconUsers}
        value={totals.users}
        delta={periods.users}
        deltaLabel={periodLabel}
        sparkline={sparklines.users}
        href="/users"
      />
      <StatCard
        label="Documents"
        icon={IconFileText}
        value={totals.documents}
        delta={periods.documents}
        deltaLabel={periodLabel}
        sparkline={sparklines.documents}
        href="/documents"
      />
      <StatCard
        label="Organizations"
        icon={IconBuilding}
        value={totals.organizations}
        delta={periods.organizations}
        deltaLabel={periodLabel}
        sparkline={sparklines.organizations}
        href="/organizations"
      />
      <StatCard
        label="Published templates"
        icon={IconLayoutGrid}
        value={totals.publishedTemplates}
        href="/templates?status=published"
        footnote={
          totals.draftTemplates > 0 ? (
            <Link
              href="/templates?status=draft"
              className="relative z-10 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              {pluralize(totals.draftTemplates, 'draft')} waiting
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">No drafts</span>
          )
        }
      />
    </div>
  );
}
