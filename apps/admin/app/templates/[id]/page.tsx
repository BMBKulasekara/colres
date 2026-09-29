'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Textarea } from '@repo/ui/components/ui/textarea';
import {
  IconArrowLeft,
  IconInfoCircle,
  IconLoader2,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery } from 'convex/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AppSidebar } from '../../../components/app-sidebar';
import { SiteHeader } from '../../../components/side-header';
import { TemplateContentEditor } from '../../../components/TemplateContentEditor';

/**
 * `_rowId` is a client-only stable identity for list rows. Array indices are
 * not usable as React keys here because rows can be deleted from the middle,
 * and the user-facing `key` field is editable (and briefly duplicated while
 * being typed). It is stripped before saving.
 */
type RowId = { _rowId: string };

type Section = RowId & {
  key: string;
  title: string;
  required: boolean;
  targetWords?: number;
  maxWords?: number;
  guidance?: string;
};

type Field = RowId & {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'authors' | 'keywords' | 'date';
  required: boolean;
  placeholder: string;
  defaultValue?: string;
  help?: string;
  dateStyle?: 'month-day-year' | 'day-month-year';
};

type ClassOption = RowId & { value: string; label: string; isDefault?: boolean; group?: string };

const CATEGORIES = [
  'journal-articles',
  'theses',
  'cvs',
  'presentations',
  'assignments',
  'bibliographies',
  'books',
  'posters',
  'formal-letters',
  'newsletters',
  'calendars',
] as const;

const ENGINES = ['pdflatex', 'xelatex', 'lualatex'] as const;
const BIB_TOOLS = ['biber', 'bibtex', 'none'] as const;
const CITATION_STYLES = [
  'ieee',
  'apa',
  'harvard',
  'mla',
  'acm',
  'vancouver',
  'chicago',
  'numeric',
] as const;
const FIELD_TYPES = ['text', 'textarea', 'authors', 'keywords', 'date'] as const;

/** Attaches a client-side row identity for use as a React key. */
function withRowId<T extends object>(row: T): T & RowId {
  return { ...row, _rowId: crypto.randomUUID() };
}

/** Removes the client-side row identity before the row is persisted. */
function stripRowId<T extends RowId>(row: T): Omit<T, '_rowId'> {
  const { _rowId, ...rest } = row;
  return rest;
}

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const template = useQuery(api.templates.adminGetTemplate, id ? { id: id as never } : 'skip');
  const update = useMutation(api.templates.adminUpdateTemplate);

  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Seed the form once the record arrives. Deliberately guarded on `!form` so
  // a save (which changes the template object) does not clobber edits still in
  // progress.
  useEffect(() => {
    if (template && !form) {
      const { _id, _creationTime, thumbnailUrl, ...rest } = template as any;
      setForm({
        ...rest,
        sections: (rest.sections ?? []).map(withRowId),
        fields: (rest.fields ?? []).map(withRowId),
        classOptions: (rest.classOptions ?? []).map(withRowId),
      });
    }
  }, [template, form]);

  const set = (key: string, value: unknown) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await update({
        id: id as never,
        name: form.name,
        slug: form.slug,
        category: form.category,
        description: form.description,
        tags: form.tags,
        official: form.official,
        publisher: form.publisher || undefined,
        content: form.content,
        sections: form.sections.map(stripRowId),
        fields: form.fields.map(stripRowId),
        engine: form.engine,
        bibTool: form.bibTool,
        passes: form.passes,
        entryFile: form.entryFile,
        documentClass: form.documentClass,
        classOptions: form.classOptions.map(stripRowId),
        requiredPackages: form.requiredPackages,
        latexSkeleton: form.latexSkeleton || undefined,
        citationStyle: form.citationStyle,
        license: form.license,
        status: form.status,
        featured: form.featured,
        order: form.order,
      });
      toast.success('Template saved');
      setDirty(false);
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not save the template');
    } finally {
      setSaving(false);
    }
  };

  if (template === undefined || !form) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-32">
          <IconLoader2 className="animate-spin text-primary w-8 h-8" />
        </div>
      </Shell>
    );
  }

  if (template === null) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <h2 className="text-xl font-bold">Template not found</h2>
          <Button onClick={() => router.push('/templates')}>Back to templates</Button>
        </div>
      </Shell>
    );
  }

  const sections: Section[] = form.sections ?? [];
  const fields: Field[] = form.fields ?? [];
  const classOptions: ClassOption[] = form.classOptions ?? [];

  return (
    <Shell>
      <div className="flex-1 flex flex-col p-6 space-y-5">
        <Toaster richColors position="top-right" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 mb-1 text-muted-foreground cursor-pointer"
              onClick={() => router.push('/templates')}
            >
              <IconArrowLeft size={15} />
              Back to templates
            </Button>
            <h1 className="text-2xl font-bold tracking-tight truncate">{form.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">
              /{form.slug} · version {form.version} · used by {form.usageCount} document
              {form.usageCount === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {dirty && <span className="text-xs font-semibold text-amber-500">Unsaved changes</span>}
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="cursor-pointer font-semibold"
            >
              {saving && <IconLoader2 size={15} className="animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>

        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="structure">Structure</TabsTrigger>
            <TabsTrigger value="fields">Wizard fields</TabsTrigger>
            <TabsTrigger value="format">Format</TabsTrigger>
            <TabsTrigger value="publishing">Publishing</TabsTrigger>
          </TabsList>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="content" className="space-y-4 pt-4">
            <Callout>
              The body seeded into every new document. Use <code>{'{{TOKENS}}'}</code> matching the
              placeholders declared on the Wizard fields tab — <code>{'{{TITLE}}'}</code> is always
              available. Blockquotes read as guidance callouts to authors.
            </Callout>
            <TemplateContentEditor value={form.content} onChange={(html) => set('content', html)} />
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="structure" className="space-y-3 pt-4">
            <Callout>
              Sections drive word-budget tracking and the submission-readiness checklist. Keep the
              titles matching the headings used in the content.
            </Callout>

            {sections.map((section, index) => (
              <div
                key={section._rowId}
                className="rounded-lg border border-border bg-card p-3 grid gap-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-1 flex items-center justify-center text-xs font-mono text-muted-foreground">
                  {index + 1}
                </div>
                <Field2 className="sm:col-span-3" label="Title">
                  <Input
                    value={section.title}
                    onChange={(e) =>
                      set(
                        'sections',
                        sections.map((s, i) => (i === index ? { ...s, title: e.target.value } : s))
                      )
                    }
                  />
                </Field2>
                <Field2 className="sm:col-span-2" label="Key">
                  <Input
                    value={section.key}
                    className="font-mono text-xs"
                    onChange={(e) =>
                      set(
                        'sections',
                        sections.map((s, i) => (i === index ? { ...s, key: e.target.value } : s))
                      )
                    }
                  />
                </Field2>
                <Field2 className="sm:col-span-1" label="Target">
                  <Input
                    type="number"
                    value={section.targetWords ?? ''}
                    onChange={(e) =>
                      set(
                        'sections',
                        sections.map((s, i) =>
                          i === index
                            ? {
                                ...s,
                                targetWords: e.target.value ? Number(e.target.value) : undefined,
                              }
                            : s
                        )
                      )
                    }
                  />
                </Field2>
                <Field2 className="sm:col-span-1" label="Max">
                  <Input
                    type="number"
                    value={section.maxWords ?? ''}
                    onChange={(e) =>
                      set(
                        'sections',
                        sections.map((s, i) =>
                          i === index
                            ? {
                                ...s,
                                maxWords: e.target.value ? Number(e.target.value) : undefined,
                              }
                            : s
                        )
                      )
                    }
                  />
                </Field2>
                <Field2 className="sm:col-span-3" label="Guidance">
                  <Input
                    value={section.guidance ?? ''}
                    onChange={(e) =>
                      set(
                        'sections',
                        sections.map((s, i) =>
                          i === index ? { ...s, guidance: e.target.value } : s
                        )
                      )
                    }
                  />
                </Field2>
                <div className="sm:col-span-1 flex items-end justify-between gap-1 pb-1">
                  <label className="flex items-center gap-1 text-[10px] font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={section.required}
                      onChange={(e) =>
                        set(
                          'sections',
                          sections.map((s, i) =>
                            i === index ? { ...s, required: e.target.checked } : s
                          )
                        )
                      }
                      className="accent-primary"
                    />
                    Req
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 cursor-pointer"
                    onClick={() =>
                      set(
                        'sections',
                        sections.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <IconTrash size={14} />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() =>
                set('sections', [
                  ...sections,
                  withRowId({
                    key: `section-${sections.length + 1}`,
                    title: 'New section',
                    required: false,
                  }),
                ])
              }
            >
              <IconPlus size={15} />
              Add section
            </Button>
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="fields" className="space-y-3 pt-4">
            <Callout>
              Questions asked in the create wizard. Each field's placeholder must appear verbatim in
              the content — for example <code>{'{{AUTHORS}}'}</code>.
            </Callout>

            {fields.map((field, index) => (
              <div
                key={field._rowId}
                className="rounded-lg border border-border bg-card p-3 grid gap-3 sm:grid-cols-12"
              >
                <Field2 className="sm:col-span-3" label="Label">
                  <Input
                    value={field.label}
                    onChange={(e) =>
                      set(
                        'fields',
                        fields.map((f, i) => (i === index ? { ...f, label: e.target.value } : f))
                      )
                    }
                  />
                </Field2>
                <Field2 className="sm:col-span-2" label="Key">
                  <Input
                    value={field.key}
                    className="font-mono text-xs"
                    onChange={(e) =>
                      set(
                        'fields',
                        fields.map((f, i) => (i === index ? { ...f, key: e.target.value } : f))
                      )
                    }
                  />
                </Field2>
                <Field2 className="sm:col-span-2" label="Placeholder">
                  <Input
                    value={field.placeholder}
                    className="font-mono text-xs"
                    onChange={(e) =>
                      set(
                        'fields',
                        fields.map((f, i) =>
                          i === index ? { ...f, placeholder: e.target.value } : f
                        )
                      )
                    }
                  />
                </Field2>
                <Field2 className="sm:col-span-2" label="Type">
                  <select
                    value={field.type}
                    onChange={(e) =>
                      set(
                        'fields',
                        fields.map((f, i) =>
                          i === index ? { ...f, type: e.target.value as Field['type'] } : f
                        )
                      )
                    }
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field2>
                <Field2 className="sm:col-span-2" label="Help text">
                  <Input
                    value={field.help ?? ''}
                    onChange={(e) =>
                      set(
                        'fields',
                        fields.map((f, i) => (i === index ? { ...f, help: e.target.value } : f))
                      )
                    }
                  />
                </Field2>
                <div className="sm:col-span-1 flex items-end justify-between gap-1 pb-1">
                  <label className="flex items-center gap-1 text-[10px] font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        set(
                          'fields',
                          fields.map((f, i) =>
                            i === index ? { ...f, required: e.target.checked } : f
                          )
                        )
                      }
                      className="accent-primary"
                    />
                    Req
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 cursor-pointer"
                    onClick={() =>
                      set(
                        'fields',
                        fields.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <IconTrash size={14} />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() =>
                set('fields', [
                  ...fields,
                  withRowId({
                    key: 'newField',
                    label: 'New field',
                    type: 'text' as const,
                    required: false,
                    placeholder: '{{NEW_FIELD}}',
                  }),
                ])
              }
            >
              <IconPlus size={15} />
              Add field
            </Button>
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="format" className="space-y-4 pt-4 max-w-3xl">
            <Callout>
              Nothing here compiles LaTeX today. These values ride along with each document so the
              LaTeX export — and, later, a compile service — has the right contract without
              re-deriving it.
            </Callout>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field2 label="Document class">
                <Input
                  value={form.documentClass}
                  className="font-mono"
                  onChange={(e) => set('documentClass', e.target.value)}
                />
              </Field2>
              <Field2 label="Entry file">
                <Input
                  value={form.entryFile}
                  className="font-mono"
                  onChange={(e) => set('entryFile', e.target.value)}
                />
              </Field2>
              <Field2 label="Engine">
                <Select value={form.engine} options={ENGINES} onChange={(v) => set('engine', v)} />
              </Field2>
              <Field2 label="Bibliography tool">
                <Select
                  value={form.bibTool}
                  options={BIB_TOOLS}
                  onChange={(v) => set('bibTool', v)}
                />
              </Field2>
              <Field2 label="Citation style">
                <Select
                  value={form.citationStyle}
                  options={CITATION_STYLES}
                  onChange={(v) => set('citationStyle', v)}
                />
              </Field2>
              <Field2 label="LaTeX passes">
                <Input
                  type="number"
                  value={form.passes}
                  onChange={(e) => set('passes', Number(e.target.value))}
                />
              </Field2>
            </div>

            <Field2 label="Required packages (comma separated)">
              <Input
                value={(form.requiredPackages ?? []).join(', ')}
                className="font-mono text-xs"
                onChange={(e) =>
                  set(
                    'requiredPackages',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </Field2>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Class options</Label>
              {classOptions.map((option, index) => (
                <div key={option._rowId} className="flex gap-2 items-center">
                  <Input
                    value={option.value}
                    placeholder="conference"
                    className="font-mono text-xs"
                    onChange={(e) =>
                      set(
                        'classOptions',
                        classOptions.map((o, i) =>
                          i === index ? { ...o, value: e.target.value } : o
                        )
                      )
                    }
                  />
                  <Input
                    value={option.label}
                    placeholder="Conference paper (two-column)"
                    onChange={(e) =>
                      set(
                        'classOptions',
                        classOptions.map((o, i) =>
                          i === index ? { ...o, label: e.target.value } : o
                        )
                      )
                    }
                  />
                  <Input
                    value={option.group ?? ''}
                    placeholder="group"
                    className="w-28 text-xs"
                    onChange={(e) =>
                      set(
                        'classOptions',
                        classOptions.map((o, i) =>
                          i === index ? { ...o, group: e.target.value || undefined } : o
                        )
                      )
                    }
                  />
                  <label className="flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(option.isDefault)}
                      onChange={(e) =>
                        set(
                          'classOptions',
                          classOptions.map((o, i) =>
                            i === index ? { ...o, isDefault: e.target.checked } : o
                          )
                        )
                      }
                      className="accent-primary"
                    />
                    Default
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 shrink-0 cursor-pointer"
                    onClick={() =>
                      set(
                        'classOptions',
                        classOptions.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <IconTrash size={14} />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() =>
                  set('classOptions', [...classOptions, withRowId({ value: '', label: '' })])
                }
              >
                <IconPlus size={14} />
                Add option
              </Button>
            </div>

            <Field2 label="LaTeX skeleton (used by the export)">
              <Textarea
                value={form.latexSkeleton ?? ''}
                onChange={(e) => set('latexSkeleton', e.target.value)}
                className="font-mono text-xs min-h-40"
                placeholder={'\\documentclass[...]{...}\n...\n\\begin{document}\n{{TITLE}}\n...'}
              />
            </Field2>
          </TabsContent>

          {/* ---------------------------------------------------------- */}
          <TabsContent value="publishing" className="space-y-4 pt-4 max-w-3xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field2 label="Name">
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
              </Field2>
              <Field2 label="Slug">
                <Input
                  value={form.slug}
                  className="font-mono text-xs"
                  onChange={(e) => set('slug', e.target.value)}
                />
              </Field2>
              <Field2 label="Category">
                <Select
                  value={form.category}
                  options={CATEGORIES}
                  onChange={(v) => set('category', v)}
                />
              </Field2>
              <Field2 label="Publisher (optional)">
                <Input
                  value={form.publisher ?? ''}
                  placeholder="IEEE"
                  onChange={(e) => set('publisher', e.target.value)}
                />
              </Field2>
            </div>

            <Field2 label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className="min-h-20"
              />
            </Field2>

            <Field2 label="Tags (comma separated)">
              <Input
                value={(form.tags ?? []).join(', ')}
                onChange={(e) =>
                  set(
                    'tags',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </Field2>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field2 label="Status">
                <Select
                  value={form.status}
                  options={['draft', 'published'] as const}
                  onChange={(v) => set('status', v)}
                />
              </Field2>
              <Field2 label="Sort order">
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => set('order', Number(e.target.value))}
                />
              </Field2>
              <div className="flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => set('featured', e.target.checked)}
                    className="accent-primary"
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.official}
                    onChange={(e) => set('official', e.target.checked)}
                    className="accent-primary"
                  />
                  Official
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-bold">Licence</h3>
              <Callout>
                Record the licence of the underlying class file, not of the sample prose. Never ship
                publisher sample text; write your own.
              </Callout>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field2 label="SPDX identifier">
                  <Input
                    value={form.license?.spdx ?? ''}
                    className="font-mono text-xs"
                    onChange={(e) => set('license', { ...form.license, spdx: e.target.value })}
                  />
                </Field2>
                <Field2 label="Licence URL">
                  <Input
                    value={form.license?.url ?? ''}
                    className="text-xs"
                    onChange={(e) => set('license', { ...form.license, url: e.target.value })}
                  />
                </Field2>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.license?.redistributable)}
                  onChange={(e) =>
                    set('license', { ...form.license, redistributable: e.target.checked })
                  }
                  className="accent-primary"
                />
                Class file may be redistributed with the app
              </label>
              <Field2 label="Notes">
                <Textarea
                  value={form.license?.notes ?? ''}
                  onChange={(e) => set('license', { ...form.license, notes: e.target.value })}
                  className="min-h-16 text-xs"
                />
              </Field2>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-lg px-3 py-2 leading-relaxed">
      <IconInfoCircle size={15} className="shrink-0 mt-px" />
      <span>{children}</span>
    </p>
  );
}

/** Named `Field2` to avoid colliding with the template `Field` type above. */
function Field2({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
