import { cn } from '@repo/ui/lib/utils';
import type { ReactNode } from 'react';
import { Container } from './container';
import { Eyebrow } from './eyebrow';

const backgrounds = {
  white: 'bg-white',
  muted: 'bg-slate-50',
} as const;

interface SectionProps {
  id?: string;
  /** id of the section's h2; wires up `aria-labelledby`. */
  labelledBy: string;
  background?: keyof typeof backgrounds;
  className?: string;
  children: ReactNode;
}

/** A page section with the spec's vertical rhythm: 72 / 96 / 128 px. */
export function Section({
  id,
  labelledBy,
  background = 'white',
  className,
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('py-18 md:py-24 xl:py-32', backgrounds[background], className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

interface SectionHeadingProps {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(align === 'center' && 'mx-auto max-w-3xl text-center', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        id={id}
        className="mt-3 text-balance font-bold text-[32px] text-slate-900 leading-9 tracking-[-0.03em] md:text-[44px] md:leading-12"
      >
        {title}
      </h2>
      {lead && (
        <p className="mt-5 text-pretty text-lg text-text-body leading-7 md:text-xl md:leading-8">
          {lead}
        </p>
      )}
    </div>
  );
}
