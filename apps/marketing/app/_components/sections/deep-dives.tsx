import { ShieldCheck, Sparkles } from 'lucide-react';
import { links } from '../../_lib/site';
import { CitationPickerMock } from '../mockups/citation-picker-mock';
import { ResearchSuggestionsMock } from '../mockups/research-suggestions-mock';
import { TeamChatMock } from '../mockups/team-chat-mock';
import { TemplatePickerMock } from '../mockups/template-picker-mock';
import { Chip } from '../ui/chip';
import { DeepDive } from './deep-dive';

/** The four feature deep-dives (S5A–S5D), alternating side and background. */
export function DeepDives() {
  return (
    <>
      <DeepDive
        id="deep-dive-templates"
        background="muted"
        chip={<Chip tone="indigo">Templates</Chip>}
        title="Start from the format, not a blank page."
        body="Pick IEEE, APA 7, ACM, Springer LNCS, Elsevier or a thesis. Title block, section order, numbering and page geometry come with it, and guidance notes tell you what each section needs."
        checks={[
          'Roman section numbering and two-column layout for IEEE',
          'APA title page, running head and five heading levels',
          'Word-count targets per section',
        ]}
        link={{ label: 'Explore templates', href: links.templates }}
        visual={<TemplatePickerMock />}
      />

      <DeepDive
        id="deep-dive-citations"
        reverse
        chip={<Chip tone="teal">Citations</Chip>}
        title="Cite in two keystrokes. The bibliography writes itself."
        body="Search your library, or add a source by DOI. Colres numbers citations by first appearance, merges ranges like [1]–[3], and keeps the reference list in the exact style your template asks for."
        stats={[
          { value: '0', label: 'manual renumbering', tone: 'teal' },
          { value: '6', label: 'citation styles', tone: 'indigo' },
        ]}
        visual={<CitationPickerMock />}
      />

      <DeepDive
        id="deep-dive-collaboration"
        background="muted"
        chip={<Chip tone="amber">Collaboration</Chip>}
        title="Your co-authors, your supervisor, and the draft. Same room."
        body="See who's writing where. Comment on a sentence, not a page. Discuss it in team chat with PDFs, spreadsheets and voice notes, without leaving the document."
        checks={[
          'Live cursors and presence',
          'Threaded comments with @mentions',
          'Chat with files, images and voice messages',
        ]}
        visual={<TeamChatMock />}
      />

      {/* Tone rule: AI finds sources, it never writes prose. Keep the privacy note beside it. */}
      <DeepDive
        id="deep-dive-research"
        reverse
        chip={
          <Chip tone="dark" icon={<Sparkles />}>
            Research assistant
          </Chip>
        }
        title="Find the paper your reviewer will ask about."
        body="Colres reads the section you're writing and suggests related work from millions of scholarly records, ranked by relevance and citation count. One click adds it as a formatted reference."
        footnote={
          <p className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[15px] text-slate-600 leading-6">
            <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-slate-500" />
            Suggestions come from open scholarly metadata. Colres never writes your prose for you,
            and your draft stays private to your team.
          </p>
        }
        visual={<ResearchSuggestionsMock />}
      />
    </>
  );
}
