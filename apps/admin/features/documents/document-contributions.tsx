'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { IconUsersGroup } from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { EmptyState } from '../../components/feedback/empty-state';
import { RelativeTime } from '../../components/relative-time';
import { Sparkline } from '../../components/sparkline';
import { UserAvatar } from '../../components/user-avatar';

export function DocumentContributions({ documentId }: { documentId: Id<'documents'> }) {
  const data = useQuery(api.admin.contributions.forDocument, { documentId });

  if (data === undefined) return <Skeleton className="h-40 w-full" />;
  if (data.members.length === 0) {
    return (
      <EmptyState
        icon={IconUsersGroup}
        title="No contributions yet"
        description="Edits, references, comments and chat messages are recorded here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Team score {data.teamScore.toLocaleString()} · last 30 days
        </p>
        <Sparkline className="h-12 w-full" values={data.days.map((d) => d.score)} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {[
                'Member',
                'Share',
                'Words',
                'Del.',
                'Min.',
                'Days',
                'Refs',
                'Cmts',
                'Msgs',
                'Last active',
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => (
              <tr key={m.userId} className="border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/users?open=${m.userId}`}
                    className="inline-flex items-center gap-2 whitespace-nowrap hover:underline"
                  >
                    <UserAvatar name={m.name} imageUrl={m.imageUrl} className="size-5" />
                    {m.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-medium tabular-nums">{Math.round(m.share * 100)}%</td>
                {(
                  [
                    'wordsAdded',
                    'charsDeleted',
                    'activeMinutes',
                    'activeDays',
                    'references',
                    'comments',
                    'messages',
                  ] as const
                ).map((key) => (
                  <td key={key} className="px-3 py-2 tabular-nums">
                    {m[key].toLocaleString()}
                  </td>
                ))}
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  <RelativeTime timestamp={m.lastActiveAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        "Del." is characters deleted. Share is each member's weighted score over the team total.
      </p>
    </div>
  );
}
