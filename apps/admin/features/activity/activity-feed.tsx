'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { IconHistory } from '@tabler/icons-react';
import { usePaginatedQuery } from 'convex/react';
import { LoadMoreFooter } from '../../components/data-table/pagination';
import { EmptyState } from '../../components/feedback/empty-state';
import { RelativeTime } from '../../components/relative-time';
import { UserAvatar } from '../../components/user-avatar';
import { dayLabel, formatTime } from '../../lib/format';
import { placeholderKeys } from '../../lib/placeholders';
import { describeAction } from './describe-action';

export type ActivityFilters = {
  entityType?: 'document' | 'template' | 'user' | 'organization' | 'catalog';
  entityId?: string;
  actorId?: Id<'users'>;
  since?: number;
};

/**
 * The audit trail, newest first. `compact` is the dashboard/sheet variant: a
 * short list with relative times; the full variant groups entries by day.
 */
export function ActivityFeed({
  filters = {},
  pageSize = 30,
  compact = false,
  emptyHint,
}: {
  filters?: ActivityFilters;
  pageSize?: number;
  compact?: boolean;
  emptyHint?: string;
}) {
  const { results, status, loadMore } = usePaginatedQuery(api.admin.activity.list, filters, {
    initialNumItems: pageSize,
  });

  if (status === 'LoadingFirstPage') {
    return (
      <ul className="flex flex-col gap-3" aria-busy="true">
        {placeholderKeys(compact ? 4 : 8, 'i').map((i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </li>
        ))}
      </ul>
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={IconHistory}
        title="No activity yet"
        description={
          emptyHint ?? 'Admin actions such as publishing, role changes and deletions appear here.'
        }
        className="py-8"
      />
    );
  }

  let lastDay = '';

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {results.map((entry) => {
          const day = dayLabel(entry.createdAt);
          const showDay = !compact && day !== lastDay;
          lastDay = day;
          return (
            <li key={entry._id}>
              {showDay && (
                <h3 className="pt-4 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase first:pt-0">
                  {day}
                </h3>
              )}
              <div className="flex items-start gap-3 py-1.5 text-sm">
                <UserAvatar
                  name={entry.actor?.name}
                  imageUrl={entry.actor?.imageUrl}
                  className="mt-0.5 size-6"
                />
                <p className="min-w-0 flex-1 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {entry.actor?.name ?? 'Deleted admin'}
                  </span>{' '}
                  {describeAction(entry)}
                </p>
                {compact ? (
                  <RelativeTime
                    timestamp={entry.createdAt}
                    className="shrink-0 text-xs text-muted-foreground"
                  />
                ) : (
                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatTime(entry.createdAt)}
                  </time>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {!compact && <LoadMoreFooter shown={results.length} status={status} loadMore={loadMore} />}
    </div>
  );
}
