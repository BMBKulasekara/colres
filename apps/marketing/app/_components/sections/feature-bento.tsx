import { cn } from '@repo/ui/lib/utils';
import { Check, Printer, Quote, Sparkles, Table, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AvatarStack, Cite, TextLines } from '../mockups/primitives';
import { Chip } from '../ui/chip';
import { Reveal } from '../ui/reveal';
import { Section, SectionHeading } from '../ui/section';

const extras = [
  'Comments & suggestions',
  'Team chat with files & voice',
  'Cross-references',
  'Print & PDF export',
  'Organizations & roles',
];

export function FeatureBento() {
  return (
    <Section id="features" labelledBy="features-heading">
      <SectionHeading
        id="features-heading"
        eyebrow="Features"
        title={
          <>
            Everything a paper needs.
            <br className="hidden sm:block" /> Nothing it doesn&apos;t.
          </>
        }
      />

      <div className="mt-14 grid gap-6 md:mt-16 md:grid-cols-2 lg:grid-cols-12">
        <BentoCard index={0} className="group/paged md:col-span-2 lg:col-span-7 lg:min-h-82.5">
          <div className="grid h-full gap-6 sm:grid-cols-[1fr_1.1fr]">
            <div>
              <Chip tone="indigo" icon={<Printer />}>
                Paged view
              </Chip>
              <CardTitle>See every page exactly as it will print</CardTitle>
              <CardBody>
                Real page breaks, two-column IEEE layout, and page numbers, all while you type.
              </CardBody>
            </div>
            <PagedSheets />
          </div>
        </BentoCard>

        <BentoCard index={1} className="md:col-span-2 lg:col-span-5">
          <Chip tone="teal" icon={<Quote />}>
            Citations
          </Chip>
          <CardTitle>IEEE numbers. APA author–date. Automatic.</CardTitle>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 font-serif text-[15px] text-slate-800 leading-7">
            <p>
              …has been widely studied <Cite>[1]–[3]</Cite>.
            </p>
            <p>
              …as Smith and Lee <Cite>(2021)</Cite> argue.
            </p>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2">
            {['IEEE', 'APA 7', 'ACM', 'Vancouver'].map((s) => (
              <li key={s}>
                <Chip tone="neutral" className="h-7 px-3 text-[13px]">
                  {s}
                </Chip>
              </li>
            ))}
          </ul>
        </BentoCard>

        <BentoCard index={2} className="lg:col-span-4">
          <Chip tone="amber" icon={<Users />}>
            Live together
          </Chip>
          <CardTitle>Co-write in real time</CardTitle>
          <div className="mt-5 flex items-center gap-3">
            <AvatarStack
              people={[
                { initials: 'AK', tone: 'indigo' },
                { initials: 'MR', tone: 'teal' },
                { initials: 'JS', tone: 'amber' },
                { initials: '+4', tone: 'slate' },
              ]}
            />
            <span className="text-slate-500 text-sm">editing now</span>
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="text-slate-500">
              <b className="font-semibold text-slate-900">Maya</b> · 2m
            </p>
            <p className="mt-1 text-slate-800">Can we cite the 2023 survey here?</p>
          </div>
        </BentoCard>

        <BentoCard index={3} className="lg:col-span-4">
          <Chip tone="indigo" icon={<Table />}>
            Figures &amp; tables
          </Chip>
          <CardTitle>Captions number themselves</CardTitle>
          <SampleTable />
        </BentoCard>

        <BentoCard index={4} dark className="md:col-span-2 lg:col-span-4">
          <Chip tone="on-dark" icon={<Sparkles />}>
            Research assistant
          </Chip>
          <h3 className="mt-5 font-semibold text-[20px] text-white leading-7 tracking-[-0.015em]">
            Find papers you should be citing
          </h3>
          <ul className="mt-5 space-y-2.5 text-sm">
            {[
              ['Communication-efficient FL', '94% match'],
              ['Scaffold: stochastic control…', '88%'],
            ].map(([title, match]) => (
              <li
                key={title}
                className="truncate rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-indigo-50"
              >
                {title} · <span className="text-teal-400">{match}</span>
              </li>
            ))}
          </ul>
        </BentoCard>
      </div>

      <ul className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-3 text-[15px] text-slate-600">
        {extras.map((e) => (
          <li key={e} className="flex items-center gap-1.5">
            <Check aria-hidden className="size-4 text-teal-600" /> {e}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function BentoCard({
  index,
  dark,
  className,
  children,
}: {
  index: number;
  /** One dark card per grid, never more (spec p.07). */
  dark?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Reveal
      index={index}
      className={cn(
        'overflow-hidden rounded-2xl border px-6 py-6 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover md:px-8 md:py-7',
        dark
          ? 'bg-night-glow border-indigo-900 hover:border-indigo-500'
          : 'border-slate-200 bg-white hover:border-indigo-200',
        className
      )}
    >
      {children}
    </Reveal>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-5 text-balance font-semibold text-[20px] text-slate-900 leading-7 tracking-[-0.015em] md:text-[22px] md:leading-[29px]">
      {children}
    </h3>
  );
}

function CardBody({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-base text-text-body leading-[26px]">{children}</p>;
}

/** Two tilted paper sheets that straighten when the card is hovered. */
function PagedSheets() {
  return (
    <div aria-hidden className="relative flex h-56 items-start justify-center gap-3 pt-2 sm:h-auto">
      <div className="h-52 w-40 rotate-[-3deg] rounded-sm border border-slate-200 bg-white p-3 shadow-card-hover transition-transform duration-300 group-hover/paged:rotate-0">
        <p className="text-center font-serif text-[9px] text-slate-800">
          Adaptive Federated Learning
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <TextLines widths={['100%', '90%', '100%', '80%', '100%']} lineClassName="h-1" />
          <div>
            <div className="h-6 rounded-[2px] bg-slate-200" />
            <TextLines className="mt-1.5" widths={['100%', '75%']} lineClassName="h-1" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex h-52 w-40 rotate-2 flex-col rounded-sm border border-slate-200 bg-white p-3 shadow-card-hover transition-transform duration-300 group-hover/paged:rotate-0">
        <div className="grid grid-cols-2 gap-1.5">
          <TextLines widths={['100%', '100%', '70%']} lineClassName="h-1" />
          <div className="h-8 rounded-[2px] border border-slate-300" />
        </div>
        <span className="mt-auto text-center font-serif text-[9px] text-slate-500">2</span>
      </div>
    </div>
  );
}

function SampleTable() {
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 font-serif text-[13px] text-slate-800">
      <p className="pt-2 text-center text-[11px] tracking-wide">TABLE I</p>
      <p className="pb-2 text-center text-[10px] uppercase tracking-wider">Accuracy by method</p>
      <table className="w-full border-slate-200 border-t text-left">
        <thead>
          <tr className="border-slate-200 border-b">
            <th className="px-3 py-1.5 font-semibold">Method</th>
            <th className="px-3 py-1.5 font-semibold">Acc.</th>
            <th className="px-3 py-1.5 font-semibold">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-1.5">FedAvg</td>
            <td className="px-3 py-1.5">91.2</td>
            <td className="px-3 py-1.5">4.1 s</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
