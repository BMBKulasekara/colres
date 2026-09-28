import { cn } from '@repo/ui/lib/utils';
import { Plus, Sparkles } from 'lucide-react';
import { MockWindow } from './primitives';

type Suggestion = {
  title: string;
  meta: string;
} & ({ state: 'suggested'; match: number } | { state: 'cited'; citedAs: number });

const suggestions: Suggestion[] = [
  {
    title: 'Communication-efficient learning of deep networks from decentralized data',
    meta: 'McMahan et al. · 2017 · 14,213 citations',
    state: 'suggested',
    match: 94,
  },
  {
    title: 'SCAFFOLD: Stochastic controlled averaging for FL',
    meta: 'Karimireddy et al. · 2020 · 2,904 citations',
    state: 'suggested',
    match: 88,
  },
  {
    title: 'Federated optimization in heterogeneous networks',
    meta: 'Li et al. · 2020 · 3,512 citations',
    state: 'cited',
    citedAs: 2,
  },
];

/** Research-assistant deep-dive visual: suggested / hover / cited states. */
export function ResearchSuggestionsMock() {
  return (
    <MockWindow className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-indigo-600" />
        <span className="font-semibold text-slate-900 text-sm sm:text-base">
          Suggested for &ldquo;Related Work&rdquo;
        </span>
        <span className="ml-auto hidden text-slate-500 text-xs sm:inline">via OpenAlex</span>
      </div>

      <ul className="mt-4 space-y-3">
        {suggestions.map((s) => (
          <li
            key={s.title}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-indigo-200',
              s.state === 'cited' && 'opacity-60'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 text-sm leading-5">{s.title}</p>
              <p className="mt-0.5 text-slate-500 text-xs">{s.meta}</p>
            </div>
            {s.state === 'suggested' ? (
              <>
                <span className="hidden rounded-full bg-teal-50 px-2 py-1 font-medium text-teal-700 text-xs sm:inline">
                  {s.match}%
                </span>
                <span className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-900 text-sm">
                  <Plus className="size-3.5" /> Cite
                </span>
              </>
            ) : (
              <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-600 text-xs">
                Cited [{s.citedAs}]
              </span>
            )}
          </li>
        ))}
      </ul>
    </MockWindow>
  );
}
