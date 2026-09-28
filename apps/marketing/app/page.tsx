import { SiteFooter } from './_components/layout/site-footer';
import { SiteNav } from './_components/layout/site-nav';
import { DeepDives } from './_components/sections/deep-dives';
import { Faq } from './_components/sections/faq';
import { FeatureBento } from './_components/sections/feature-bento';
import { FinalCta } from './_components/sections/final-cta';
import { FreePlan } from './_components/sections/free-plan';
import { Hero } from './_components/sections/hero';
import { HowItWorks } from './_components/sections/how-it-works';
import { Pillars } from './_components/sections/pillars';
import { StatsBand } from './_components/sections/stats-band';
import { TemplateGallery } from './_components/sections/template-gallery';
import { Testimonials } from './_components/sections/testimonials';
import { TrustStrip } from './_components/sections/trust-strip';

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-medium focus:text-indigo-700 focus:shadow-float"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <TrustStrip />
        <Pillars />
        <FeatureBento />
        <DeepDives />
        <HowItWorks />
        <StatsBand />
        <TemplateGallery />
        <Testimonials />
        <FreePlan />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
