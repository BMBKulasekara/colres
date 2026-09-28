import { ArrowRight } from 'lucide-react';
import { ctaLabels, links } from '../../_lib/site';
import { CheckList } from '../ui/check-list';
import { CtaLink } from '../ui/cta-button';
import { Reveal } from '../ui/reveal';
import { Section, SectionHeading } from '../ui/section';

// Replaces the spec's three-tier pricing (S10) while Colres has no paid plans.
// Keep the `#pricing` anchor so nav and footer links still land here.

const included = [
  'Every template: IEEE, APA 7, ACM, Springer, Elsevier, thesis',
  'Citations & automatic bibliography in 6 styles',
  'Unlimited documents and collaborators',
  'Live co-writing, comments and @mentions',
  'Team chat with files, images and voice',
  'Research assistant for related work',
  'Paged view, print & PDF export',
  'Organizations & roles',
];

export function FreePlan() {
  return (
    <Section id="pricing" labelledBy="pricing-heading">
      <SectionHeading
        id="pricing-heading"
        eyebrow="Pricing"
        title="Totally free. For everyone."
        lead="No plans, no trials, no credit card. Every feature Colres has is yours from the moment you sign up."
      />

      <Reveal className="relative mx-auto mt-14 max-w-4xl rounded-3xl border-2 border-indigo-600 bg-white p-8 shadow-glow md:mt-16 md:p-12">
        <span className="-top-3.5 absolute left-8 rounded-full bg-indigo-600 px-3 py-1 font-semibold text-white text-xs md:left-12">
          Everything included
        </span>

        <div className="grid gap-10 md:grid-cols-[auto_1fr] md:gap-14">
          <div className="md:border-slate-200 md:border-r md:pr-14">
            <p className="font-semibold text-lg text-slate-900">Colres</p>
            <p className="text-slate-500 text-sm">For students, labs and universities</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="font-extrabold text-[44px] text-slate-900 leading-none tracking-[-0.03em]">
                $0
              </span>
              <span className="text-slate-500">totally free</span>
            </p>
            <CtaLink href={links.signUp} className="mt-8" fullWidth>
              {ctaLabels.primary} <ArrowRight aria-hidden />
            </CtaLink>
            <p className="mt-3 text-center text-slate-500 text-sm">No credit card required.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">What you get</p>
            <CheckList
              items={included}
              className="mt-5 grid gap-x-8 gap-y-3 space-y-0 sm:grid-cols-2"
            />
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
