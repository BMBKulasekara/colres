import { cn } from '@repo/ui/lib/utils';
import { Star } from 'lucide-react';
import { Avatar, type AvatarTone } from '../mockups/primitives';
import { Reveal } from '../ui/reveal';
import { Section } from '../ui/section';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  tone: AvatarTone;
}

// TODO(launch): placeholders from the design spec. Replace every [bracketed]
// value with a real, consented quote before this page goes public.
const testimonials: Testimonial[] = [
  {
    quote:
      'We submitted to an IEEE conference without opening LaTeX once. Three of us wrote the same section at 2 a.m. and nothing broke.',
    name: '[Name]',
    role: 'PhD candidate, [University]',
    initials: 'NP',
    tone: 'indigo',
  },
  {
    quote:
      'Comments on the exact sentence. My students finally act on feedback instead of losing it in email.',
    name: '[Name]',
    role: 'Senior Lecturer, [Dept.]',
    initials: 'SK',
    tone: 'teal',
  },
  {
    quote:
      "APA 7 references in the right order, with hanging indents. I didn't have to think about it.",
    name: '[Name]',
    role: 'MSc Psychology, [University]',
    initials: 'RD',
    tone: 'amber',
  },
];

const STARS = [1, 2, 3, 4, 5];

export function Testimonials() {
  return (
    <Section labelledBy="testimonials-heading" background="muted">
      <h2 id="testimonials-heading" className="sr-only">
        What researchers say
      </h2>
      <ul className="grid gap-6 lg:grid-cols-[1.25fr_1fr_1fr]">
        {testimonials.map((t, i) => {
          const lead = i === 0;
          return (
            <Reveal
              as="li"
              key={t.role}
              index={i}
              className={cn(
                'flex flex-col rounded-2xl p-8',
                lead
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-800 shadow-card'
              )}
            >
              <figure className="flex h-full flex-col">
                <div role="img" aria-label="5 out of 5 stars" className="flex gap-1">
                  {STARS.map((s) => (
                    <Star key={s} aria-hidden className="size-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote
                  className={cn(
                    'mt-5 text-pretty',
                    lead ? 'text-[20px] leading-8' : 'text-base leading-[26px]'
                  )}
                >
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3 pt-8">
                  <Avatar
                    initials={t.initials}
                    tone={lead ? 'indigo' : t.tone}
                    className={cn('size-11 text-xs', lead && 'bg-white/20 ring-white/30')}
                  />
                  <span>
                    <span className={cn('block font-semibold', !lead && 'text-slate-900')}>
                      {t.name}
                    </span>
                    <span
                      className={cn('block text-sm', lead ? 'text-indigo-200' : 'text-slate-500')}
                    >
                      {t.role}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}
