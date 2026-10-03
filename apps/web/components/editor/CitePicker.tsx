'use client';

import { BookMarked, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface CitableReference {
  citationKey: string;
  title: string;
  authors: readonly string[];
  year?: number;
}

const MAX_RESULTS = 8;

function authorLine(reference: CitableReference): string {
  const [first] = reference.authors;
  const surname = first ? (first.includes(',') ? first.split(',')[0] : first.split(' ').pop()) : '';
  const who = reference.authors.length > 1 ? `${surname} et al.` : (surname ?? '');
  return [who, reference.year].filter(Boolean).join(' · ');
}

/**
 * Searches the document's bibliography and inserts a citation at the caret.
 *
 * Positioned by its container, like the table menu, and closed by Escape or a
 * click outside. The list is a listbox driven from the search field, so the
 * arrow keys move through results without leaving the input.
 */
export function CitePicker({
  references,
  citedCounts,
  onPick,
  onClose,
  onOpenReferences,
  className = '',
}: {
  references: readonly CitableReference[];
  /** How often each key is already cited, shown beside it. */
  citedCounts: ReadonlyMap<string, number>;
  onPick: (citationKey: string) => void;
  onClose: () => void;
  /** Where to go to add a source when the one wanted is not in the list. */
  onOpenReferences: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? references.filter((reference) =>
          [
            reference.citationKey,
            reference.title,
            ...reference.authors,
            String(reference.year ?? ''),
          ]
            .join(' ')
            .toLowerCase()
            .includes(needle)
        )
      : references;
    return matching.slice(0, MAX_RESULTS);
  }, [references, query]);

  const pick = (index: number) => {
    const reference = results[index];
    if (reference) onPick(reference.citationKey);
  };

  return (
    <div
      ref={containerRef}
      className={`z-40 w-80 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              pick(active);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder={`Search ${references.length} references…`}
          aria-label="Search references to cite"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {references.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <BookMarked className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">This document has no references yet.</p>
          <button
            type="button"
            onClick={onOpenReferences}
            className="text-sm font-medium text-primary hover:underline"
          >
            Add references
          </button>
        </div>
      ) : (
        <div
          id={listId}
          role="listbox"
          aria-label="References"
          className="max-h-72 overflow-y-auto py-1"
        >
          {results.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">No references match.</p>
          )}
          {results.map((reference, index) => {
            const count = citedCounts.get(reference.citationKey) ?? 0;
            return (
              <div
                key={reference.citationKey}
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === active}
                onPointerMove={() => setActive(index)}
                onPointerDown={(event) => {
                  // Keep focus in the editor's selection until the pick.
                  event.preventDefault();
                  pick(index);
                }}
                className={`flex cursor-pointer flex-col gap-0.5 px-3 py-2 ${
                  index === active ? 'bg-primary-soft' : ''
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-accent-foreground">
                    {reference.citationKey}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 text-xs ${
                      count > 0 ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning'
                    }`}
                  >
                    {count > 0 ? `cited ×${count}` : 'uncited'}
                  </span>
                </span>
                <span className="line-clamp-1 text-sm font-medium">{reference.title}</span>
                <span className="text-xs text-muted-foreground">{authorLine(reference)}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="border-t border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        ↑↓ to move · ↵ to cite · Esc to close
      </p>
    </div>
  );
}
