import { cn } from '@repo/ui/lib/utils';
import type { ReactNode } from 'react';

/**
 * Building blocks shared by the product mockups. Everything here is visual
 * only; mockups are marked `aria-hidden` or given a single `role="img"` label
 * by their parent.
 */

const avatarTones = {
  indigo: 'bg-indigo-500',
  teal: 'bg-teal-600',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-200 text-slate-600',
} as const;

export type AvatarTone = keyof typeof avatarTones;

export function Avatar({
  initials,
  tone = 'indigo',
  className,
}: {
  initials: string;
  tone?: AvatarTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-[10px] text-white ring-2 ring-white',
        avatarTones[tone],
        className
      )}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({
  people,
  className,
}: {
  people: { initials: string; tone: AvatarTone }[];
  className?: string;
}) {
  return (
    <span className={cn('-space-x-1.5 flex', className)}>
      {people.map((p) => (
        <Avatar key={p.initials} initials={p.initials} tone={p.tone} />
      ))}
    </span>
  );
}

/** A white app surface: radius 18, hairline border, deep soft shadow. */
export function MockWindow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-float',
        className
      )}
    >
      {children}
    </div>
  );
}

/** An inline citation marker, e.g. [1] or (2021). */
export function Cite({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-[3px] bg-indigo-50 px-0.5 font-sans text-[0.85em] text-indigo-600',
        className
      )}
    >
      {children}
    </span>
  );
}

/** Grey placeholder lines standing in for body text. */
export function TextLines({
  widths,
  className,
  lineClassName,
}: {
  widths: readonly string[];
  className?: string;
  lineClassName?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {widths.map((w, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static decorative list
          key={i}
          className={cn('h-1.5 rounded-full bg-slate-200', lineClassName)}
          style={{ width: w }}
        />
      ))}
    </div>
  );
}

/** Floating toast-style proof card used around the hero shot. */
export function ProofCard({
  icon,
  iconClassName,
  title,
  body,
  className,
}: {
  icon: ReactNode;
  /** Tile colours, e.g. `bg-teal-50 text-teal-600`. */
  iconClassName?: string;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 pr-6 shadow-float',
        className
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5',
          iconClassName
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold text-[15px] text-slate-900">{title}</span>
        <span className="block text-[13px] text-slate-500">{body}</span>
      </span>
    </div>
  );
}
