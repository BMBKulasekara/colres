'use client';

import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { type Icon, IconLoader2, IconX } from '@tabler/icons-react';
import { useState } from 'react';

export type BulkAction = {
  label: string;
  icon?: Icon;
  destructive?: boolean;
  /** Resolve to true to clear the selection afterwards. */
  run: (ids: string[]) => Promise<boolean>;
};

/** Floating bar shown while rows are selected. */
export function BulkActionBar({
  count,
  actions,
  selectedIds,
  onClear,
}: {
  count: number;
  actions: BulkAction[];
  selectedIds: string[];
  onClear: () => void;
}) {
  const [running, setRunning] = useState<string | null>(null);

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border bg-foreground px-3 py-2 text-background shadow-lg"
    >
      <span className="px-1 text-sm font-medium tabular-nums" aria-live="polite">
        {count} selected
      </span>
      <span className="h-5 w-px bg-background/20" aria-hidden="true" />
      {actions.map((action) => {
        const ActionIcon = action.icon;
        return (
          <Button
            key={action.label}
            size="sm"
            variant="ghost"
            disabled={running !== null}
            className={cn(
              'text-background hover:bg-background/15 hover:text-background',
              action.destructive && 'text-red-300 hover:text-red-200'
            )}
            onClick={async () => {
              setRunning(action.label);
              try {
                if (await action.run(selectedIds)) onClear();
              } finally {
                setRunning(null);
              }
            }}
          >
            {running === action.label ? (
              <IconLoader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              ActionIcon && <ActionIcon size={15} aria-hidden="true" />
            )}
            {action.label}
          </Button>
        );
      })}
      <Button
        size="icon"
        variant="ghost"
        className="size-8 text-background hover:bg-background/15 hover:text-background"
        aria-label="Clear selection"
        onClick={onClear}
      >
        <IconX size={15} />
      </Button>
    </div>
  );
}
