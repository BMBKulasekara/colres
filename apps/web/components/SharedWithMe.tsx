'use client';

import { api } from '@repo/convex/_generated/api';
import { ROLE_LABELS } from '@repo/convex/sharing/roles';
import { useQuery } from 'convex/react';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '../lib/relativeTime';

/**
 * Documents other people have shared with you from outside your workspaces.
 * Renders nothing when there are none, so the page is unchanged for anyone
 * who has not been invited to anything.
 */
export function SharedWithMe() {
  const shared = useQuery(api.sharing.sharedWithMe, {});
  if (!shared || shared.length === 0) return null;

  return (
    <section aria-labelledby="shared-heading" className="flex flex-col gap-3">
      <h2
        id="shared-heading"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        <Users aria-hidden className="size-3.5" />
        Shared with me
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shared.map(({ document, role }) => (
          <li key={document._id}>
            <Link
              href={`/docs/${document.slug}`}
              className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {ROLE_LABELS[role]}
              </span>
              <span className="line-clamp-2 font-semibold leading-snug text-foreground">
                {document.title || 'Untitled Document'}
              </span>
              <span className="mt-auto text-xs text-muted-foreground">
                Edited {formatRelativeTime(document.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
