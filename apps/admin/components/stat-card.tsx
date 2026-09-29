import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { cn } from '@repo/ui/lib/utils';
import { type Icon, IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react';
import Link from 'next/link';
import { formatNumber, percentChange } from '../lib/format';
import { Sparkline } from './sparkline';

type Delta = { current: number; previous: number };

export function StatCard({
  label,
  value,
  icon: IconComponent,
  delta,
  deltaLabel,
  footnote,
  sparkline,
  href,
}: {
  label: string;
  value: number;
  icon: Icon;
  delta?: Delta;
  deltaLabel?: string;
  footnote?: React.ReactNode;
  sparkline?: number[];
  href?: string;
}) {
  const heading = (
    <>
      <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
        <IconComponent size={17} aria-hidden="true" />
      </span>
      {label}
    </>
  );

  // The label is the link, stretched over the card with ::after, so the card
  // is one click target while a link inside the footnote still works.
  return (
    <div
      className={cn(
        'surface relative flex flex-col gap-4 p-5',
        href && 'surface-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-ring'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {href ? (
          <Link
            href={href}
            className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {heading}
          </Link>
        ) : (
          <span className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
            {heading}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatNumber(value)}
          </span>
          {delta ? <DeltaText delta={delta} label={deltaLabel} /> : footnote}
        </div>
        {sparkline && <Sparkline values={sparkline} className="h-10 w-28 shrink-0" />}
      </div>
    </div>
  );
}

function DeltaText({ delta, label }: { delta: Delta; label?: string }) {
  const change = percentChange(delta.current, delta.previous);
  const diff = delta.current - delta.previous;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const DirectionIcon =
    direction === 'up' ? IconArrowUpRight : direction === 'down' ? IconArrowDownRight : IconMinus;

  return (
    <span
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        direction === 'up' && 'text-emerald-700 dark:text-emerald-400',
        direction === 'down' && 'text-destructive',
        direction === 'flat' && 'text-muted-foreground'
      )}
    >
      <DirectionIcon size={14} aria-hidden="true" />
      {change === null ? 'New' : `${change > 0 ? '+' : ''}${change}%`}
      <span className="font-normal text-muted-foreground">
        · {diff >= 0 ? '+' : ''}
        {formatNumber(diff)} {label}
      </span>
    </span>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 surface p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
