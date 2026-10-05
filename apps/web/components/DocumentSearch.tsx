'use client';

import { api } from '@repo/convex/_generated/api';
import type { Doc } from '@repo/convex/_generated/dataModel';
import { Input } from '@repo/ui/components/ui/input';
import { useQuery } from 'convex/react';
import { FileText, Loader2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { formatRelativeTime } from '../lib/relativeTime';

/** Wait this long after the last keystroke before asking the server. */
const DEBOUNCE_MS = 250;

/** The search box above the document list. */
export function DocumentSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder="Search titles and text…"
        aria-label="Search documents"
        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` with every query word wrapped in <mark>. */
function highlight(text: string, query: string): ReactNode {
  const terms = query.split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (terms.length === 0) return text;
  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts of one string never reorder.
      <mark key={i} className="rounded-sm bg-primary-soft px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

type Result = { document: Doc<'documents'>; snippet?: string };

/**
 * Results for the search box. Title matches come straight from the documents
 * already on the page, so they show at once; matches in the text come from
 * the server's index, which catches up a few minutes after a save.
 */
export function DocumentSearchResults({
  query,
  orgId,
  documents,
}: {
  query: string;
  orgId: string | undefined;
  /** The workspace's documents, already loaded by the page. */
  documents: Doc<'documents'>[];
}) {
  const debounced = useDebounced(query.trim(), DEBOUNCE_MS);
  const serverResults = useQuery(
    api.search.documents,
    debounced.length >= 2 ? { query: debounced, orgId } : 'skip'
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byTitle: Result[] = documents
      .filter((doc) => doc.title.toLowerCase().includes(needle))
      .map((document) => ({ document }));
    // A document matching both ways stays in its title position and gains
    // the server's excerpt.
    const merged = [...byTitle];
    for (const result of serverResults ?? []) {
      const existing = merged.find((r) => r.document._id === result.document._id);
      if (existing) existing.snippet = result.snippet;
      else merged.push(result);
    }
    return merged;
  }, [documents, serverResults, query]);

  const searching =
    query.trim().length >= 2 && (debounced !== query.trim() || serverResults === undefined);

  return (
    <section aria-labelledby="search-heading" className="flex flex-col gap-3">
      <h2
        id="search-heading"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {results.length} {results.length === 1 ? 'result' : 'results'}
        {searching && <Loader2 aria-label="Searching" className="size-3.5 animate-spin" />}
      </h2>

      {results.length === 0 && !searching ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No documents match &ldquo;{query.trim()}&rdquo;. Text saved in the last few minutes may
          not be searchable yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map(({ document, snippet }) => (
            <li key={document._id}>
              <Link
                href={`/docs/${document.slug}`}
                className="flex gap-3 rounded-lg border border-border bg-card p-4 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-foreground">
                    {highlight(document.title || 'Untitled Document', query.trim())}
                  </span>
                  {snippet && (
                    <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                      {highlight(snippet, query.trim())}
                    </span>
                  )}
                  <span className="mt-1.5 block text-xs text-muted-foreground">
                    Edited {formatRelativeTime(document.updatedAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
