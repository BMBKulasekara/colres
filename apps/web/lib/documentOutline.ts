/**
 * The document outline: its sections, how long each one is, and how that
 * compares with the word budget the template set for it.
 *
 * Pure functions over a flat list of blocks, so the editor can feed them from
 * ProseMirror and the tests from plain arrays.
 */

/** Deepest heading level the outline lists. */
export const OUTLINE_MAX_LEVEL = 3;

export type OutlineBlock =
  | { kind: 'heading'; level: number; text: string; pos: number }
  | { kind: 'text'; words: number }
  /**
   * A run-in section label at the start of a paragraph, such as IEEE's
   * "Abstract—": a section as far as the outline is concerned, though not a
   * heading in the document.
   */
  | { kind: 'runIn'; title: string; words: number; pos: number };

export interface TemplateSection {
  key: string;
  title: string;
  required: boolean;
  targetWords?: number;
  maxWords?: number;
  guidance?: string;
}

/** How a section stands against its budget, which decides its colour. */
export type BudgetTone = 'none' | 'progress' | 'met' | 'over';

export interface OutlineSection {
  /** The heading's position in the document, which is also its identity. */
  pos: number;
  title: string;
  /** 0 for the outline's top level. */
  depth: number;
  words: number;
  template?: TemplateSection;
  tone: BudgetTone;
}

export interface Outline {
  sections: OutlineSection[];
  totalWords: number;
  /** The sum of the template's targets, when it sets any. */
  totalTarget: number;
  /** Required template sections with no heading in the document. */
  missing: TemplateSection[];
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * A heading's title reduced to what identifies it: case, numbering and
 * punctuation removed, so "III. Methodology" matches a section called
 * "methodology".
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\s*(?:\d+(?:\.\d+)*[.)]?|(?:[ivxlcdm]+|[a-z])[.)])\s+/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Close synonyms templates and authors use for the same section. */
const TITLE_ALIASES: Record<string, string> = {
  methods: 'method',
  methodology: 'method',
  'materials and methods': 'method',
  conclusions: 'conclusion',
  acknowledgments: 'acknowledgment',
  acknowledgements: 'acknowledgment',
  acknowledgement: 'acknowledgment',
  bibliography: 'references',
  'works cited': 'references',
  'related works': 'related work',
  'literature review': 'related work',
};

function canonicalTitle(title: string): string {
  const normalized = normalizeTitle(title);
  return TITLE_ALIASES[normalized] ?? normalized;
}

export function budgetTone(words: number, section: TemplateSection | undefined): BudgetTone {
  if (!section) return 'none';
  const limit = section.maxWords ?? section.targetWords;
  if (limit !== undefined && words > limit) return 'over';
  if (section.targetWords !== undefined && section.targetWords > 0) {
    return words >= section.targetWords * 0.9 ? 'met' : 'progress';
  }
  return 'none';
}

/**
 * Builds the outline.
 *
 * A section's words are everything after its heading up to the next heading
 * at the same level or above, so a section's count includes its subsections.
 * A document with a single level-1 heading followed by lower ones is using
 * that heading as its title, as the IEEE and article templates do; it is left
 * out of the outline rather than shown as one section containing everything.
 */
export function buildOutline(
  blocks: readonly OutlineBlock[],
  templateSections: readonly TemplateSection[] = []
): Outline {
  const headings = blocks.filter(
    (block): block is Extract<OutlineBlock, { kind: 'heading' }> =>
      block.kind === 'heading' && block.level <= OUTLINE_MAX_LEVEL
  );
  const levelOnes = headings.filter((heading) => heading.level === 1);
  const titleHeading =
    levelOnes.length === 1 && headings[0] === levelOnes[0] && headings.length > 1
      ? levelOnes[0]
      : undefined;

  const listed = headings.filter((heading) => heading !== titleHeading);
  const topLevel = listed.reduce(
    (min, heading) => Math.min(min, heading.level),
    Number.POSITIVE_INFINITY
  );

  const byTitle = new Map<string, TemplateSection>();
  for (const section of templateSections) {
    const key = canonicalTitle(section.title);
    if (!byTitle.has(key)) byTitle.set(key, section);
  }
  const matched = new Set<string>();

  type Open = { section: OutlineSection; level: number };
  const sections: OutlineSection[] = [];
  let open: Open[] = [];
  let totalWords = 0;

  const addWords = (words: number) => {
    totalWords += words;
    for (const entry of open) entry.section.words += words;
  };

  const startSection = (title: string, level: number, pos: number) => {
    open = open.filter((entry) => entry.level < level);
    const template = byTitle.get(canonicalTitle(title));
    if (template) matched.add(template.key);
    const section: OutlineSection = {
      pos,
      title,
      depth: Math.max(0, level - (Number.isFinite(topLevel) ? topLevel : level)),
      words: 0,
      template,
      tone: 'none',
    };
    sections.push(section);
    open.push({ section, level });
  };

  for (const block of blocks) {
    if (block.kind === 'text') {
      addWords(block.words);
    } else if (block.kind === 'runIn') {
      // A run-in section sits at the top level and ends at the next heading.
      startSection(block.title, Number.isFinite(topLevel) ? topLevel : 1, block.pos);
      addWords(block.words);
    } else if (block.level > OUTLINE_MAX_LEVEL || block === titleHeading) {
      addWords(countWords(block.text));
    } else {
      startSection(block.text || 'Untitled section', block.level, block.pos);
    }
  }

  for (const section of sections) {
    section.tone = budgetTone(section.words, section.template);
  }

  const totalTarget = templateSections.reduce(
    (sum, section) => sum + (section.targetWords ?? 0),
    0
  );
  const missing = templateSections.filter(
    (section) => section.required && !matched.has(section.key) && !isImplicitSection(section)
  );

  return { sections, totalWords, totalTarget, missing };
}

/**
 * Sections a template lists that are never a heading in the text: the title
 * page and the MLA heading block are layout, and the introduction of an APA
 * paper is headed by the paper's title rather than the word "Introduction".
 */
function isImplicitSection(section: TemplateSection): boolean {
  const title = canonicalTitle(section.title);
  return title === 'title page' || title === 'heading and title' || title === 'introduction';
}

/** The run-in label at the start of a paragraph, if it has one. */
export function runInSectionTitle(text: string): { title: string; rest: string } | null {
  const match = /^\s*(Abstract|Index Terms|Keywords)\s*[—–:-]\s*/i.exec(text);
  if (!match) return null;
  const label = match[1] ?? '';
  return {
    title: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(),
    rest: text.slice(match[0].length),
  };
}

/** The section containing a document position: the last one starting at or before it. */
export function sectionAt(sections: readonly OutlineSection[], pos: number): OutlineSection | null {
  let found: OutlineSection | null = null;
  for (const section of sections) {
    if (section.pos <= pos) found = section;
    else break;
  }
  return found;
}

/**
 * The template's sections with the author's own targets laid over them: a
 * target for a section the template names replaces its target (and lifts any
 * limit below it); one for a section it does not name is added as optional.
 */
export function mergeSectionTargets(
  templateSections: readonly TemplateSection[] = [],
  targets: readonly { title: string; words: number }[] = []
): TemplateSection[] {
  const merged = templateSections.map((section) => ({ ...section }));
  for (const target of targets) {
    const key = canonicalTitle(target.title);
    const existing = merged.find((section) => canonicalTitle(section.title) === key);
    if (existing) {
      existing.targetWords = target.words;
      if (existing.maxWords !== undefined && existing.maxWords < target.words) {
        existing.maxWords = undefined;
      }
    } else {
      merged.push({
        key: `goal:${key}`,
        title: target.title,
        required: false,
        targetWords: target.words,
      });
    }
  }
  return merged;
}
