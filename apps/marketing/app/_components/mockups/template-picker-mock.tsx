import { cn } from '@repo/ui/lib/utils';
import type { ThumbLayout } from '../../_lib/templates';
import { MockWindow, TextLines } from './primitives';

const options = [
  { name: 'IEEE Conference', meta: 'Two-column', layout: 'two-column', selected: true },
  { name: 'APA 7 Student', meta: 'Double-spaced', layout: 'title-page', selected: false },
  { name: 'ACM sigconf', meta: 'CCS concepts', layout: 'single', selected: false },
] as const;

/** A miniature page used for template thumbnails. */
export function PageThumb({ layout, className }: { layout: ThumbLayout; className?: string }) {
  return (
    <div className={cn('bg-white p-2.5 shadow-card', className)}>
      {layout === 'two-column' && (
        <>
          <div className="mx-auto h-1 w-3/4 rounded-full bg-slate-300" />
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <TextLines widths={['100%', '90%', '100%', '75%']} lineClassName="h-1" />
            <div>
              <div className="h-4 rounded-[2px] bg-slate-200" />
              <TextLines className="mt-1.5" widths={['100%', '85%']} lineClassName="h-1" />
            </div>
          </div>
        </>
      )}
      {layout === 'title-page' && (
        <div className="flex h-full flex-col items-center pt-6">
          <div className="h-1 w-1/2 rounded-full bg-slate-300" />
          <div className="mt-1.5 h-1 w-1/3 rounded-full bg-slate-200" />
        </div>
      )}
      {layout === 'single' && (
        <TextLines widths={['60%', '100%', '100%', '100%', '70%']} lineClassName="h-1" />
      )}
      {layout === 'chapters' && (
        <div className="flex h-full flex-col items-center pt-8">
          <div className="h-1.5 w-1/2 rounded-full bg-slate-300" />
          <div className="mt-2 h-1 w-1/3 rounded-full bg-slate-200" />
        </div>
      )}
    </div>
  );
}

/** Templates deep-dive visual: the "New document" dialog. */
export function TemplatePickerMock() {
  return (
    <MockWindow className="p-6">
      <p className="font-semibold text-slate-900">New document</p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {options.map((o) => (
          <div
            key={o.name}
            className={cn(
              'rounded-xl border bg-white p-2',
              o.selected ? 'border-2 border-indigo-600 bg-indigo-50/60' : 'border-slate-200'
            )}
          >
            <PageThumb layout={o.layout} className="aspect-[4/3] rounded-sm" />
            <p className="mt-2.5 truncate font-semibold text-slate-900 text-xs sm:text-sm">
              {o.name}
            </p>
            <p className="truncate text-[11px] text-slate-500 sm:text-xs">{o.meta}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <span className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-900 text-sm">
          Cancel
        </span>
        <span className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-sm text-white">
          Create paper
        </span>
      </div>
    </MockWindow>
  );
}
