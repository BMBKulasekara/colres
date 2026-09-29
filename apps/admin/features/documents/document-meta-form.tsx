'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';
import { IconCheck, IconLoader2 } from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import { useId, useState } from 'react';
import { FormField } from '../../components/form-field';
import { useAsyncAction } from '../../hooks/use-async-action';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import type { DocumentDetail } from './types';
import { useDocumentActions } from './use-document-actions';

/**
 * Title, slug and status, the only fields an admin edits; content belongs to
 * the author. The parent keys this on the saved values, so a save here or an
 * edit elsewhere starts the form fresh from the server.
 */
export function DocumentMetaForm({ doc }: { doc: DocumentDetail }) {
  const id = useId();
  const { update } = useDocumentActions();
  const [title, setTitle] = useState(doc.title);
  const [slug, setSlug] = useState(doc.slug);
  const [status, setStatus] = useState(doc.status);

  const debouncedSlug = useDebouncedValue(slug.trim(), 300);
  const slugChanged = debouncedSlug !== doc.slug;
  const slugCheck = useQuery(
    api.admin.documents.checkSlug,
    slugChanged && debouncedSlug ? { slug: debouncedSlug, excludeId: doc._id } : 'skip'
  );

  const dirty = title !== doc.title || slug !== doc.slug || status !== doc.status;
  const slugPending =
    slug.trim() !== doc.slug && (debouncedSlug !== slug.trim() || slugCheck === undefined);
  const slugError = !slug.trim()
    ? 'A slug is required'
    : slugChanged && slugCheck && !slugCheck.available
      ? slugCheck.reason
      : undefined;
  const titleError = title.trim() ? undefined : 'A title is required';
  const canSave = dirty && !slugError && !titleError && !slugPending;

  const { run: save, pending } = useAsyncAction(
    () =>
      update({
        id: doc._id,
        ...(title !== doc.title ? { title: title.trim() } : {}),
        ...(slug !== doc.slug ? { slug: slug.trim() } : {}),
        ...(status !== doc.status ? { status } : {}),
      }),
    { success: 'Document saved', error: "Couldn't save" }
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) void save();
      }}
    >
      <FormField id={`${id}-title`} label="Title" error={titleError} required>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={Boolean(titleError)}
          aria-describedby={`${id}-title-hint`}
        />
      </FormField>

      <FormField
        id={`${id}-slug`}
        label="URL slug"
        error={slugError}
        hint={
          slug.trim() !== doc.slug && !slugError ? (
            slugPending ? (
              <span className="flex items-center gap-1">
                <IconLoader2 size={12} className="animate-spin" aria-hidden="true" /> Checking…
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <IconCheck size={12} aria-hidden="true" /> Available
              </span>
            )
          ) : (
            'Changing the slug breaks existing links to this document.'
          )
        }
      >
        <div className="flex items-center rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <span className="pl-3 font-mono text-sm text-muted-foreground">/docs/</span>
          <input
            id={`${id}-slug`}
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
            aria-invalid={Boolean(slugError)}
            aria-describedby={`${id}-slug-hint`}
            autoComplete="off"
            spellCheck={false}
            className="h-9 min-w-0 flex-1 bg-transparent pr-3 font-mono text-sm outline-none"
          />
        </div>
      </FormField>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Status</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: 'Active', hint: 'Visible to collaborators' },
            { value: false, label: 'Draft', hint: 'Hidden from shared lists' },
          ].map((option) => (
            <label
              key={option.label}
              className={cn(
                'flex cursor-pointer flex-col rounded-lg border p-2.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                status === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <input
                type="radio"
                name={`${id}-status`}
                className="sr-only"
                checked={status === option.value}
                onChange={() => setStatus(option.value)}
              />
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-end gap-2">
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTitle(doc.title);
              setSlug(doc.slug);
              setStatus(doc.status);
            }}
          >
            Discard
          </Button>
        )}
        <Button type="submit" disabled={!canSave || pending}>
          {pending && <IconLoader2 size={15} className="animate-spin" aria-hidden="true" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
