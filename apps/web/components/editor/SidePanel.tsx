'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/ui/tooltip';
import {
  Activity,
  BookMarked,
  History,
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  Target,
  Telescope,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type PanelId =
  | 'research'
  | 'references'
  | 'comments'
  | 'chat'
  | 'activity'
  | 'history'
  | 'goals';

export const PANELS: { id: PanelId; title: string; icon: LucideIcon; description: string }[] = [
  {
    id: 'research',
    title: 'Research',
    icon: Telescope,
    description: 'Papers suggested from your title and abstract.',
  },
  {
    id: 'references',
    title: 'References',
    icon: BookMarked,
    description: "This document's bibliography.",
  },
  {
    id: 'comments',
    title: 'Comments',
    icon: MessageSquare,
    description: 'Open comment threads on the text.',
  },
  { id: 'chat', title: 'Team chat', icon: MessagesSquare, description: 'Talk with co-authors.' },
  {
    id: 'activity',
    title: 'Activity',
    icon: Activity,
    description: 'Who contributed what over the last 30 days.',
  },
  {
    id: 'history',
    title: 'History',
    icon: History,
    description: 'Earlier versions of this document.',
  },
  {
    id: 'goals',
    title: 'Goals',
    icon: Target,
    description: 'Word targets and the submission deadline.',
  },
];

export interface PanelBadge {
  count: number;
  /** Drawn in the attention colour, e.g. when a chat message mentions you. */
  highlight?: boolean;
  /** Read out instead of the bare number. */
  label: string;
}

/**
 * The icon rail on the right edge. Each button opens its panel, or closes it
 * when it is already the one showing.
 */
export function PanelRail({
  active,
  onSelect,
  badges,
}: {
  active: PanelId | null;
  onSelect: (panel: PanelId | null) => void;
  badges: Partial<Record<PanelId, PanelBadge>>;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Side panels"
      aria-orientation="vertical"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-border bg-card py-2"
    >
      {PANELS.map((panel) => {
        const isActive = panel.id === active;
        const badge = badges[panel.id];
        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-pressed={isActive}
                aria-controls="editor-side-panel"
                aria-label={
                  badge && badge.count > 0 ? `${panel.title}, ${badge.label}` : panel.title
                }
                onClick={() => onSelect(isActive ? null : panel.id)}
                className={`relative ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <panel.icon aria-hidden="true" />
                {badge && badge.count > 0 && (
                  <span
                    aria-hidden="true"
                    className={`absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6875rem] font-semibold leading-none tabular-nums ${
                      badge.highlight
                        ? 'bg-attention text-white'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {badge.count > 99 ? '99+' : badge.count}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{panel.title}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * A panel's frame: its title, a close button and the scrolling body. Docked
 * beside the page on wide screens, so the page stays readable while a paper
 * is read or a thread answered.
 */
export function SidePanelFrame({
  panel,
  onClose,
  headerExtra,
  children,
  className = '',
}: {
  panel: PanelId;
  onClose: () => void;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const meta = PANELS.find((entry) => entry.id === panel);
  return (
    <section
      id="editor-side-panel"
      aria-label={meta?.title}
      className={`flex min-h-0 flex-col bg-card ${className}`}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">{meta?.title}</h2>
          {headerExtra}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={`Close ${meta?.title ?? 'panel'} (⌘/)`}
          className="text-muted-foreground"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</div>
    </section>
  );
}
