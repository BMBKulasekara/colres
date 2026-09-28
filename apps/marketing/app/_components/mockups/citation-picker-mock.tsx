import { Search } from 'lucide-react';
import { Cite, MockWindow } from './primitives';

/**
 * Citations deep-dive visual: a citation search over real prose, with the new
 * reference fading into the list when the surrounding <Reveal> becomes visible.
 */
export function CitationPickerMock() {
  return (
    <MockWindow className="relative p-6 sm:p-8">
      <p className="font-serif text-[17px] text-slate-900 leading-8">
        Prior work on federated optimisation <Cite>[1]</Cite>, <Cite>[2]</Cite> assumes stable
        connectivity. Recent surveys{' '}
        <Cite className="outline-2 outline-indigo-500 outline-offset-1">[3]</Cite> relax this
        assumption.
      </p>

      <div className="relative z-10 mt-4 ml-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-3 shadow-float">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-600 text-sm">
          <Search className="size-4 text-slate-400" />
          kairouz advances
        </div>
        <div className="mt-2 rounded-lg bg-indigo-50 px-3 py-2.5">
          <p className="font-semibold text-[13px] text-slate-900 leading-5">
            Advances and open problems in federated learning
          </p>
          <p className="text-slate-500 text-xs">
            Kairouz, McMahan et al. · 2021 · Found. Trends ML
          </p>
        </div>
        <div className="px-3 py-2.5">
          <p className="truncate text-[13px] text-slate-700">
            Federated learning: challenges, methods…
          </p>
          <p className="text-slate-500 text-xs">Li, Sahu et al. · 2020</p>
        </div>
      </div>

      <div className="mt-4 border-slate-200 border-t pt-4">
        <p className="font-mono font-semibold text-slate-700 text-xs uppercase tracking-[0.1em]">
          References
        </p>
        <p className="mt-2 font-serif text-[13px] text-slate-700 leading-5 opacity-0 in-data-[reveal=visible]:animate-fade-in [animation-delay:400ms]">
          [3] P. Kairouz <i>et al.</i>, &ldquo;Advances and open problems in federated
          learning,&rdquo; <i>Found. Trends Mach. Learn.</i>, vol. 14, 2021.
        </p>
      </div>
    </MockWindow>
  );
}
