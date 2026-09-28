import { cn } from '@repo/ui/lib/utils';
import Link from 'next/link';

/** 32 px squircle mark in the brand gradient with a white "C" glyph. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-brand-gradient inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] shadow-card',
        className
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5" fill="none">
        <path
          d="M16.5 8.2A6 6 0 1 0 16.5 15.8"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({
  tone = 'dark',
  className,
}: {
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center gap-2.5 rounded-lg font-semibold text-[22px] tracking-[-0.02em] outline-none focus-visible:ring-[3px] focus-visible:ring-indigo-500/50',
        tone === 'dark' ? 'text-slate-900' : 'text-white',
        className
      )}
    >
      <LogoMark />
      Colres
    </Link>
  );
}
