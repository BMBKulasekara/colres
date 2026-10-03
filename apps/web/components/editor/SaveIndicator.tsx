'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/ui/tooltip';
import { AlertCircle, Check, CloudOff, RefreshCw } from 'lucide-react';
import type { SaveState } from './useAutosave';

function timeOf(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * The autosave state, as an icon and a word — never colour alone — and
 * announced politely to screen readers as it changes.
 */
export function SaveIndicator({
  state,
  lastSavedAt,
  onRetry,
  onDownloadCopy,
}: {
  state: SaveState;
  lastSavedAt: number | null;
  onRetry: () => void;
  onDownloadCopy: () => void;
}) {
  if (state === 'error') {
    return (
      <output aria-live="polite" className="flex items-center gap-1 text-sm">
        <span className="flex items-center gap-1 font-medium text-danger">
          <AlertCircle className="size-4" aria-hidden="true" />
          Couldn&rsquo;t save
        </span>
        <Button variant="ghost" size="xs" onClick={onRetry}>
          Retry
        </Button>
        <Button variant="ghost" size="xs" onClick={onDownloadCopy}>
          Download copy
        </Button>
      </output>
    );
  }

  const content =
    state === 'saving' ? (
      <span className="flex items-center gap-1 text-muted-foreground">
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Saving…
      </span>
    ) : state === 'offline' ? (
      <span className="flex items-center gap-1 font-medium text-warning">
        <CloudOff className="size-4" aria-hidden="true" />
        Offline, kept locally
      </span>
    ) : (
      <span className="flex items-center gap-1 text-success">
        <Check className="size-4" aria-hidden="true" />
        Saved
      </span>
    );

  const tooltip =
    state === 'offline'
      ? 'You are offline. Your edits are kept in this browser and sync when the connection returns.'
      : state === 'saving'
        ? 'Saving your latest changes…'
        : lastSavedAt
          ? `All changes saved · ${timeOf(lastSavedAt)}`
          : 'All changes saved';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="rounded-md px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <output aria-live="polite">{content}</output>
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
