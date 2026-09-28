import { ArrowRight, Check, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';
import { ctaLabels, links } from '../../_lib/site';
import { ProductShot } from '../mockups/product-shot';
import { Container } from '../ui/container';
import { CtaLink } from '../ui/cta-button';

const reassurances = ['Totally free', 'No credit card', 'Export-ready PDF'];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      // Pull the hero up behind the transparent sticky nav so the wash starts at the top.
      className="-mt-18 bg-linear-to-b from-indigo-50 to-white pt-18"
    >
      <Container className="pt-12 pb-18 text-center md:pt-16 md:pb-24">
        <Link
          href={links.templates}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-200 bg-white/70 py-1 pr-3 pl-1 text-indigo-700 text-sm outline-none transition-colors hover:border-indigo-400 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50"
        >
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 font-semibold text-white text-xs">
            New
          </span>
          <span className="truncate">APA 7th edition templates are here</span>
          <ArrowRight aria-hidden className="size-3.5 shrink-0" />
        </Link>

        <h1
          id="hero-heading"
          className="mx-auto mt-8 max-w-275 text-balance font-extrabold text-[40px] text-slate-900 leading-11 tracking-[-0.035em] md:text-[56px] md:leading-15 xl:text-[64px] xl:leading-[66px]"
        >
          Write research papers <span className="text-gradient">together</span>, formatted from the
          first word.
        </h1>

        <p className="mx-auto mt-6 max-w-180 text-pretty text-lg text-text-body leading-7 md:text-xl md:leading-8">
          Colres is the real-time editor for academic writing. Start from IEEE, APA or ACM
          templates, cite as you type, and see every page exactly as it will print.
        </p>

        <div className="mx-auto mt-10 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <CtaLink href={links.signUp} size="lg">
            {ctaLabels.primary} <ArrowRight aria-hidden />
          </CtaLink>
          <CtaLink href={links.templates} tone="secondary" size="lg">
            <LayoutTemplate aria-hidden /> {ctaLabels.secondary}
          </CtaLink>
        </div>

        <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-slate-500 text-sm">
          {reassurances.map((r) => (
            <li key={r} className="flex items-center gap-1.5">
              <Check aria-hidden className="size-3.5" /> {r}
            </li>
          ))}
        </ul>

        <div className="mt-14 md:mt-16">
          <ProductShot />
        </div>
      </Container>
    </section>
  );
}
