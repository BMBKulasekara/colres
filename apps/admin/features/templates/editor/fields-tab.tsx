'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { cn } from '@repo/ui/lib/utils';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useId } from 'react';
import { Callout, FormField, NativeSelect } from '../../../components/form-field';
import { FIELD_TYPES } from '../../../lib/constants';
import { SortableList } from './sortable-list';
import { type Field, withRowId } from './types';
import type { TemplateFormApi } from './use-template-form';
import { unusedPlaceholders } from './validate';

export function FieldsTab({ editor }: { editor: TemplateFormApi }) {
  const { form, set, errors } = editor;
  const fields = form.fields;
  const unused = unusedPlaceholders(form);

  const update = (rowId: string, patch: Partial<Field>) =>
    set(
      'fields',
      fields.map((f) => (f._rowId === rowId ? { ...f, ...patch } : f))
    );

  return (
    <div className="flex flex-col gap-3">
      <Callout>
        Questions asked in the create wizard. Each answer replaces its placeholder in the content,
        so every placeholder should appear there, for example <code>{'{{AUTHORS}}'}</code>.
      </Callout>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No wizard fields. Documents will only ask for a title.
        </p>
      ) : (
        <SortableList
          items={fields}
          onChange={(next) => set('fields', next)}
          itemLabel={(f) => f.label || 'Untitled field'}
          renderItem={(field, _index, { handle, moveButtons }) => (
            <FieldCard
              field={field}
              errors={errors}
              unused={unused.has(field._rowId)}
              handle={handle}
              moveButtons={moveButtons}
              onChange={(patch) => update(field._rowId, patch)}
              onRemove={() =>
                set(
                  'fields',
                  fields.filter((f) => f._rowId !== field._rowId)
                )
              }
            />
          )}
        />
      )}

      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() =>
          set('fields', [
            ...fields,
            withRowId({
              key: `field${fields.length + 1}`,
              label: 'New field',
              type: 'text' as const,
              required: false,
              placeholder: `{{FIELD_${fields.length + 1}}}`,
            }),
          ])
        }
      >
        <IconPlus size={15} aria-hidden="true" />
        Add field
      </Button>
    </div>
  );
}

function FieldCard({
  field,
  errors,
  unused,
  handle,
  moveButtons,
  onChange,
  onRemove,
}: {
  field: Field;
  errors: Record<string, string>;
  unused: boolean;
  handle: React.ReactNode;
  moveButtons: React.ReactNode;
  onChange: (patch: Partial<Field>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const at = `fields.${field._rowId}`;
  const hasError = Object.keys(errors).some((key) => key.startsWith(at));

  return (
    <div className={cn('rounded-lg border bg-card', hasError && 'border-destructive/50')}>
      <div className="flex items-center gap-1.5 border-b p-2">
        {handle}
        <span className="flex-1 truncate font-medium">{field.label || 'Untitled field'}</span>
        {moveButtons}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive"
          aria-label={`Remove ${field.label || 'field'}`}
          onClick={onRemove}
        >
          <IconTrash size={14} />
        </Button>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-6">
        <FormField
          id={`${id}-label`}
          label="Question"
          error={errors[`${at}.label`]}
          className="sm:col-span-3"
        >
          <Input
            id={`${id}-label`}
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            aria-describedby={`${id}-label-hint`}
          />
        </FormField>
        <FormField id={`${id}-type`} label="Answer type" className="sm:col-span-3">
          <NativeSelect
            id={`${id}-type`}
            value={field.type}
            options={FIELD_TYPES}
            onChange={(type) => onChange({ type })}
          />
        </FormField>
        <FormField
          id={`${id}-key`}
          label="Key"
          error={errors[`${at}.key`]}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-key`}
            value={field.key}
            className="font-mono text-sm"
            onChange={(e) => onChange({ key: e.target.value })}
            aria-describedby={`${id}-key-hint`}
          />
        </FormField>
        <FormField
          id={`${id}-placeholder`}
          label="Placeholder"
          error={errors[`${at}.placeholder`]}
          hint={
            unused ? (
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <IconAlertTriangle size={12} aria-hidden="true" /> Not used in the content
              </span>
            ) : undefined
          }
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-placeholder`}
            value={field.placeholder}
            className="font-mono text-sm"
            onChange={(e) => onChange({ placeholder: e.target.value })}
            aria-describedby={`${id}-placeholder-hint`}
          />
        </FormField>
        <div className="flex items-end gap-2 pb-2 sm:col-span-2">
          <Checkbox
            id={`${id}-required`}
            checked={field.required}
            onCheckedChange={(v) => onChange({ required: Boolean(v) })}
          />
          <Label htmlFor={`${id}-required`}>Required</Label>
        </div>
        <FormField id={`${id}-help`} label="Help text" className="sm:col-span-3">
          <Input
            id={`${id}-help`}
            value={field.help ?? ''}
            placeholder="Optional"
            onChange={(e) => onChange({ help: e.target.value || undefined })}
          />
        </FormField>
        <FormField id={`${id}-default`} label="Default answer" className="sm:col-span-3">
          <Input
            id={`${id}-default`}
            value={field.defaultValue ?? ''}
            placeholder="Optional"
            onChange={(e) => onChange({ defaultValue: e.target.value || undefined })}
          />
        </FormField>
        {field.type === 'date' && (
          <FormField id={`${id}-datestyle`} label="Date format" className="sm:col-span-3">
            <NativeSelect
              id={`${id}-datestyle`}
              value={field.dateStyle ?? 'month-day-year'}
              options={[
                { value: 'month-day-year', label: 'Month day, year' },
                { value: 'day-month-year', label: 'Day month year' },
              ]}
              onChange={(dateStyle) => onChange({ dateStyle })}
            />
          </FormField>
        )}
      </div>
    </div>
  );
}
