'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

/** Who has contributed what to this document, as a share of the team's work. */
export function ContributionsPanel({ documentId }: { documentId: Id<'documents'> }) {
  const data = useQuery(api.contributions.forDocument, { documentId });

  if (data === undefined) {
    return <Loader2 className="mx-auto mt-8 size-4 animate-spin text-muted-foreground" />;
  }
  if (!data || data.members.length === 0) {
    return (
      <p className="mt-6 text-center text-xs text-muted-foreground">
        No contributions recorded yet. Edits, references, comments and chat all count.
      </p>
    );
  }

  const peak = Math.max(1, ...data.days.map((d) => d.score));

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div>
        <p className="mb-1.5 font-semibold text-muted-foreground">Team activity · last 30 days</p>
        <div className="flex h-12 items-end gap-px">
          {data.days.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.score} pts`}
              className="flex-1 rounded-sm bg-primary/70"
              style={{
                height: `${Math.max(4, (d.score / peak) * 100)}%`,
                opacity: d.score ? 1 : 0.2,
              }}
            />
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {data.members.map((m) => (
          <li
            key={m.userId}
            className={`rounded-lg border p-3 ${m.userId === data.viewerId ? 'border-primary/50 bg-primary/5' : 'border-border/60'}`}
          >
            <div className="mb-2 flex items-center gap-2">
              {m.imageUrl ? (
                <Image
                  src={m.imageUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 rounded-full"
                />
              ) : (
                <div className="size-6 rounded-full bg-muted" />
              )}
              <span className="flex-1 truncate font-semibold">
                {m.name}
                {m.userId === data.viewerId && (
                  <span className="text-muted-foreground"> (you)</span>
                )}
              </span>
              <span className="font-bold tabular-nums">{Math.round(m.share * 100)}%</span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${m.share * 100}%` }} />
            </div>
            <dl className="grid grid-cols-3 gap-y-1 text-muted-foreground">
              <Stat label="Words" value={m.wordsAdded} />
              <Stat label="Minutes" value={m.activeMinutes} />
              <Stat label="Days" value={m.activeDays} />
              <Stat label="References" value={m.references} />
              <Stat label="Comments" value={m.comments} />
              <Stat label="Messages" value={m.messages} />
            </dl>
          </li>
        ))}
      </ul>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Score = words × {data.weights.wordsAdded} + minutes × {data.weights.activeMinutes} +
        references × {data.weights.references} + comments × {data.weights.comments} + messages ×{' '}
        {data.weights.messages}.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px]">{label}</dt>
      <dd className="font-semibold text-foreground tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}
