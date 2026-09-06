'use client';

import { Check, FileText, Sparkles } from 'lucide-react';
import Image from 'next/image';

export interface TemplateSummary {
  _id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  official: boolean;
  publisher?: string;
  thumbnailUrl?: string | null;
  documentClass: string;
  citationStyle: string;
  sections: { key: string; title: string; required: boolean }[];
  usageCount: number;
}

interface TemplateCardProps {
  template: TemplateSummary;
  selected: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}

export function TemplateCard({ template, selected, onSelect, onPreview }: TemplateCardProps) {
  return (
    // The preview control is a sibling of the select button rather than a child
    // of it: nesting an interactive element inside a button is invalid HTML and
    // makes the inner control unreachable by keyboard.
    <div className="relative h-full">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Use the ${template.name} template`}
        className={`group flex flex-col text-left rounded-xl border transition-all duration-200 overflow-hidden h-full w-full ${
          selected
            ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
            : 'border-border/80 bg-card hover:border-primary/40 hover:shadow-md'
        }`}
      >
        {selected && (
          <span className="absolute top-2 right-2 z-10 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Check className="h-3 w-3" />
          </span>
        )}

        <span className="relative h-24 w-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center border-b border-border/60 overflow-hidden">
          {template.thumbnailUrl ? (
            <Image
              src={template.thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 220px"
              className="object-cover object-top"
            />
          ) : (
            <FileText className="h-7 w-7 text-muted-foreground/50" />
          )}
          {template.official && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background/90 text-[9px] font-bold uppercase tracking-wide text-primary border border-primary/20">
              <Sparkles className="h-2.5 w-2.5" />
              {template.publisher ?? 'Official'}
            </span>
          )}
        </span>

        <span className="flex flex-col flex-1 p-3 gap-1.5 w-full">
          <span className="text-sm font-bold text-foreground leading-tight line-clamp-1">
            {template.name}
          </span>
          <span className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3 flex-1">
            {template.description}
          </span>
          <span className="flex items-center pt-1.5 mt-auto border-t border-border/40 text-[10px] font-mono text-muted-foreground">
            {template.sections.length} sections
          </span>
        </span>
      </button>

      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          className="absolute bottom-3 right-3 text-[10px] font-semibold text-primary hover:underline"
        >
          Preview
        </button>
      )}
    </div>
  );
}
