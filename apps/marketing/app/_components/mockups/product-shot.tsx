import { cn } from '@repo/ui/lib/utils';
import {
  Bold,
  Check,
  Hash,
  Italic,
  Printer,
  Quote,
  Sparkles,
  Table,
  Underline,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { AvatarStack, Cite, MockWindow, ProofCard, TextLines } from './primitives';

// TODO(launch): replace with a real 2x WebP screenshot of the editor (spec p.15).

const references = [
  'H. B. McMahan et al., "Communication-efficient learning of deep networks," AISTATS, 2017.',
  'T. Li et al., "Federated optimization in heterogeneous networks," MLSys, 2020.',
  'P. Kairouz et al., "Advances and open problems in FL," 2021.',
];

/** Hero product shot: editor chrome, a paged IEEE sheet and the references rail. */
export function ProductShot() {
  return (
    <div
      role="img"
      aria-label="The Colres editor showing an IEEE conference paper in paged view, with three co-authors online and an automatically numbered reference list."
      className="relative mx-auto max-w-[1040px]"
    >
      <MockWindow className="text-left">
        <WindowBar />
        <Toolbar />
        <div className="grid bg-slate-100/70 md:grid-cols-[1fr_300px]">
          <div className="px-4 pt-6 md:px-10">
            <PaperPage />
          </div>
          <ReferencesRail />
        </div>
      </MockWindow>

      <ProofCard
        className="-left-8 absolute bottom-16 hidden animate-float lg:flex"
        icon={<Check strokeWidth={2.5} />}
        iconClassName="bg-teal-50 text-teal-600"
        title="Formatted to IEEE"
        body="Numbering & captions automatic"
      />
      <ProofCard
        className="-right-10 absolute top-24 hidden animate-float [animation-delay:-3s] lg:flex"
        icon={<Quote />}
        iconClassName="bg-indigo-50 text-indigo-600"
        title="Citation added"
        body="Bibliography updated"
      />
    </div>
  );
}

function WindowBar() {
  return (
    <div className="flex h-12 items-center gap-4 border-slate-200 border-b px-4">
      <span aria-hidden className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-3 rounded-full bg-slate-200" />
        ))}
      </span>
      <span className="truncate text-[13px] text-slate-600">
        Federated Learning for Edge Devices
        <span className="hidden sm:inline"> · IEEE Conference</span>
      </span>
      <span className="ml-auto hidden items-center gap-3 sm:flex">
        <AvatarStack
          people={[
            { initials: 'AK', tone: 'indigo' },
            { initials: 'MR', tone: 'teal' },
            { initials: 'JS', tone: 'amber' },
          ]}
        />
        <span className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white text-xs">
          Share
        </span>
      </span>
    </div>
  );
}

function ToolButton({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[13px] text-slate-600 [&_svg]:size-4',
        active && 'bg-indigo-50 text-indigo-600'
      )}
    >
      {children}
    </span>
  );
}

function Toolbar() {
  return (
    <div className="flex h-12 items-center gap-1 overflow-hidden border-slate-200 border-b px-3">
      <ToolButton active>
        <Bold />
      </ToolButton>
      <ToolButton>
        <Italic />
      </ToolButton>
      <ToolButton>
        <Underline />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolButton>H1</ToolButton>
      <ToolButton>H2</ToolButton>
      <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
      <span className="hidden sm:contents">
        <ToolButton>
          <Quote />
        </ToolButton>
        <ToolButton>
          <Table />
        </ToolButton>
        <ToolButton>
          <Hash />
        </ToolButton>
      </span>
      <span className="ml-2 hidden gap-2 md:flex">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[13px] text-indigo-600">
          Paged view
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[13px] text-slate-600">
          Two-column
        </span>
      </span>
      <Printer className="ml-auto size-4 text-slate-500" />
    </div>
  );
}

function PaperPage() {
  return (
    <div className="mx-auto h-[300px] max-w-[640px] rounded-t-sm bg-white px-6 pt-8 font-serif text-slate-900 shadow-card sm:h-[340px] sm:px-12">
      <p className="text-balance text-center text-lg leading-6 sm:text-[22px] sm:leading-7">
        Federated Learning for Resource-Constrained Edge Devices
      </p>
      <p className="mt-2 text-center text-[11px] text-slate-600 sm:text-[13px]">
        A. Kumar, M. Rivera, J. Silva · University of Colombo
      </p>
      <div className="mt-5 grid grid-cols-2 gap-6 text-[11px] leading-[1.55] sm:text-[12.5px]">
        <div>
          <p className="relative">
            {/* First line, so the name tag sits in the gap under the byline. */}
            <Caret name="Maya" tone="teal" className="left-1/3" />
            <b>
              <i>Abstract</i>—
            </b>
            Training models across thousands of devices without centralising data remains costly{' '}
            <Cite>[1]</Cite>. We propose an adaptive scheme that reduces communication by 38%{' '}
            <Cite>[2], [3]</Cite>.
          </p>
          <p className="mt-3 text-center text-[10px] tracking-wide sm:text-[11px]">
            I. I<span className="text-[0.8em]">NTRODUCTION</span>
          </p>
          <TextLines className="mt-2" widths={['100%', '92%', '100%', '70%']} />
        </div>
        <div>
          <div className="flex aspect-[4/2.6] items-center justify-center rounded-sm border border-slate-300 bg-[repeating-linear-gradient(135deg,#f1f5f9_0_6px,#fff_6px_12px)] font-sans text-[10px] text-slate-400">
            Fig. 1
          </div>
          <p className="mt-1.5 text-center text-[10px] sm:text-[11px]">
            Fig. 1. System architecture.
          </p>
          <div className="relative mt-6">
            <Caret name="João" tone="amber" className="left-1/2" />
            <TextLines widths={['100%', '85%', '100%']} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Caret({
  name,
  tone,
  className,
}: {
  name: string;
  tone: 'teal' | 'amber';
  className?: string;
}) {
  const color = tone === 'teal' ? 'bg-teal-600' : 'bg-amber-500';
  return (
    <span className={cn('-top-0.5 absolute left-0 h-[1.3em] w-0.5', color, className)}>
      <span
        className={cn(
          'absolute bottom-full left-0 mb-0.5 whitespace-nowrap rounded-sm px-1.5 py-0.5 font-sans font-semibold text-[10px] text-white',
          color
        )}
      >
        {name}
      </span>
    </span>
  );
}

function ReferencesRail() {
  return (
    <div className="hidden border-slate-200 border-l bg-white p-5 md:block">
      <div className="flex gap-2">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[13px] text-indigo-600">
          References
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[13px] text-slate-600">
          Research
        </span>
      </div>
      <p className="mt-4 font-semibold text-slate-900 text-sm">References · IEEE</p>
      <ol className="mt-3 space-y-3">
        {references.map((ref, i) => (
          <li key={ref} className="flex gap-2 text-slate-600 text-xs leading-5">
            <span className="text-indigo-600">[{i + 1}]</span>
            {ref}
          </li>
        ))}
      </ol>
      <p className="mt-5 flex items-center gap-2 rounded-xl border border-indigo-200 border-dashed bg-indigo-50/60 px-3 py-2.5 text-[13px] text-indigo-600">
        <Sparkles className="size-4" /> 3 related papers suggested
      </p>
    </div>
  );
}
