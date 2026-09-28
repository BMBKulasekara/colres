import { cn } from '@repo/ui/lib/utils';
import type { ReactNode } from 'react';

/** Section label: Geist Mono 13 / 600, +10% tracking, uppercase. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p
      className={cn(
        'font-mono font-semibold text-[13px] text-indigo-600 uppercase tracking-[0.1em]',
        className
      )}
    >
      {children}
    </p>
  );
}
