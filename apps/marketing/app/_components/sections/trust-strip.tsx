import { cn } from '@repo/ui/lib/utils';
import { Container } from '../ui/container';

/**
 * Formats, set as type. These are not publisher logos and must never be
 * replaced with trademark artwork (spec p.06).
 */
const formats = [
  { name: 'IEEE', className: 'font-sans font-bold tracking-tight' },
  { name: 'APA 7', className: 'font-serif' },
  { name: 'ACM', className: 'font-sans font-bold' },
  { name: 'Springer LNCS', className: 'font-serif italic' },
  { name: 'ELSEVIER', className: 'font-sans font-bold tracking-wide' },
  { name: 'Thesis', className: 'font-serif' },
  { name: 'Vancouver', className: 'font-sans font-semibold' },
];

export function TrustStrip() {
  return (
    <section aria-labelledby="formats-heading" className="border-slate-100 border-b bg-white py-12">
      <Container>
        <h2 id="formats-heading" className="text-center text-slate-600 text-sm">
          Built for the formats your paper will be judged by
        </h2>
        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 lg:justify-between">
          {formats.map((f) => (
            <li
              key={f.name}
              className={cn(
                'text-[22px] text-slate-400 transition-colors duration-200 hover:text-slate-700',
                f.className
              )}
            >
              {f.name}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
