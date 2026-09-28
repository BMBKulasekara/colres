import { cn } from '@repo/ui/lib/utils';
import { LayoutTemplate, type LucideIcon, Quote, Users } from 'lucide-react';
import { Eyebrow } from '../ui/eyebrow';
import { Reveal } from '../ui/reveal';
import { Section } from '../ui/section';

interface Pillar {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  body: string;
  replaces: string;
}

// Pillar colour mapping: indigo = format, teal = citations, amber = team.
const pillars: Pillar[] = [
  {
    icon: LayoutTemplate,
    iconClassName: 'bg-indigo-50 text-indigo-600',
    title: 'Formatted from the first word',
    body: "Templates enforce the venue's rules as you write: columns, heading numbering, captions, page size.",
    replaces: 'Word styles, LaTeX class files',
  },
  {
    icon: Quote,
    iconClassName: 'bg-teal-50 text-teal-600',
    title: 'Citations that keep up',
    body: 'Insert a source and the number, author–date label and reference list update themselves, in IEEE or APA.',
    replaces: 'Reference managers, BibTeX',
  },
  {
    icon: Users,
    iconClassName: 'bg-amber-100 text-amber-800',
    title: 'One room for the team',
    body: 'Co-write live, comment on a sentence, and chat with files and voice notes next to the draft.',
    replaces: 'Email threads, group chats',
  },
];

export function Pillars() {
  return (
    <Section labelledBy="why-heading" background="muted">
      <div className="grid items-end gap-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>Why Colres</Eyebrow>
          <h2
            id="why-heading"
            className="mt-3 text-balance font-bold text-[32px] text-slate-900 leading-9 tracking-[-0.03em] md:text-[44px] md:leading-12"
          >
            Your paper lives in five tools.{' '}
            <span className="block text-slate-400">It should live in one.</span>
          </h2>
        </div>
        <p className="text-pretty text-lg text-text-body leading-7 md:text-xl md:leading-8">
          Drafts in a doc, references in a manager, formatting in LaTeX, feedback over email,
          discussion in a group chat. Every hand-off costs you a day and adds a mistake.
        </p>
      </div>

      <ul className="mt-14 grid gap-6 md:mt-16 lg:grid-cols-3">
        {pillars.map((p, i) => (
          <Reveal
            as="li"
            key={p.title}
            index={i}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-card md:p-8"
          >
            <span
              className={cn(
                'flex size-11 items-center justify-center rounded-xl [&_svg]:size-5.5',
                p.iconClassName
              )}
            >
              <p.icon aria-hidden strokeWidth={1.75} />
            </span>
            <h3 className="mt-6 font-semibold text-[20px] text-slate-900 leading-7 tracking-[-0.015em] md:text-[22px] md:leading-[29px]">
              {p.title}
            </h3>
            <p className="mt-3 mb-6 text-base text-text-body leading-[26px]">{p.body}</p>
            <p className="mt-auto flex justify-between gap-4 border-slate-200 border-t pt-5 text-sm">
              <span className="text-slate-500">Replaces</span>
              <span className="text-right font-medium text-slate-900">{p.replaces}</span>
            </p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
