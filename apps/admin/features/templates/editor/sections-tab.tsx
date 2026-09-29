'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { cn } from '@repo/ui/lib/utils';
import { IconChevronDown, IconPlus, IconTrash } from '@tabler/icons-react';
import { useId, useState } from 'react';
import { Callout, FormField } from '../../../components/form-field';
import { SortableList } from './sortable-list';
import { type Section, withRowId } from './types';
import type { TemplateFormApi } from './use-template-form';

const toNumber = (value: string) => (value === '' ? undefined : Number(value));

function wordRange(section: Section): string {
  if (section.targetWords && section.maxWords)
    return `${section.targetWords}–${section.maxWords} words`;
  if (section.targetWords) return `~${section.targetWords} words`;
  if (section.maxWords) return `≤ ${section.maxWords} words`;
  return 'No word budget';
}

export function SectionsTab({ editor }: { editor: TemplateFormApi }) {
  const { form, set, errors } = editor;
  const sections = form.sections;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const update = (rowId: string, patch: Partial<Section>) =>
    set(
      'sections',
      sections.map((s) => (s._rowId === rowId ? { ...s, ...patch } : s))
    );

  const toggle = (rowId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="flex flex-col gap-3">
        <Callout>
          Sections drive word-budget tracking and the submission checklist. Keep titles matching the
          headings in the content.
        </Callout>

        {sections.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No sections yet.
          </p>
        ) : (
          <SortableList
            items={sections}
            onChange={(next) => set('sections', next)}
            itemLabel={(s) => s.title || 'Untitled section'}
            renderItem={(section, index, { handle, moveButtons }) => {
              const at = `sections.${section._rowId}`;
              const hasError = Object.keys(errors).some((key) => key.startsWith(at));
              const open = expanded.has(section._rowId) || hasError;
              return (
                <div
                  className={cn(
                    'rounded-lg border bg-card',
                    hasError && 'border-destructive/50',
                    open && 'ring-1 ring-primary/30'
                  )}
                >
                  <div className="flex items-center gap-1.5 p-2">
                    {handle}
                    <span className="w-5 text-center font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(section._rowId)}
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="truncate font-medium">
                        {section.title || 'Untitled section'}
                      </span>
                      {section.required && (
                        <span className="rounded bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                          required
                        </span>
                      )}
                      <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {wordRange(section)}
                      </span>
                      <IconChevronDown
                        size={15}
                        className={cn('shrink-0 transition-transform', open && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </button>
                    {moveButtons}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      aria-label={`Remove ${section.title || 'section'}`}
                      onClick={() =>
                        set(
                          'sections',
                          sections.filter((s) => s._rowId !== section._rowId)
                        )
                      }
                    >
                      <IconTrash size={14} />
                    </Button>
                  </div>
                  {open && (
                    <SectionFields
                      section={section}
                      errors={errors}
                      onChange={(patch) => update(section._rowId, patch)}
                    />
                  )}
                </div>
              );
            }}
          />
        )}

        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => {
            const row = withRowId({
              key: `section-${sections.length + 1}`,
              title: 'New section',
              required: false,
            });
            set('sections', [...sections, row]);
            setExpanded((current) => new Set(current).add(row._rowId));
          }}
        >
          <IconPlus size={15} aria-hidden="true" />
          Add section
        </Button>
      </div>

      <aside
        className="h-fit rounded-lg border bg-muted/30 p-4 lg:sticky lg:top-16"
        aria-label="Outline preview"
      >
        <h3 className="mb-2 text-sm font-medium">Outline</h3>
        <p className="mb-3 text-xs text-muted-foreground">As authors see it in the checklist.</p>
        <ol className="flex flex-col gap-1.5 text-sm">
          {sections.map((s, i) => (
            <li key={s._rowId} className="flex gap-2">
              <span className="w-4 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="flex-1 truncate">{s.title || 'Untitled'}</span>
              {s.required && (
                <span className="text-xs text-primary">
                  <span aria-hidden="true">●</span>
                  <span className="sr-only">required</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function SectionFields({
  section,
  errors,
  onChange,
}: {
  section: Section;
  errors: Record<string, string>;
  onChange: (patch: Partial<Section>) => void;
}) {
  const id = useId();
  const at = `sections.${section._rowId}`;
  return (
    <div className="grid gap-3 border-t p-3 sm:grid-cols-6">
      <FormField
        id={`${id}-title`}
        label="Title"
        error={errors[`${at}.title`]}
        className="sm:col-span-3"
      >
        <Input
          id={`${id}-title`}
          value={section.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-describedby={`${id}-title-hint`}
        />
      </FormField>
      <FormField id={`${id}-key`} label="Key" error={errors[`${at}.key`]} className="sm:col-span-3">
        <Input
          id={`${id}-key`}
          value={section.key}
          className="font-mono text-sm"
          onChange={(e) => onChange({ key: e.target.value })}
          aria-describedby={`${id}-key-hint`}
        />
      </FormField>
      <FormField
        id={`${id}-target`}
        label="Target words"
        error={errors[`${at}.targetWords`]}
        className="sm:col-span-2"
      >
        <Input
          id={`${id}-target`}
          type="number"
          min={0}
          value={section.targetWords ?? ''}
          onChange={(e) => onChange({ targetWords: toNumber(e.target.value) })}
          aria-describedby={`${id}-target-hint`}
        />
      </FormField>
      <FormField
        id={`${id}-max`}
        label="Max words"
        error={errors[`${at}.maxWords`]}
        className="sm:col-span-2"
      >
        <Input
          id={`${id}-max`}
          type="number"
          min={0}
          value={section.maxWords ?? ''}
          onChange={(e) => onChange({ maxWords: toNumber(e.target.value) })}
          aria-describedby={`${id}-max-hint`}
        />
      </FormField>
      <div className="flex items-end gap-2 pb-2 sm:col-span-2">
        <Checkbox
          id={`${id}-required`}
          checked={section.required}
          onCheckedChange={(v) => onChange({ required: Boolean(v) })}
        />
        <Label htmlFor={`${id}-required`}>Required section</Label>
      </div>
      <FormField id={`${id}-guidance`} label="Guidance for authors" className="sm:col-span-6">
        <Input
          id={`${id}-guidance`}
          value={section.guidance ?? ''}
          placeholder="What belongs in this section"
          onChange={(e) => onChange({ guidance: e.target.value || undefined })}
        />
      </FormField>
    </div>
  );
}
