import { cn } from '@repo/ui/lib/utils';
import {
  ArrowRight,
  Bug,
  Building2,
  Code,
  ExternalLink,
  Gift,
  Globe,
  LayoutTemplate,
  Lock,
  type LucideIcon,
  Mail,
  MapPin,
  PenLine,
  Phone,
  Printer,
  Quote,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '../_components/layout/page-shell';
import { Chip } from '../_components/ui/chip';
import { Container } from '../_components/ui/container';
import { CtaLink } from '../_components/ui/cta-button';
import { Eyebrow } from '../_components/ui/eyebrow';
import { Section, SectionHeading } from '../_components/ui/section';
import { contact, type Developer, developers } from '../_lib/company';
import { ctaLabels, links, siteConfig } from '../_lib/site';

export const metadata: Metadata = {
  title: `About · ${siteConfig.name}`,
  description:
    'Who builds Colres, what it covers, and how to get in touch. A free, real-time editor for academic writing.',
};

const values: { icon: LucideIcon; tone: string; title: string; body: string }[] = [
  {
    icon: Gift,
    tone: 'bg-teal-50 text-teal-600',
    title: 'Free for everyone',
    body: 'Every template, citation style and collaboration feature, with no trial and no credit card. Research tools should not depend on a grant budget.',
  },
  {
    icon: Lock,
    tone: 'bg-indigo-50 text-indigo-600',
    title: 'Your draft stays yours',
    body: 'Documents belong to your organization and are visible only to its members. Unpublished work is never published or shared.',
  },
  {
    icon: Printer,
    tone: 'bg-amber-100 text-amber-800',
    title: 'What you see is what prints',
    body: 'Paged view shows the exact layout a reviewer will get, so formatting is finished when the writing is.',
  },
  {
    icon: Users,
    tone: 'bg-slate-100 text-slate-700',
    title: 'Writing is a team sport',
    body: 'Co-authors, supervisors and lab mates edit, comment and talk in one place, wherever they are based.',
  },
];

const scope: { icon: LucideIcon; title: string; items: string[] }[] = [
  {
    icon: PenLine,
    title: 'Writing',
    items: [
      'Real-time rich-text editor',
      'Paged print view with headers and numbering',
      'Figures, tables and cross-references',
      'Export to PDF and HTML',
    ],
  },
  {
    icon: LayoutTemplate,
    title: 'Templates',
    items: [
      'Journal and conference papers (IEEE, ACM, APA 7)',
      'Theses, CVs and presentations',
      'Each template carries its venue’s formatting rules',
    ],
  },
  {
    icon: Quote,
    title: 'Citations & references',
    items: [
      'IEEE, APA, ACM, Vancouver, Chicago, Harvard, MLA and numeric',
      'In-text markers and reference lists update as you cite',
      'Add references by DOI or search',
    ],
  },
  {
    icon: Sparkles,
    title: 'Research assistant',
    items: [
      'AI-suggested papers based on your title and abstract',
      'Scholarly metadata from OpenAlex and Crossref',
      'Save or dismiss each suggestion',
    ],
  },
  {
    icon: Users,
    title: 'Collaboration',
    items: [
      'Live co-editing with presence',
      'Comments on specific passages',
      'Team chat with replies, mentions, files and voice notes',
    ],
  },
  {
    icon: Building2,
    title: 'Organizations',
    items: [
      'Shared workspaces for labs, classes and teams',
      'Contribution stats per member',
      'Recycle bin with 30-day recovery',
    ],
  },
];

const comingNext = [
  'LaTeX export',
  'Version history',
  'Sharing roles',
  'AI writing assistant',
  'Notifications',
];

const stack = [
  'Next.js',
  'React',
  'TipTap',
  'Convex',
  'Clerk',
  'Liveblocks',
  'Google Gemini',
  'OpenAlex',
  'Crossref',
];

export default function AboutPage() {
  return (
    <PageShell>
      {/* Hero */}
      <section aria-labelledby="about-heading" className="bg-white pt-16 pb-12 md:pt-24 md:pb-16">
        <Container>
          <div className="max-w-3xl">
            <Eyebrow>About {siteConfig.name}</Eyebrow>
            <h1
              id="about-heading"
              className="mt-3 text-balance font-extrabold text-[40px] text-slate-900 leading-11 tracking-[-0.03em] md:text-[56px] md:leading-16"
            >
              Research writing, without the formatting fight.
            </h1>
            <p className="mt-6 text-pretty text-lg text-text-body leading-7 md:text-xl md:leading-8">
              {siteConfig.name} is a free, real-time editor for academic writing. It brings the
              template, the citations, the co-authors and the conversation into one place, so the
              time you spend goes into the research rather than the tooling around it.
            </p>
          </div>
        </Container>
      </section>

      {/* Story */}
      <Section labelledBy="story-heading" background="muted">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow>Our story</Eyebrow>
            <h2
              id="story-heading"
              className="mt-3 text-balance font-bold text-[32px] text-slate-900 leading-9 tracking-[-0.03em] md:text-[44px] md:leading-12"
            >
              Built for the people who write papers.
            </h2>
          </div>
          <div className="space-y-5 text-pretty text-lg text-text-body leading-7">
            <p>
              A typical paper lives in five tools: a draft in a word processor, references in a
              manager, formatting in LaTeX, feedback over email and discussion in a group chat.
              Every hand-off between them costs time and adds a mistake.
            </p>
            <p>
              {siteConfig.name} started as a way to remove those hand-offs. Students, researchers,
              supervisors and research groups write against the venue&apos;s template from the first
              word, cite as they type, and talk it through next to the draft.
            </p>
          </div>
        </div>

        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <li
              key={v.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
            >
              <span
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl [&_svg]:size-5.5',
                  v.tone
                )}
              >
                <v.icon aria-hidden strokeWidth={1.75} />
              </span>
              <h3 className="mt-5 font-semibold text-lg text-slate-900">{v.title}</h3>
              <p className="mt-2 text-[15px] text-text-body leading-6">{v.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Scope */}
      <Section labelledBy="scope-heading">
        <SectionHeading
          id="scope-heading"
          eyebrow="Scope"
          title="What Colres covers"
          lead="Everything between a blank page and a submission-ready PDF."
        />

        <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {scope.map((area) => (
            <li key={area.title} className="rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 [&_svg]:size-5">
                  <area.icon aria-hidden strokeWidth={1.75} />
                </span>
                <h3 className="font-semibold text-lg text-slate-900">{area.title}</h3>
              </div>
              <ul className="mt-4 space-y-2 text-[15px] text-text-body leading-6">
                {area.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-2.5 size-1.5 shrink-0 rounded-full bg-indigo-400"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-3 rounded-2xl bg-slate-50 p-6 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <Rocket aria-hidden className="size-5 text-indigo-600" />
            Coming next
          </span>
          <ul className="flex flex-wrap gap-2">
            {comingNext.map((item) => (
              <li key={item}>
                <Chip tone="neutral">{item}</Chip>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Team */}
      <Section labelledBy="team-heading" background="muted">
        <SectionHeading
          id="team-heading"
          eyebrow="The team"
          title="Who builds Colres"
          lead="Colres is independently designed, built and maintained."
        />
        <ul className="mx-auto mt-14 grid max-w-4xl justify-center gap-6 sm:grid-cols-[repeat(auto-fit,minmax(280px,360px))]">
          {developers.map((dev) => (
            <DeveloperCard key={dev.name} developer={dev} />
          ))}
        </ul>

        <div className="mt-14 text-center">
          <h3 className="font-semibold text-slate-500 text-sm uppercase tracking-[0.08em]">
            Built with
          </h3>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {stack.map((tool) => (
              <li key={tool}>
                <Chip tone="indigo">{tool}</Chip>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Contact */}
      <Section id="contact" labelledBy="contact-heading">
        <SectionHeading
          id="contact-heading"
          eyebrow="Contact"
          title="Get in touch"
          lead="Questions, feedback, a bug, or an idea for a template? We read every message."
        />
        <ul className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
          <ContactItem
            icon={Mail}
            label="Email"
            value={contact.email}
            href={`mailto:${contact.email}`}
          />
          <ContactItem
            icon={Bug}
            label="Report a problem"
            value="Open a GitHub issue"
            href={contact.issues}
            external
          />
          <ContactItem
            icon={Code}
            label="Source code"
            value="github.com/BMBKulasekara/colres"
            href={contact.github}
            external
          />
          {contact.phone && (
            <ContactItem
              icon={Phone}
              label="Phone"
              value={contact.phone}
              href={`tel:${contact.phone.replace(/\s/g, '')}`}
            />
          )}
          {contact.location && (
            <ContactItem icon={MapPin} label="Location" value={contact.location} />
          )}
        </ul>
      </Section>

      <section aria-labelledby="about-cta-heading" className="bg-white pb-18 md:pb-24 xl:pb-32">
        <Container>
          <div className="flex flex-col gap-8 rounded-3xl bg-linear-110 from-indigo-600 via-indigo-700 to-teal-600 px-6 py-12 md:px-16 md:py-16 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2
                id="about-cta-heading"
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
              <CtaLink href={`/${links.templates}`} tone="on-dark-ghost" size="lg">
                {ctaLabels.secondary}
              </CtaLink>
            </div>
          </div>
        </Container>
      </section>
    </PageShell>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function DeveloperCard({ developer: dev }: { developer: Developer }) {
  const profileLinks = [
    { label: 'GitHub', href: dev.github, icon: Code },
    { label: 'LinkedIn', href: dev.linkedin, icon: ExternalLink },
    { label: 'Website', href: dev.website, icon: Globe },
  ].filter((l): l is { label: string; href: string; icon: LucideIcon } => !!l.href);

  return (
    <li className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
      {dev.photo ? (
        // biome-ignore lint/performance/noImgElement: a single small avatar; next/image adds nothing here.
        <img src={dev.photo} alt="" className="size-24 rounded-full object-cover" />
      ) : (
        <span
          aria-hidden
          className="bg-brand-gradient flex size-24 items-center justify-center rounded-full font-bold text-3xl text-white"
        >
          {initials(dev.name)}
        </span>
      )}
      <h3 className="mt-5 font-semibold text-slate-900 text-xl">{dev.name}</h3>
      <p className="mt-1 font-medium text-indigo-600 text-sm">{dev.role}</p>
      <p className="mt-4 text-[15px] text-text-body leading-6">{dev.bio}</p>
      {profileLinks.length > 0 && (
        <ul className="mt-6 flex gap-2">
          {profileLinks.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 text-sm outline-none hover:bg-slate-50 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50"
              >
                <l.icon aria-hidden className="size-4" />
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 [&_svg]:size-5">
        <Icon aria-hidden strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-slate-500 text-sm">{label}</span>
        <span className="flex items-center gap-1 break-all font-medium text-slate-900">
          {value}
          {href && <ArrowRight aria-hidden className="size-4 shrink-0 text-slate-400" />}
        </span>
      </span>
    </>
  );
  const className =
    'flex items-center gap-4 rounded-2xl border border-slate-200 p-5 outline-none transition-colors';

  return (
    <li>
      {href ? (
        <Link
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          className={cn(
            className,
            'hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50'
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}
