import type { Doc } from '@repo/convex/_generated/dataModel';

type Template = Doc<'templates'>;

/**
 * `_rowId` is a client-only identity for list rows. Indices can't be keys
 * because rows are reordered and deleted, and the user-facing `key` field is
 * editable (and briefly duplicated while typing). Stripped before saving.
 */
export type RowId = { _rowId: string };

export type Section = Template['sections'][number] & RowId;
export type Field = Template['fields'][number] & RowId;
export type ClassOption = Template['classOptions'][number] & RowId;

export type TemplateForm = Pick<
  Template,
  | 'name'
  | 'slug'
  | 'category'
  | 'description'
  | 'tags'
  | 'official'
  | 'publisher'
  | 'content'
  | 'engine'
  | 'bibTool'
  | 'passes'
  | 'entryFile'
  | 'documentClass'
  | 'requiredPackages'
  | 'latexSkeleton'
  | 'citationStyle'
  | 'license'
  | 'featured'
  | 'order'
  | 'thumbnailId'
> & {
  sections: Section[];
  fields: Field[];
  classOptions: ClassOption[];
};

export type FormKey = keyof TemplateForm;

export const TABS = [
  { id: 'general', label: 'General' },
  { id: 'content', label: 'Content' },
  { id: 'sections', label: 'Sections' },
  { id: 'fields', label: 'Fields' },
  { id: 'latex', label: 'LaTeX' },
  { id: 'license', label: 'Licence' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

/** Which form keys each tab edits; drives per-tab dirty and error markers. */
export const TAB_KEYS: Record<TabId, FormKey[]> = {
  general: [
    'name',
    'slug',
    'category',
    'publisher',
    'description',
    'tags',
    'order',
    'featured',
    'official',
    'thumbnailId',
  ],
  content: ['content'],
  sections: ['sections'],
  fields: ['fields'],
  latex: [
    'documentClass',
    'entryFile',
    'engine',
    'bibTool',
    'citationStyle',
    'passes',
    'requiredPackages',
    'classOptions',
    'latexSkeleton',
  ],
  license: ['license'],
};

export function tabForKey(key: string): TabId {
  const root = key.split('.')[0] as FormKey;
  return (
    (Object.keys(TAB_KEYS) as TabId[]).find((tab) => TAB_KEYS[tab].includes(root)) ?? 'general'
  );
}

export function withRowId<T extends object>(row: T): T & RowId {
  return { ...row, _rowId: crypto.randomUUID() };
}

export function stripRowId<T extends RowId>(row: T): Omit<T, '_rowId'> {
  const copy: Partial<T> = { ...row };
  delete copy._rowId;
  return copy as Omit<T, '_rowId'>;
}

export function toForm(template: Template): TemplateForm {
  return {
    name: template.name,
    slug: template.slug,
    category: template.category,
    description: template.description,
    tags: template.tags,
    official: template.official,
    publisher: template.publisher,
    content: template.content,
    engine: template.engine,
    bibTool: template.bibTool,
    passes: template.passes,
    entryFile: template.entryFile,
    documentClass: template.documentClass,
    requiredPackages: template.requiredPackages,
    latexSkeleton: template.latexSkeleton,
    citationStyle: template.citationStyle,
    license: template.license,
    featured: template.featured,
    order: template.order,
    thumbnailId: template.thumbnailId,
    sections: template.sections.map(withRowId),
    fields: template.fields.map(withRowId),
    classOptions: template.classOptions.map(withRowId),
  };
}

/** The persisted shape of one form value (row ids removed). */
export function toPayloadValue<K extends FormKey>(key: K, value: TemplateForm[K]) {
  if (key === 'sections' || key === 'fields' || key === 'classOptions') {
    return (value as RowId[]).map(stripRowId);
  }
  return value;
}
