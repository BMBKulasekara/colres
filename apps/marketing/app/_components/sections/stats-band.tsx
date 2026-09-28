import { templateCount } from '../../_lib/templates';
import { Container } from '../ui/container';
import { Reveal } from '../ui/reveal';

// Only numbers we can defend (spec p.08). The template count is read from the
// catalog; the rest reflect supported citation styles and OpenAlex coverage.
const stats = [
  { value: String(templateCount), label: 'publication-ready templates' },
  { value: '6', label: 'citation styles' },
  { value: '250M+', label: 'scholarly works searchable' },
  { value: '$0', label: 'totally free, for everyone' },
];

export function StatsBand() {
  return (
    <section aria-labelledby="stats-heading" className="bg-night-glow py-16">
      <Container>
        <h2 id="stats-heading" className="sr-only">
          Colres in numbers
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} index={i} className="flex flex-col-reverse">
              <dt className="mt-1 text-base text-indigo-200">{s.label}</dt>
              <dd className="font-extrabold text-4xl text-white tracking-[-0.03em] md:text-[44px] md:leading-12">
                {s.value}
              </dd>
            </Reveal>
          ))}
        </dl>
      </Container>
    </section>
  );
}
