import { cn } from '@repo/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

/**
 * Pillar colours are fixed across the page (spec p.06):
 * indigo = format, teal = citations, amber = team.
 */
export const pillarTone = {
  format: 'indigo',
  citations: 'teal',
  team: 'amber',
} as const;

const chipVariants = cva(
  'inline-flex h-6.5 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-medium text-xs [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        indigo: 'bg-indigo-50 text-indigo-700',
        teal: 'bg-teal-50 text-teal-700',
        amber: 'bg-amber-100 text-amber-800',
        neutral: 'bg-slate-100 text-slate-700',
        dark: 'bg-night text-indigo-100',
        'on-dark': 'bg-white/10 text-indigo-100',
      },
    },
    defaultVariants: { tone: 'indigo' },
  }
);

interface ChipProps extends VariantProps<typeof chipVariants> {
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Chip({ tone, icon, className, children }: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone }), className)}>
      {icon}
      {children}
    </span>
  );
}
