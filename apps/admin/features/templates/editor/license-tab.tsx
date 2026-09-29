'use client';

import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Switch } from '@repo/ui/components/ui/switch';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { useId } from 'react';
import { Callout, FormField } from '../../../components/form-field';
import type { TemplateFormApi } from './use-template-form';

export function LicenseTab({ editor }: { editor: TemplateFormApi }) {
  const id = useId();
  const { form, set, errors } = editor;
  const license = form.license;
  const update = (patch: Partial<typeof license>) => set('license', { ...license, ...patch });

  return (
    <div className="grid max-w-3xl gap-6">
      <Callout tone="warn">
        Record the licence of the underlying class file, not the sample prose. Never ship publisher
        sample text; write your own.
      </Callout>
      <section className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${id}-spdx`}
          label="SPDX identifier"
          error={errors['license.spdx']}
          hint="e.g. LPPL-1.3c, MIT, CC-BY-4.0"
          required
        >
          <Input
            id={`${id}-spdx`}
            value={license.spdx}
            className="font-mono text-sm"
            onChange={(e) => update({ spdx: e.target.value })}
            aria-describedby={`${id}-spdx-hint`}
          />
        </FormField>
        <FormField id={`${id}-url`} label="Licence URL" error={errors['license.url']} required>
          <Input
            id={`${id}-url`}
            type="url"
            value={license.url}
            onChange={(e) => update({ url: e.target.value })}
            aria-describedby={`${id}-url-hint`}
          />
        </FormField>
      </section>
      <div className="flex items-start justify-between gap-3 rounded-lg border p-4">
        <div className="grid gap-0.5">
          <Label htmlFor={`${id}-redistributable`}>Redistributable</Label>
          <p id={`${id}-redistributable-hint`} className="text-xs text-muted-foreground">
            The class file may be bundled with Colres exports.
          </p>
        </div>
        <Switch
          id={`${id}-redistributable`}
          checked={license.redistributable}
          onCheckedChange={(v) => update({ redistributable: v })}
          aria-describedby={`${id}-redistributable-hint`}
        />
      </div>
      <FormField id={`${id}-notes`} label="Notes">
        <Textarea
          id={`${id}-notes`}
          value={license.notes ?? ''}
          className="min-h-20"
          onChange={(e) => update({ notes: e.target.value || undefined })}
        />
      </FormField>
    </div>
  );
}
