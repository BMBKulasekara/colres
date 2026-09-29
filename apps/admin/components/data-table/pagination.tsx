'use client';

import { Button } from '@repo/ui/components/ui/button';
import { IconLoader2 } from '@tabler/icons-react';
import type { PaginationStatus } from 'convex/react';
import { PAGE_SIZE } from '../../lib/constants';
import { formatNumber } from '../../lib/format';

/**
 * Footer for Convex cursor pagination: how much is showing, and "Load more"
 * while the server says there is more.
 */
export function LoadMoreFooter({
  shown,
  total,
  status,
  loadMore,
}: {
  shown: number;
  /** Known only when the list is unfiltered. */
  total?: number;
  status: PaginationStatus;
  loadMore: (numItems: number) => void;
}) {
  if (status === 'LoadingFirstPage') return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span aria-live="polite">
        Showing {formatNumber(shown)}
        {total !== undefined && total >= shown ? ` of ${formatNumber(total)}` : ''}
      </span>
      {(status === 'CanLoadMore' || status === 'LoadingMore') && (
        <Button
          variant="outline"
          size="sm"
          disabled={status === 'LoadingMore'}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          {status === 'LoadingMore' && (
            <IconLoader2 size={14} className="animate-spin" aria-hidden="true" />
          )}
          Load more
        </Button>
      )}
    </div>
  );
}
