'use client';

import { Callout } from '../../../components/form-field';
import { TemplateContentEditor } from './content-editor';
import type { TemplateFormApi } from './use-template-form';

export function ContentTab({ editor }: { editor: TemplateFormApi }) {
  const { form, set } = editor;
  const tokens = ['{{TITLE}}', ...form.fields.map((f) => f.placeholder).filter(Boolean)];

  return (
    <div className="flex flex-col gap-4">
      <Callout>
        The body every new document starts with. Blockquotes appear to authors as guidance callouts.
        Placeholders are replaced with the answers from the create wizard.
      </Callout>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Available placeholders:</span>
        {tokens.map((token) => (
          <code
            key={token}
            className={
              form.content.includes(token)
                ? 'rounded border bg-muted px-1.5 py-0.5'
                : 'rounded border border-dashed border-amber-500/50 px-1.5 py-0.5 text-amber-700 dark:text-amber-400'
            }
            title={
              form.content.includes(token) ? 'Used in the content' : 'Not used in the content yet'
            }
          >
            {token}
          </code>
        ))}
      </div>
      <TemplateContentEditor value={form.content} onChange={(html) => set('content', html)} />
    </div>
  );
}
