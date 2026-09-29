'use client';

import { api } from '@repo/convex/_generated/api';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { IconFileText } from '@tabler/icons-react';
import { usePaginatedQuery } from 'convex/react';
import Link from 'next/link';
import { EmptyState } from '../../components/feedback/empty-state';
import { StatusBadge } from '../../components/feedback/status-badge';
import { RelativeTime } from '../../components/relative-time';
import { placeholderKeys } from '../../lib/placeholders';

export function NewestDocuments() {
  const { results, status } = usePaginatedQuery(
    api.admin.documents.list,
    { sort: 'created' },
    { initialNumItems: 5 }
  );
  const documents = results.slice(0, 5);

  return (
    <section aria-labelledby="newest-heading" className="flex flex-col gap-3 surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="newest-heading" className="font-semibold">
          Newest documents
        </h2>
        <Link
          href="/documents?sort=created"
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>
      {status === 'LoadingFirstPage' ? (
        <div className="flex flex-col gap-3">
          {placeholderKeys(5, 'i').map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState icon={IconFileText} title="No documents yet" className="py-6" />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {documents.map((doc) => (
            <li key={doc._id}>
              <Link
                href={`/documents?open=${doc._id}`}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{doc.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {doc.author?.name ?? 'Unknown author'}
                    {doc.organization ? ` · ${doc.organization.name}` : ''}
                  </span>
                </span>
                <StatusBadge status={doc.status ? 'active' : 'draft'} />
                <RelativeTime
                  timestamp={doc.createdAt}
                  className="w-20 shrink-0 text-right text-xs text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
