'use client';

import { api } from '@repo/convex/_generated/api';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { IconLayoutGrid } from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { EmptyState } from '../../components/feedback/empty-state';
import { formatNumber } from '../../lib/format';
import { placeholderKeys } from '../../lib/placeholders';

export function TopTemplates() {
  const templates = useQuery(api.admin.stats.topTemplates, { limit: 5 });
  const max = Math.max(1, ...(templates ?? []).map((t) => t.usageCount));

  return (
    <section aria-labelledby="top-templates-heading" className="flex flex-col gap-3 surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="top-templates-heading" className="font-semibold">
          Top templates
        </h2>
        <span className="text-xs text-muted-foreground">documents created</span>
      </div>
      {!templates ? (
        <div className="flex flex-col gap-3">
          {placeholderKeys(4, 'i').map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState icon={IconLayoutGrid} title="No template usage yet" className="py-6" />
      ) : (
        <ol className="flex flex-col gap-3">
          {templates.map((template) => (
            <li key={template._id}>
              <Link
                href={`/templates/${template._id}`}
                className="group flex flex-col gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate group-hover:underline">{template.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatNumber(template.usageCount)}
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(template.usageCount / max) * 100}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
