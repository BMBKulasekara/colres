import { ArrowRight } from 'lucide-react';
import { ctaLabels, links } from '../../_lib/site';
import { Container } from '../ui/container';
import { CtaLink } from '../ui/cta-button';

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-heading" className="bg-white pb-18 md:pb-24 xl:pb-32">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-linear-110 from-indigo-600 via-indigo-700 to-teal-600 px-6 py-12 md:px-16 md:py-16">
          {/* Dot texture fading in from the left. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.18)_1px,transparent_1px)] mask-l-from-0% mask-l-to-100% bg-size-[18px_18px]"
          />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2
                id="final-cta-heading"
                className="text-balance font-extrabold text-[32px] text-white leading-9 tracking-[-0.03em] md:text-[42px] md:leading-12"
              >
                Your next paper starts formatted.
              </h2>
              <p className="mt-4 text-indigo-100 text-lg">
                Totally free. Set up in under a minute.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <CtaLink href={links.signUp} tone="on-dark" size="lg">
                {ctaLabels.primary} <ArrowRight aria-hidden />
              </CtaLink>
              <CtaLink href={links.templates} tone="on-dark-ghost" size="lg">
                {ctaLabels.secondary}
              </CtaLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
