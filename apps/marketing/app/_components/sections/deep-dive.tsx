import { cn } from '@repo/ui/lib/utils';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckList } from '../ui/check-list';
import { Reveal } from '../ui/reveal';
import { Section } from '../ui/section';

const statRule = {
  indigo: 'border-indigo-600',
  teal: 'border-teal-600',
  amber: 'border-amber-500',
} as const;

export interface DeepDiveStat {
  value: string;
  label: string;
  tone: keyof typeof statRule;
}

export interface DeepDiveProps {
  id: string;
  chip: ReactNode;
  title: string;
  body: string;
  checks?: readonly string[];
  stats?: readonly DeepDiveStat[];
  /** Extra content under the body, e.g. a reassurance note. */
  footnote?: ReactNode;
  link?: { label: string; href: string };
  visual: ReactNode;
  /** Put the visual on the left. Rows alternate L/R down the page. */
  reverse?: boolean;
  background?: 'white' | 'muted';
}

/**
 * One 50/50 feature row. Content always runs chip → h2 → body → checks/stats
 * → link so every deep-dive scans the same way (spec p.08).
 */
export function DeepDive({
  id,
  chip,
  title,
  body,
  checks,
  stats,
  footnote,
  link,
  visual,
  reverse,
  background = 'white',
}: DeepDiveProps) {
  const headingId = `${id}-heading`;

  return (
    <Section id={id} labelledBy={headingId} background={background}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className={cn(reverse && 'lg:order-2')}>
          {chip}
          <h2
            id={headingId}
            className="mt-5 text-balance font-bold text-[32px] text-slate-900 leading-9 tracking-[-0.03em] md:text-[38px] md:leading-[44px]"
          >
            {title}
          </h2>
          <p className="mt-5 text-pretty text-lg text-text-body leading-[30px]">{body}</p>

          {checks && <CheckList items={checks} className="mt-8" />}

          {stats && (
            <dl className="mt-8 grid grid-cols-2 gap-6">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className={cn('flex flex-col-reverse border-l-[3px] pl-4', statRule[s.tone])}
                >
                  <dt className="text-slate-600 text-sm">{s.label}</dt>
                  <dd className="font-bold text-[28px] text-slate-900 leading-9">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {footnote && <div className="mt-8">{footnote}</div>}

          {link && (
            <Link
              href={link.href}
              className="group mt-8 inline-flex items-center gap-2 rounded-sm font-semibold text-indigo-600 outline-none hover:text-indigo-700 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50"
            >
              {link.label}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          )}
        </div>

        <Reveal aria-hidden className={cn(reverse && 'lg:order-1')}>
          {visual}
        </Reveal>
      </div>
    </Section>
  );
}
