import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { links } from '../../_lib/site';
import { Eyebrow } from '../ui/eyebrow';
import { Section } from '../ui/section';
import { FaqAccordion, type FaqItem } from './faq-accordion';

const faqs: FaqItem[] = [
  {
    question: 'Do I need to know LaTeX?',
    answer:
      "No. You write in a normal editor; the template handles columns, numbering and references. Export to PDF when you're ready to submit.",
  },
  {
    question: 'Is Colres really free?',
    answer:
      'Yes. Colres is totally free for everyone: every template, citation style and collaboration feature, with no trial period and no credit card.',
  },
  {
    question: 'Which citation styles are supported?',
    answer:
      'IEEE, APA 7, ACM, Vancouver, Chicago and generic numeric. Each template picks the right one, and in-text markers and the reference list update automatically as you cite.',
  },
  {
    question: 'Is my unpublished research private?',
    answer:
      'Yes. Documents belong to your organization and are visible only to its members. The research assistant looks up open scholarly metadata; it never publishes your draft.',
  },
  {
    question: 'How do I export my paper?',
    answer:
      'Switch to paged view to see the exact printed layout, then print or save as PDF. What you see on screen is what the reviewer gets.',
  },
  {
    question: 'Can I write with co-authors from other universities?',
    answer:
      "Yes. Add them to your organization and everyone can edit live, comment on specific sentences, and talk it through in the team chat, wherever they're based.",
  },
];

export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-heading">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <h2
            id="faq-heading"
            className="mt-3 font-bold text-[32px] text-slate-900 leading-9 tracking-[-0.03em] md:text-[44px] md:leading-12"
          >
            Questions, answered
          </h2>
          <p className="mt-5 text-lg text-text-body">
            Can&apos;t find what you need?{' '}
            <Link
              href={links.docs}
              className="inline-flex items-center gap-1 rounded-sm font-medium text-indigo-600 outline-none hover:text-indigo-700 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50"
            >
              Read the docs <ArrowRight aria-hidden className="size-4" />
            </Link>
          </p>
        </div>

        <FaqAccordion items={faqs} />
      </div>
    </Section>
  );
}
