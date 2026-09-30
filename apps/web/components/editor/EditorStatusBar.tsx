'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/ui/tooltip';
import { AlertTriangle, Eye, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';

const numberFormat = new Intl.NumberFormat();

/** Average adult silent reading speed for academic prose, in words per minute. */
const READING_WPM = 200;

export interface StatusWarning {
  id: string;
  text: string;
  detail?: string;
}

/**
 * The bottom bar: where the caret is, how long the document is, what page
 * geometry and citation style it is set in, and the view toggles that used to
 * crowd the top of the editor.
 */
export function EditorStatusBar({
  sectionTitle,
  words,
  pageSummary,
  pageNote,
  citationStyleLabel,
  warnings,
  isPaged,
  onPagedChange,
  isEditable,
  onEditableChange,
}: {
  sectionTitle: string | null;
  words: number;
  /** "A4 · 2 columns · ~5 pages", shown in the paged view. */
  pageSummary: string | null;
  /** Why the page count is approximate. */
  pageNote: string;
  citationStyleLabel: string;
  warnings: readonly StatusWarning[];
  isPaged: boolean;
  onPagedChange: (paged: boolean) => void;
  isEditable: boolean;
  onEditableChange: (editable: boolean) => void;
}) {
  const minutes = Math.max(1, Math.round(words / READING_WPM));

  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 overflow-x-auto border-t border-border bg-card px-3 text-xs text-muted-foreground">
      {sectionTitle && (
        <span className="hidden shrink-0 md:inline">
          Section: <span className="font-medium text-foreground">{sectionTitle}</span>
        </span>
      )}
      <span className="shrink-0 tabular-nums">
        {numberFormat.format(words)} {words === 1 ? 'word' : 'words'}
        <span className="hidden sm:inline"> · {minutes} min read</span>
      </span>
      {pageSummary && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="hidden shrink-0 cursor-help rounded outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline"
            >
              {pageSummary}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{pageNote}</TooltipContent>
        </Tooltip>
      )}
      <span className="hidden shrink-0 lg:inline">{citationStyleLabel}</span>
      {warnings.map((warning) => (
        <WarningItem key={warning.id} warning={warning} />
      ))}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <Segmented
          label="View"
          value={isPaged ? 'paged' : 'continuous'}
          onChange={(value) => onPagedChange(value === 'paged')}
          options={[
            { value: 'paged', label: 'Paged' },
            { value: 'continuous', label: 'Continuous' },
          ]}
        />
        <Segmented
          label="Mode"
          value={isEditable ? 'edit' : 'read'}
          onChange={(value) => onEditableChange(value === 'edit')}
          options={[
            {
              value: 'edit',
              label: (
                <>
                  <PencilLine className="size-3" aria-hidden="true" />
                  Editing
                </>
              ),
            },
            {
              value: 'read',
              label: (
                <>
                  <Eye className="size-3" aria-hidden="true" />
                  Reading
                </>
              ),
            },
          ]}
        />
      </div>
    </footer>
  );
}

function WarningItem({ warning }: { warning: StatusWarning }) {
  const content = (
    <span className="flex shrink-0 items-center gap-1 font-medium text-warning">
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      {warning.text}
    </span>
  );
  if (!warning.detail) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="cursor-help rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{warning.detail}</TooltipContent>
    </Tooltip>
  );
}

/** A two-way toggle, as a radio group so it reads as one choice. */
function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-muted p-0.5">
      {options.map((option) => (
        // biome-ignore lint/a11y/useSemanticElements: a styled segmented control, keyed like radios
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex items-center gap-1 rounded px-2 py-0.5 transition-colors duration-150 ${
            value === option.value
              ? 'bg-card font-medium text-foreground shadow-xs'
              : 'hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
