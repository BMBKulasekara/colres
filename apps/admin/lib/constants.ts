import type { Doc } from '@repo/convex/_generated/dataModel';

type Template = Doc<'templates'>;

export const TEMPLATE_CATEGORIES: { value: Template['category']; label: string }[] = [
  { value: 'journal-articles', label: 'Journal articles' },
  { value: 'theses', label: 'Theses' },
  { value: 'cvs', label: 'CVs' },
  { value: 'presentations', label: 'Presentations' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'bibliographies', label: 'Bibliographies' },
  { value: 'books', label: 'Books' },
  { value: 'posters', label: 'Posters' },
  { value: 'formal-letters', label: 'Formal letters' },
  { value: 'newsletters', label: 'Newsletters' },
  { value: 'calendars', label: 'Calendars' },
];

export const ENGINES: Template['engine'][] = ['pdflatex', 'xelatex', 'lualatex'];
export const BIB_TOOLS: Template['bibTool'][] = ['biber', 'bibtex', 'none'];
export const CITATION_STYLES: Template['citationStyle'][] = [
  'ieee',
  'apa',
  'harvard',
  'mla',
  'acm',
  'vancouver',
  'chicago',
  'numeric',
];
export const FIELD_TYPES: Template['fields'][number]['type'][] = [
  'text',
  'textarea',
  'authors',
  'keywords',
  'date',
];

export function categoryLabel(value: string): string {
  return TEMPLATE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Page size for server-paginated tables. */
export const PAGE_SIZE = 25;

/** The web app, for "Open in app" links. */
export const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL ?? 'http://localhost:3000';
