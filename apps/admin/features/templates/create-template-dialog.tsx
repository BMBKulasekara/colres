'use client';

import { api } from '@repo/convex/_generated/api';
import type { Doc, Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';
import { IconLoader2 } from '@tabler/icons-react';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { FormField, NativeSelect } from '../../components/form-field';
import { useAsyncAction } from '../../hooks/use-async-action';
import { TEMPLATE_CATEGORIES } from '../../lib/constants';
import type { TemplateRow } from './columns';

type Category = Doc<'templates'>['category'];

/** Starting point for a blank template; the editor is where it gets filled in. */
function blankTemplate(name: string, category: Category, order: number) {
  return {
    name,
    category,
    description: '',
    tags: [],
    official: false,
    content: '<h1>{{TITLE}}</h1><h2>Introduction</h2><p></p>',
    sections: [{ key: 'introduction', title: 'Introduction', required: true }],
    fields: [],
    engine: 'pdflatex' as const,
    bibTool: 'biber' as const,
    passes: 3,
    entryFile: 'main.tex',
    documentClass: 'article',
    classOptions: [],
    requiredPackages: [],
    citationStyle: 'numeric' as const,
    license: {
      spdx: 'LPPL-1.3c',
      url: 'https://www.latex-project.org/lppl/',
      redistributable: true,
    },
    status: 'draft' as const,
    featured: false,
    order,
  };
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  templates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateRow[];
}) {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('journal-articles');
  const [source, setSource] = useState<'blank' | Id<'templates'>>('blank');
  const [touched, setTouched] = useState(false);

  const create = useMutation(api.templates.adminCreateTemplate);
  const duplicate = useMutation(api.templates.adminDuplicateTemplate);
  const update = useMutation(api.templates.adminUpdateTemplate);

  const { run, pending } = useAsyncAction(
    async () => {
      const trimmed = name.trim();
      if (source === 'blank') {
        return await create(blankTemplate(trimmed, category, templates.length + 1));
      }
      const newId = await duplicate({ id: source });
      await update({ id: newId, name: trimmed, slug: trimmed, category });
      return newId;
    },
    { success: 'Draft template created', error: "Couldn't create the template" }
  );

  const nameError = touched && !name.trim() ? 'Give the template a name' : undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setTouched(true);
            if (!name.trim()) return;
            const newId = await run();
            if (newId) {
              onOpenChange(false);
              router.push(`/templates/${newId}`);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>
              It starts as a draft; nothing appears in the gallery until you publish it.
            </DialogDescription>
          </DialogHeader>

          <FormField id={`${id}-name`} label="Name" error={nameError} required>
            <Input
              id={`${id}-name`}
              autoFocus
              value={name}
              placeholder="e.g. IEEE Conference Paper"
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={Boolean(nameError)}
              aria-describedby={`${id}-name-hint`}
            />
          </FormField>

          <FormField id={`${id}-category`} label="Category">
            <NativeSelect
              id={`${id}-category`}
              value={category}
              options={TEMPLATE_CATEGORIES}
              onChange={setCategory}
            />
          </FormField>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Start from</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['blank', 'copy'] as const).map((kind) => {
                const active = kind === 'blank' ? source === 'blank' : source !== 'blank';
                return (
                  <label
                    key={kind}
                    className={cn(
                      'flex cursor-pointer flex-col rounded-lg border p-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                      active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                      kind === 'copy' && templates.length === 0 && 'pointer-events-none opacity-50'
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-source`}
                      className="sr-only"
                      checked={active}
                      disabled={kind === 'copy' && templates.length === 0}
                      onChange={() =>
                        setSource(kind === 'blank' ? 'blank' : (templates[0]?._id ?? 'blank'))
                      }
                    />
                    <span className="font-medium">{kind === 'blank' ? 'Blank' : 'Copy of…'}</span>
                    <span className="text-xs text-muted-foreground">
                      {kind === 'blank' ? 'One section, no fields' : 'Reuse an existing template'}
                    </span>
                  </label>
                );
              })}
            </div>
            {source !== 'blank' && (
              <NativeSelect
                aria-label="Template to copy"
                value={source}
                options={templates.map((t) => ({ value: t._id, label: t.name }))}
                onChange={(value) => setSource(value)}
              />
            )}
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <IconLoader2 size={15} className="animate-spin" aria-hidden="true" />}
              Create and edit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
