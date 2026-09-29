'use client';

import { Button } from '@repo/ui/components/ui/button';
import { IconLoader2 } from '@tabler/icons-react';
import { TABS, type TabId } from './types';

/** Appears while there are unsaved edits, and says where they are. */
export function SaveBar({
  dirtyTabs,
  errorCount,
  saving,
  onSave,
  onDiscard,
}: {
  dirtyTabs: Set<TabId>;
  errorCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const where = TABS.filter((tab) => dirtyTabs.has(tab.id))
    .map((tab) => tab.label)
    .join(', ');

  return (
    <section
      aria-label="Unsaved changes"
      className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-foreground px-4 py-2.5 text-background shadow-lg"
    >
      <p className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />
        Unsaved changes in {where}
        {errorCount > 0 && (
          <span className="text-red-300">
            · fix {errorCount} error{errorCount === 1 ? '' : 's'} to save
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-background hover:bg-background/15 hover:text-background"
          disabled={saving}
          onClick={onDiscard}
        >
          Discard
        </Button>
        <Button size="sm" variant="secondary" disabled={saving || errorCount > 0} onClick={onSave}>
          {saving && <IconLoader2 size={14} className="animate-spin" aria-hidden="true" />}
          Save
          <kbd className="ml-1 hidden font-mono text-[10px] opacity-60 sm:inline">⌘S</kbd>
        </Button>
      </div>
    </section>
  );
}
