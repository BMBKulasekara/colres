import { cn } from '@repo/ui/lib/utils';
import type { ReactNode } from 'react';

/** 1280 px max width with 20 / 40 / 80 px side gutters (spec p.04). */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-5 md:px-10 xl:px-20', className)}>
      {children}
    </div>
  );
}
