'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';

interface TemplatePreviewDialogProps {
  templateId: string | null;
  onOpenChange: (open: boolean) => void;
  onUse: (templateId: string) => void;
}

/** Read-only look at a template's structure before committing to it. */
export function TemplatePreviewDialog({
  templateId,
  onOpenChange,
  onUse,
}: TemplatePreviewDialogProps) {
  const template = useQuery(
    api.templates.getTemplateById,
    templateId ? { id: templateId as never } : 'skip'
  );

  return (
    <Dialog open={Boolean(templateId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        {template === undefined ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : template === null ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            This template is no longer available.
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {template.name}
                {template.official && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
                    {template.publisher ?? 'Official'}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>{template.description}</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Structure
                </h4>
                <ol className="space-y-1.5">
                  {template.sections.map((section, index) => (
                    <li
                      key={section.key}
                      className="flex items-start gap-3 text-sm border border-border/60 rounded-lg px-3 py-2 bg-muted/20"
                    >
                      <span className="text-xs font-mono text-muted-foreground pt-0.5 w-5 shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{section.title}</span>
                          {section.required && (
                            <span className="text-[9px] font-bold uppercase text-amber-600 dark:text-amber-500">
                              Required
                            </span>
                          )}
                          {section.targetWords && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ~{section.targetWords} words
                              {section.maxWords ? ` (max ${section.maxWords})` : ''}
                            </span>
                          )}
                        </div>
                        {section.guidance && (
                          <p className="text-xs text-muted-foreground mt-0.5">{section.guidance}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Format details
                </h4>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Document class</dt>
                    <dd className="font-mono font-semibold">{template.documentClass}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Citation style</dt>
                    <dd className="font-mono font-semibold uppercase">{template.citationStyle}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">LaTeX engine</dt>
                    <dd className="font-mono font-semibold">{template.engine}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Bibliography</dt>
                    <dd className="font-mono font-semibold">{template.bibTool}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-muted-foreground">Licence</dt>
                    <dd className="font-mono font-semibold">{template.license.spdx}</dd>
                  </div>
                </dl>
                {template.license.notes && (
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    {template.license.notes}
                  </p>
                )}
              </section>

              {template.tags.length > 0 && (
                <section className="flex flex-wrap gap-1.5">
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </section>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" onClick={() => onUse(template._id)}>
                Use this template
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
