import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageShell } from '../_components/layout/page-shell';
import { Container } from '../_components/ui/container';
import { Eyebrow } from '../_components/ui/eyebrow';
import { contact, legal } from '../_lib/company';
import { links, siteConfig } from '../_lib/site';

export const metadata: Metadata = {
  title: `Terms & Conditions · ${siteConfig.name}`,
  description: `The terms that apply when you use ${siteConfig.name}.`,
};

const name = siteConfig.name;

/*
 * Each clause states what the product actually does today: the services it
 * relies on, the upload limits in `convex/lib/chatAttachments.ts`, and the
 * 30-day purge in `convex/lib/trashPolicy.ts`. Keep them in step if those
 * change.
 */
const sections: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'acceptance',
    title: 'Acceptance of these terms',
    body: (
      <>
        <p>
          These terms are an agreement between you and {legal.operator} (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;) covering your use of {name}: the website, the web application and any
          related services. By creating an account or using {name}, you agree to them. If you do not
          agree, please do not use {name}.
        </p>
        <p>
          If you use {name} on behalf of a university, lab or company, you confirm you are allowed
          to accept these terms for it.
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <>
        <p>
          You need an account to write in {name}. Sign-in is provided by Clerk, our authentication
          provider. You must be at least {legal.minimumAge} years old, or the minimum age required
          in your country to agree to these terms, whichever is higher.
        </p>
        <p>
          Keep your sign-in details secure. You are responsible for activity under your account and
          should tell us promptly at <MailLink /> if you believe it has been used without your
          permission.
        </p>
      </>
    ),
  },
  {
    id: 'free',
    title: `${name} is free`,
    body: (
      <p>
        {name} is currently free to use, with no trial period and no payment details required. We
        may add, change or remove features over time. If we ever introduce paid features, we will
        tell you in advance and nothing you already rely on will be charged for without your
        agreement.
      </p>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <>
        <p>
          You own what you write and upload, including documents, references, comments, chat
          messages, files and voice notes (&ldquo;your content&rdquo;). We claim no ownership of it.
        </p>
        <p>
          To run the service you give us a limited licence to store, copy, process and display your
          content, only as needed to provide {name} to you and to the people you share it with. This
          licence ends when your content is permanently deleted, except for copies held briefly in
          backups.
        </p>
        <p>
          You are responsible for having the rights to everything you upload, and for properly
          citing the work of others in your writing.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to use {name} to:</p>
        <ul>
          <li>break the law or infringe anyone&apos;s copyright, privacy or other rights;</li>
          <li>upload malware, or anything designed to harm the service or other users;</li>
          <li>harass, threaten or abuse other people, including in comments and chat;</li>
          <li>commit academic misconduct, such as plagiarism or fabricating data or citations;</li>
          <li>
            access accounts, documents or organizations you have not been given access to, or probe
            or overload our systems;
          </li>
          <li>resell or redistribute the service without our written permission.</li>
        </ul>
        <p>We may remove content or suspend accounts that break these rules.</p>
      </>
    ),
  },
  {
    id: 'organizations',
    title: 'Organizations and collaborators',
    body: (
      <>
        <p>
          Documents can belong to an organization. Every member of that organization can see and
          edit its documents, comments and team chat. Only invite people you trust with your work,
          and remove members who should no longer have access.
        </p>
        <p>
          Organization administrators can manage members and, in limited cases such as when an
          author has left, permanently delete the organization&apos;s documents. {name}&apos;s
          platform administrators can view and manage accounts, organizations and documents to
          operate the service, investigate abuse and respond to support requests.
        </p>
      </>
    ),
  },
  {
    id: 'ai',
    title: 'AI and research features',
    body: (
      <>
        <p>
          The research assistant suggests related papers. To do this, it sends your document&apos;s
          title and description to Google&apos;s Gemini AI service, and looks up publication details
          from the OpenAlex and Crossref scholarly databases. The body of your document is not sent
          for these suggestions.
        </p>
        <p>
          Suggestions are generated automatically and may be incomplete or wrong. Check every source
          yourself before you cite it.
        </p>
      </>
    ),
  },
  {
    id: 'files',
    title: 'Files and attachments',
    body: (
      <p>
        You can attach files, images and voice notes in team chat. Each file may be up to 25 MB, a
        message may carry up to 5 attachments, and a voice note may be up to 5 minutes long. We may
        change these limits as the service evolves.
      </p>
    ),
  },
  {
    id: 'deletion',
    title: 'Deleting content',
    body: (
      <p>
        When you delete a document it moves to the recycle bin, where it can be restored for 30
        days. After 30 days the document is permanently erased along with its comments and chat
        messages, and it cannot be recovered. Keep your own copies of anything important.
      </p>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third-party services',
    body: (
      <>
        <p>
          {name} relies on trusted providers to operate, each of which processes data only as needed
          to provide its part of the service:
        </p>
        <ul>
          <li>
            <strong>Clerk</strong>: sign-in and account management
          </li>
          <li>
            <strong>Convex</strong>: database and file storage
          </li>
          <li>
            <strong>Liveblocks</strong>: real-time presence and collaboration
          </li>
          <li>
            <strong>Google Gemini</strong>: AI paper suggestions
          </li>
          <li>
            <strong>OpenAlex</strong> and <strong>Crossref</strong>: scholarly metadata
          </li>
        </ul>
        <p>Their own terms and privacy policies also apply to the data they handle.</p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        We work to keep {name} running and your work safe, but the service is provided &ldquo;as
        is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind. We do not
        guarantee that it will be uninterrupted, error-free, or that content will never be lost. We
        may change, suspend or discontinue any part of the service, and will try to give notice of
        significant changes.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <p>
        To the fullest extent the law allows, {legal.operator} is not liable for any indirect,
        incidental or consequential loss, or for loss of data, research, grades, publications or
        opportunities arising from your use of {name}. Because the service is free, our total
        liability to you for any claim is limited to the amount you have paid us, which is zero.
        Nothing in these terms limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Ending your account',
    body: (
      <p>
        You can stop using {name} at any time and ask us to delete your account at <MailLink />. We
        may suspend or close accounts that break these terms or put the service or other users at
        risk. Sections that by their nature should continue, such as ownership of content and
        limitation of liability, survive the end of your account.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these terms as {name} changes. The date at the top of this page shows when
        they last changed. For significant changes we will give notice in the app or by email.
        Continuing to use {name} after a change means you accept the updated terms.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: legal.governingLaw ? (
      <p>
        These terms are governed by the laws of {legal.governingLaw}, and any dispute will be
        handled by its courts, unless the law of your country requires otherwise.
      </p>
    ) : (
      <p>
        These terms are governed by the laws of the country where {legal.operator} is based, unless
        the law of your country requires otherwise. We would always rather resolve a concern
        directly, so please contact us first.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these terms? Email <MailLink /> or see the{' '}
        <Link href={`${links.about}#contact`}>contact options on our About page</Link>.
      </p>
    ),
  },
];

function MailLink() {
  return <a href={`mailto:${contact.email}`}>{contact.email}</a>;
}

export default function TermsPage() {
  return (
    <PageShell>
      <section
        aria-labelledby="terms-heading"
        className="bg-slate-50 pt-16 pb-12 md:pt-24 md:pb-16"
      >
        <Container>
          <Eyebrow>Legal</Eyebrow>
          <h1
            id="terms-heading"
            className="mt-3 font-extrabold text-[40px] text-slate-900 leading-11 tracking-[-0.03em] md:text-[56px] md:leading-16"
          >
            Terms &amp; Conditions
          </h1>
          <p className="mt-4 text-slate-500">Last updated {legal.lastUpdated}</p>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-text-body leading-7">
            The short version: your writing is yours, {name} is free, use it fairly, and keep your
            own copies of important work. The details are below in plain language.
          </p>
        </Container>
      </section>

      <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-[240px_1fr] lg:gap-16">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-semibold text-slate-500 text-sm uppercase tracking-[0.08em]">
            On this page
          </h2>
          <ol className="mt-4 space-y-2 text-[15px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="rounded-sm text-slate-600 outline-none hover:text-indigo-600 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50"
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="max-w-3xl space-y-12">
          {sections.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-heading`}
              className="scroll-mt-24"
            >
              <h2
                id={`${s.id}-heading`}
                className="font-bold text-2xl text-slate-900 tracking-[-0.02em]"
              >
                {i + 1}. {s.title}
              </h2>
              <div className="mt-4 space-y-4 text-[17px] text-text-body leading-7 [&_a]:font-medium [&_a]:text-indigo-600 [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </PageShell>
  );
}
