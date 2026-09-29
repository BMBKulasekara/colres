'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/ui/tooltip';
import { useEffect, useState } from 'react';
import { formatDateTime, formatRelative } from '../lib/format';

/** "3 minutes ago", refreshed each minute, with the exact time on hover or focus. */
export function RelativeTime({ timestamp, className }: { timestamp: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users can reveal the exact time in the tooltip */}
        <time dateTime={new Date(timestamp).toISOString()} className={className} tabIndex={0}>
          {formatRelative(timestamp, now)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(timestamp)}</TooltipContent>
    </Tooltip>
  );
}
