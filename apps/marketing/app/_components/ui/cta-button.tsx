import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { ComponentProps } from 'react';

/**
 * Marketing button styles (spec p.14), layered on the shared `@repo/ui`
 * Button so focus, disabled and icon handling stay in one place.
 */
const ctaVariants = cva(
  'font-semibold shadow-none transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:translate-y-px focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 focus-visible:ring-offset-[3px] focus-visible:ring-offset-white',
  {
    variants: {
      tone: {
        primary:
          'bg-indigo-600 text-white shadow-[0_1px_2px_rgb(79_70_229/0.3)] hover:bg-primary-hover hover:shadow-card-hover',
        secondary:
          'border border-slate-200 bg-white text-slate-900 shadow-card hover:border-slate-300 hover:bg-slate-50',
        ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        'on-dark': 'bg-white text-slate-900 hover:bg-indigo-50',
        'on-dark-ghost':
          'border border-white/40 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-offset-transparent',
      },
      size: {
        sm: 'h-9 rounded-lg px-3.5 text-sm',
        md: 'h-11 rounded-[10px] px-5 text-[15px]',
        lg: 'h-13 rounded-xl px-6.5 text-base',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      tone: 'primary',
      size: 'md',
    },
  }
);

type CtaLinkProps = ComponentProps<typeof Link> & VariantProps<typeof ctaVariants>;

export function CtaLink({ tone, size, fullWidth, className, children, ...props }: CtaLinkProps) {
  return (
    <Button asChild className={cn(ctaVariants({ tone, size, fullWidth }), className)}>
      <Link {...props}>{children}</Link>
    </Button>
  );
}
