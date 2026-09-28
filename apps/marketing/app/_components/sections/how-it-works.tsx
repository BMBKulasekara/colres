import { cn } from '@repo/ui/lib/utils';
import { Check } from 'lucide-react';
import { Reveal } from '../ui/reveal';
import { Section, SectionHeading } from '../ui/section';

const steps = [
  {
    title: 'Pick a template',
    body: 'IEEE, APA, ACM, thesis. Fill in title and authors once.',
  },
  {
    title: 'Write & cite together',
    body: 'Invite co-authors. Cite as you go; the formatting holds.',
  },
  {
    title: 'Print & submit',
    body: 'Export a PDF that matches the venue, first time.',
  },
];

export function HowItWorks() {
  return (
    <Section labelledBy="how-heading">
      <SectionHeading
        id="how-heading"
        eyebrow="How it works"
        title="From blank page to camera-ready in three steps"
        className="max-w-4xl"
      />

      <ol className="relative mt-14 grid gap-10 md:mt-16 md:grid-cols-3 md:gap-6">
        {/* Dashed connector between the step markers (desktop only). */}
        <span
          aria-hidden
          className="absolute top-6 right-[calc(100%/6)] left-[calc(100%/6)] hidden border-indigo-200 border-t-2 border-dashed md:block"
        />
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <Reveal as="li" key={step.title} index={i} className="relative text-center">
              <span
                className={cn(
                  'relative mx-auto flex size-12 items-center justify-center rounded-full font-semibold text-lg text-white ring-8 ring-white',
                  last ? 'bg-teal-600' : 'bg-indigo-600'
                )}
              >
                {last ? (
                  <Check className="size-5" strokeWidth={2.5} aria-label={`Step ${i + 1}`} />
                ) : (
                  <>
                    <span className="sr-only">Step </span>
                    {i + 1}
                  </>
                )}
              </span>
              <h3 className="mt-6 font-semibold text-[20px] text-slate-900 leading-7 tracking-[-0.015em] md:text-[22px]">
                {step.title}
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-base text-text-body leading-[26px]">
                {step.body}
              </p>
            </Reveal>
          );
        })}
      </ol>
    </Section>
  );
}
