'use client';

import { useOrganization } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, FilePlus2, Loader2, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { TemplateCard } from './TemplateCard';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';

type Step = 'choose' | 'details';

interface CreateDocumentWizardProps {
  /** Omit when driving the dialog with `open`/`onOpenChange` instead. */
  trigger?: React.ReactNode;
  /** Controlled mode, used by the gallery page's "Use this template" action. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Skips straight to the details step. A template id preselects that
   * template; `null` preselects the blank document. Omit it entirely to open
   * on the chooser.
   */
  initialTemplateId?: string | null;
}

export function CreateDocumentWizard({
  trigger,
  open: controlledOpen,
  onOpenChange: onControlledOpenChange,
  initialTemplateId,
}: CreateDocumentWizardProps) {
  const router = useRouter();
  const { organization } = useOrganization();

  // `null` is a meaningful preselection (blank), so presence is tested against
  // undefined rather than falsiness.
  const hasPreselection = initialTemplateId !== undefined;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const [step, setStep] = useState<Step>(hasPreselection ? 'details' : 'choose');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // null is a real choice here ("blank document"), not an absence of one; the
  // current step is what tells us whether a choice has been made yet.
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId ?? null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery(api.templates.listCategories, open ? {} : 'skip');
  const templates = useQuery(
    api.templates.listTemplates,
    open
      ? {
          category: (category ?? undefined) as never,
          search: search.trim() || undefined,
          orgId: organization?.id,
        }
      : 'skip'
  );

  const createDoc = useMutation(api.documents.createDocument);

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t._id === templateId) ?? null,
    [templates, templateId]
  );

  const reset = () => {
    setStep(hasPreselection ? 'details' : 'choose');
    setSearch('');
    setCategory(null);
    setTemplateId(initialTemplateId ?? null);
    setTitle('');
    setDescription('');
    setFieldValues({});
    setError(null);
    setIsCreating(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (isControlled) {
      onControlledOpenChange?.(next);
    } else {
      setUncontrolledOpen(next);
    }
    if (!next) reset();
  };

  const chooseTemplate = (id: string | null) => {
    setTemplateId(id);
    setPreviewId(null);

    // Seed the title from the template so the field is never empty, while
    // still being obviously a placeholder the author should replace.
    if (id) {
      const template = templates?.find((t) => t._id === id);
      if (template && !title.trim()) setTitle(`Untitled ${template.name}`);
    }
    setStep('details');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Give your document a title.');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const result = await createDoc({
        title: trimmedTitle,
        description: description.trim() || undefined,
        orgId: organization?.id,
        templateId: (templateId ?? undefined) as never,
        fieldValues: templateId ? fieldValues : undefined,
      });
      // The server may have suffixed the slug to avoid a collision, so we
      // navigate to what it actually created rather than a guess.
      router.push(`/docs/${result.slug}`);
    } catch (err) {
      console.error('Failed to create document:', err);
      setError(err instanceof Error ? err.message : 'Could not create the document.');
      setIsCreating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 gap-0">
          {step === 'choose' ? (
            <>
              <DialogHeader className="p-6 pb-4 border-b border-border/60">
                <DialogTitle>Start a new document</DialogTitle>
                <DialogDescription>
                  Pick a template to start with the right structure, or begin from a blank page.
                </DialogDescription>
              </DialogHeader>

              <div className="px-6 py-3 border-b border-border/60 space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates by name, publisher, or tag..."
                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <CategoryChip
                    label="All"
                    active={category === null}
                    onClick={() => setCategory(null)}
                  />
                  {categories?.map((c) => (
                    <CategoryChip
                      key={c.slug}
                      label={c.name}
                      active={category === c.slug}
                      onClick={() => setCategory(c.slug)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => chooseTemplate(null)}
                    className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 p-4 min-h-[180px]"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                      <FilePlus2 className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Blank document</span>
                    <span className="text-[11px] text-muted-foreground text-center leading-relaxed">
                      An empty page with no structure.
                    </span>
                  </button>

                  {templates === undefined
                    ? [1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-border/60 min-h-[180px] animate-pulse bg-muted/30"
                        />
                      ))
                    : templates.map((template) => (
                        <TemplateCard
                          key={template._id}
                          template={template as never}
                          selected={templateId === template._id}
                          onSelect={() => chooseTemplate(template._id)}
                          onPreview={() => setPreviewId(template._id)}
                        />
                      ))}
                </div>

                {templates?.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    No templates match that search.
                  </p>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col overflow-hidden">
              <DialogHeader className="p-6 pb-4 border-b border-border/60">
                <DialogTitle>Document details</DialogTitle>
                <DialogDescription>
                  {selectedTemplate
                    ? `Starting from ${selectedTemplate.name}.`
                    : 'Starting from a blank page.'}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <span className="text-xs font-semibold text-foreground">
                    {selectedTemplate?.name ?? 'Blank document'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setStep('choose')}
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Change
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="doc-title">Title</Label>
                  <Input
                    id="doc-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled Document"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="doc-description">Description</Label>
                  <Textarea
                    id="doc-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-28 placeholder:text-xs"
                    placeholder="Briefly explain your research idea in under 200 words. This is what the Research panel uses to suggest relevant papers."
                  />
                </div>

                {selectedTemplate?.fields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-2">
                    <Label htmlFor={`field-${field.key}`}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        id={`field-${field.key}`}
                        value={fieldValues[field.key] ?? field.defaultValue ?? ''}
                        onChange={(e) =>
                          setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="min-h-24"
                        required={field.required}
                      />
                    ) : (
                      <Input
                        id={`field-${field.key}`}
                        type={field.type === 'date' ? 'date' : 'text'}
                        value={fieldValues[field.key] ?? field.defaultValue ?? ''}
                        onChange={(e) =>
                          setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={
                          field.type === 'authors'
                            ? 'Ada Lovelace, Alan Turing'
                            : field.type === 'keywords'
                              ? 'machine learning, evaluation, benchmarks'
                              : undefined
                        }
                        required={field.required}
                      />
                    )}
                    {field.help && (
                      <p className="text-[11px] text-muted-foreground">{field.help}</p>
                    )}
                  </div>
                ))}

                {error && (
                  <p className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
              </div>

              <DialogFooter className="p-6 pt-4 border-t border-border/60">
                <Button type="button" variant="outline" onClick={() => setStep('choose')}>
                  Back
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {isCreating ? 'Creating...' : 'Create document'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <TemplatePreviewDialog
        templateId={previewId}
        onOpenChange={(next) => !next && setPreviewId(null)}
        onUse={(id) => chooseTemplate(id)}
      />
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
      }`}
    >
      {label}
    </button>
  );
}
