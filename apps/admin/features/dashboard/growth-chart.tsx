'use client';

import { api } from '@repo/convex/_generated/api';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@repo/ui/components/ui/chart';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { cn } from '@repo/ui/lib/utils';
import { IconChartAreaLine } from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../../components/feedback/empty-state';
import type { Range } from './range';

const chartConfig = {
  documents: { label: 'New documents', color: 'var(--chart-1)' },
  users: { label: 'New users', color: 'var(--chart-2)' },
} satisfies ChartConfig;

type Series = keyof typeof chartConfig;

const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const formatDay = (value: string) => dayFormat.format(new Date(`${value}T00:00:00Z`));

export function GrowthChart({ range }: { range: Range }) {
  const data = useQuery(api.admin.stats.timeseries, { range });
  const [hidden, setHidden] = useState<Set<Series>>(new Set());

  const toggle = (series: Series) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(series)) next.delete(series);
      else next.add(series);
      return next;
    });

  const totals = data?.reduce(
    (acc, day) => ({ documents: acc.documents + day.documents, users: acc.users + day.users }),
    { documents: 0, users: 0 }
  );

  return (
    <section aria-labelledby="growth-heading" className="flex flex-col gap-4 surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="growth-heading" className="font-semibold">
            Growth
          </h2>
          <p className="text-sm text-muted-foreground">New documents and sign-ups per day (UTC)</p>
        </div>
        <fieldset className="flex gap-1.5">
          <legend className="sr-only">Series shown</legend>
          {(Object.keys(chartConfig) as Series[]).map((series) => (
            <button
              key={series}
              type="button"
              aria-pressed={!hidden.has(series)}
              onClick={() => toggle(series)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-ring',
                hidden.has(series) && 'opacity-50'
              )}
            >
              <span
                className="size-2.5 rounded-sm"
                style={{ background: chartConfig[series].color }}
                aria-hidden="true"
              />
              {chartConfig[series].label}
              {totals && (
                <span className="text-muted-foreground tabular-nums">{totals[series]}</span>
              )}
            </button>
          ))}
        </fieldset>
      </div>

      {!data ? (
        <Skeleton className="h-60 w-full" />
      ) : totals && totals.documents + totals.users === 0 ? (
        <EmptyState
          icon={IconChartAreaLine}
          title="No new activity in this period"
          description="Documents and sign-ups will chart here as they happen."
          className="h-60 py-0"
        />
      ) : (
        <>
          <p className="sr-only">
            {totals?.documents} documents and {totals?.users} users were created in this period.
          </p>
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-60 w-full"
            aria-hidden="true"
          >
            <AreaChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
              <defs>
                {(Object.keys(chartConfig) as Series[]).map((series) => (
                  <linearGradient key={series} id={`fill-${series}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${series})`} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={`var(--color-${series})`} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={formatDay}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatDay(String(value))}
                    indicator="dot"
                  />
                }
              />
              {(Object.keys(chartConfig) as Series[]).map((series) =>
                hidden.has(series) ? null : (
                  <Area
                    key={series}
                    dataKey={series}
                    type="monotone"
                    fill={`url(#fill-${series})`}
                    stroke={`var(--color-${series})`}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                )
              )}
            </AreaChart>
          </ChartContainer>
        </>
      )}
    </section>
  );
}
