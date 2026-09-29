'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useId } from 'react';
import { Callout, FormField, NativeSelect } from '../../../components/form-field';
import { BIB_TOOLS, CITATION_STYLES, ENGINES } from '../../../lib/constants';
import { SortableList } from './sortable-list';
import { type ClassOption, withRowId } from './types';
import type { TemplateFormApi } from './use-template-form';

export function LatexTab({ editor }: { editor: TemplateFormApi }) {
  const id = useId();
  const { form, set, errors } = editor;
  const options = form.classOptions;

  const updateOption = (rowId: string, patch: Partial<ClassOption>) =>
    set(
      'classOptions',
      options.map((o) => (o._rowId === rowId ? { ...o, ...patch } : o))
    );

  return (
    <div className="grid max-w-3xl gap-6">
      <Callout>
        Nothing compiles LaTeX yet. These values travel with each document so the LaTeX export, and
        later a compile service, have the right contract. Changing them creates a new template
        version.
      </Callout>

      <section className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${id}-class`} label="Document class" error={errors.documentClass} required>
          <Input
            id={`${id}-class`}
            value={form.documentClass}
            className="font-mono"
            onChange={(e) => set('documentClass', e.target.value)}
            aria-describedby={`${id}-class-hint`}
          />
        </FormField>
        <FormField id={`${id}-entry`} label="Entry file" error={errors.entryFile} required>
          <Input
            id={`${id}-entry`}
            value={form.entryFile}
            className="font-mono"
            onChange={(e) => set('entryFile', e.target.value)}
            aria-describedby={`${id}-entry-hint`}
          />
        </FormField>
        <FormField id={`${id}-engine`} label="Engine">
          <NativeSelect
            id={`${id}-engine`}
            value={form.engine}
            options={ENGINES}
            onChange={(v) => set('engine', v)}
          />
        </FormField>
        <FormField id={`${id}-bib`} label="Bibliography tool">
          <NativeSelect
            id={`${id}-bib`}
            value={form.bibTool}
            options={BIB_TOOLS}
            onChange={(v) => set('bibTool', v)}
          />
        </FormField>
        <FormField id={`${id}-citation`} label="Citation style">
          <NativeSelect
            id={`${id}-citation`}
            value={form.citationStyle}
            options={CITATION_STYLES.map((s) => ({ value: s, label: s.toUpperCase() }))}
            onChange={(v) => set('citationStyle', v)}
          />
        </FormField>
        <FormField
          id={`${id}-passes`}
          label="Compile passes"
          error={errors.passes}
          hint="Usually 3 with a bibliography."
        >
          <Input
            id={`${id}-passes`}
            type="number"
            min={1}
            max={6}
            value={Number.isFinite(form.passes) ? form.passes : ''}
            onChange={(e) => set('passes', e.target.valueAsNumber)}
            aria-describedby={`${id}-passes-hint`}
            className="w-28"
          />
        </FormField>
      </section>

      <FormField
        id={`${id}-packages`}
        label="Required packages"
        hint="Comma separated, e.g. amsmath, graphicx."
      >
        <Input
          key={form.requiredPackages.join(',')}
          id={`${id}-packages`}
          defaultValue={form.requiredPackages.join(', ')}
          className="font-mono text-sm"
          onBlur={(e) =>
            set(
              'requiredPackages',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          aria-describedby={`${id}-packages-hint`}
        />
      </FormField>

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium">Class options</h3>
          <p className="text-xs text-muted-foreground">
            Choices offered to authors, e.g. conference vs. journal layout.
          </p>
        </div>
        {options.length > 0 && (
          <SortableList
            items={options}
            onChange={(next) => set('classOptions', next)}
            itemLabel={(o) => o.label || o.value || 'option'}
            renderItem={(option, _index, { handle, moveButtons }) => (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
                {handle}
                <Input
                  aria-label="Option value"
                  value={option.value}
                  placeholder="conference"
                  className="w-36 font-mono text-sm"
                  aria-invalid={Boolean(errors[`classOptions.${option._rowId}.value`])}
                  onChange={(e) => updateOption(option._rowId, { value: e.target.value })}
                />
                <Input
                  aria-label="Option label"
                  value={option.label}
                  placeholder="Conference paper (two-column)"
                  className="min-w-40 flex-1"
                  onChange={(e) => updateOption(option._rowId, { label: e.target.value })}
                />
                <Input
                  aria-label="Option group"
                  value={option.group ?? ''}
                  placeholder="Group"
                  className="w-28"
                  onChange={(e) =>
                    updateOption(option._rowId, { group: e.target.value || undefined })
                  }
                />
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id={`${id}-${option._rowId}-default`}
                    checked={Boolean(option.isDefault)}
                    onCheckedChange={(v) => updateOption(option._rowId, { isDefault: Boolean(v) })}
                  />
                  <Label htmlFor={`${id}-${option._rowId}-default`} className="text-xs">
                    Default
                  </Label>
                </div>
                {moveButtons}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  aria-label={`Remove ${option.label || option.value || 'option'}`}
                  onClick={() =>
                    set(
                      'classOptions',
                      options.filter((o) => o._rowId !== option._rowId)
                    )
                  }
                >
                  <IconTrash size={14} />
                </Button>
              </div>
            )}
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => set('classOptions', [...options, withRowId({ value: '', label: '' })])}
        >
          <IconPlus size={14} aria-hidden="true" />
          Add option
        </Button>
      </section>

      <FormField
        id={`${id}-skeleton`}
        label="LaTeX skeleton"
        hint="Used by the LaTeX export. {{TITLE}} and wizard placeholders are filled in."
      >
        <Textarea
          id={`${id}-skeleton`}
          value={form.latexSkeleton ?? ''}
          onChange={(e) => set('latexSkeleton', e.target.value)}
          className="min-h-48 font-mono text-xs"
          placeholder={'\\documentclass[...]{...}\n\\begin{document}\n{{TITLE}}\n\\end{document}'}
          spellCheck={false}
          aria-describedby={`${id}-skeleton-hint`}
        />
      </FormField>
    </div>
  );
}
