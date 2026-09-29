'use client';

import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Switch } from '@repo/ui/components/ui/switch';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { useId } from 'react';
import { FormField, NativeSelect } from '../../../components/form-field';
import { TEMPLATE_CATEGORIES } from '../../../lib/constants';
import { ThumbnailUpload } from './thumbnail-upload';
import type { TemplateFormApi } from './use-template-form';

const splitList = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function GeneralTab({
  editor,
  thumbnailUrl,
}: {
  editor: TemplateFormApi;
  thumbnailUrl: string | null;
}) {
  const id = useId();
  const { form, set, errors } = editor;

  return (
    <div className="grid max-w-3xl gap-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${id}-name`} label="Name" error={errors.name} required>
          <Input
            id={`${id}-name`}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={`${id}-name-hint`}
          />
        </FormField>
        <FormField
          id={`${id}-slug`}
          label="Slug"
          error={errors.slug}
          hint="Made unique automatically on save."
          required
        >
          <Input
            id={`${id}-slug`}
            value={form.slug}
            className="font-mono text-sm"
            onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            aria-invalid={Boolean(errors.slug)}
            aria-describedby={`${id}-slug-hint`}
          />
        </FormField>
        <FormField id={`${id}-category`} label="Category">
          <NativeSelect
            id={`${id}-category`}
            value={form.category}
            options={TEMPLATE_CATEGORIES}
            onChange={(v) => set('category', v)}
          />
        </FormField>
        <FormField
          id={`${id}-publisher`}
          label="Publisher"
          hint="Shown as the template's source, e.g. IEEE."
        >
          <Input
            id={`${id}-publisher`}
            value={form.publisher ?? ''}
            placeholder="Optional"
            onChange={(e) => set('publisher', e.target.value)}
            aria-describedby={`${id}-publisher-hint`}
          />
        </FormField>
      </section>

      <FormField
        id={`${id}-description`}
        label="Description"
        hint="One or two sentences shown in the gallery."
      >
        <Textarea
          id={`${id}-description`}
          value={form.description}
          className="min-h-20"
          onChange={(e) => set('description', e.target.value)}
          aria-describedby={`${id}-description-hint`}
        />
      </FormField>

      <FormField id={`${id}-tags`} label="Tags" hint="Comma separated. Used by gallery search.">
        <Input
          key={form.tags.join(',')}
          id={`${id}-tags`}
          defaultValue={form.tags.join(', ')}
          onBlur={(e) => set('tags', splitList(e.target.value))}
          aria-describedby={`${id}-tags-hint`}
        />
      </FormField>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Thumbnail</h3>
        <ThumbnailUpload
          currentUrl={thumbnailUrl}
          value={form.thumbnailId}
          onChange={(value) => set('thumbnailId', value)}
        />
      </section>

      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h3 className="text-sm font-medium">Gallery</h3>
          <p className="text-xs text-muted-foreground">
            Publish or unpublish from the button at the top of the page.
          </p>
        </div>
        <ToggleRow
          id={`${id}-featured`}
          label="Featured"
          hint="Pinned to the top of the gallery."
          checked={form.featured}
          onChange={(v) => set('featured', v)}
        />
        <ToggleRow
          id={`${id}-official`}
          label="Official"
          hint="Marked as the publisher's own format."
          checked={form.official}
          onChange={(v) => set('official', v)}
        />
        <FormField
          id={`${id}-order`}
          label="Sort order"
          error={errors.order}
          hint="Lower numbers appear first."
        >
          <Input
            id={`${id}-order`}
            type="number"
            value={Number.isFinite(form.order) ? form.order : ''}
            onChange={(e) => set('order', e.target.valueAsNumber)}
            aria-describedby={`${id}-order-hint`}
            className="w-28"
          />
        </FormField>
      </section>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-hint`}
      />
    </div>
  );
}
