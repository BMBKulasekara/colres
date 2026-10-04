'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import { useMutation } from 'convex/react';
import { Loader2, Upload, X } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';

type ImportResult = {
  added: number;
  duplicates: number;
  renamed: { from: string; to: string }[];
  errors: string[];
  skipped: number;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Imports a .bib file exported from Zotero, Mendeley, JabRef or Overleaf. The
 * server parses it, keeps the file's own citation keys where it can, and
 * skips entries the bibliography already has.
 */
export function BibImportButton({ documentId }: { documentId: Id<'documents'> }) {
  const importBibtex = useMutation(api.references.importBibtex);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setResult(null);
    setError(null);
    try {
      setResult(await importBibtex({ documentId, text: await file.text() }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('too large')
          ? 'This .bib file is too large to import (2 MB at most).'
          : 'Could not import this file. Check it is a .bib file and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[11px]"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Import a .bib file from Zotero, Mendeley or Overleaf"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : (
          <Upload className="h-3 w-3 mr-1" />
        )}
        Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".bib,.bibtex,text/x-bibtex,text/plain"
        className="hidden"
        onChange={handleFile}
      />

      {(result || error) && (
        <output
          className={`basis-full rounded-lg border p-2.5 text-[11px] leading-relaxed ${error ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-border bg-muted/40'}`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              {error ?? (
                <>
                  <p className="font-semibold text-foreground">
                    {result?.added
                      ? `Added ${plural(result.added, 'reference')}.`
                      : 'Nothing new to add.'}
                    {result?.duplicates
                      ? ` ${plural(result.duplicates, 'entry')} already in the bibliography.`
                      : ''}
                  </p>
                  {result?.renamed.length ? (
                    <p className="text-muted-foreground">
                      New keys, because these were taken:{' '}
                      {result.renamed.map((r) => `${r.from} → ${r.to}`).join(', ')}.
                    </p>
                  ) : null}
                  {result?.skipped ? (
                    <p className="text-muted-foreground">
                      Only the first 500 entries were imported; {result.skipped} were left out.
                    </p>
                  ) : null}
                  {result?.errors.length ? (
                    <details className="text-muted-foreground">
                      <summary className="cursor-pointer">
                        {plural(result.errors.length, 'entry')} could not be read
                      </summary>
                      <ul className="mt-1 list-disc pl-4">
                        {result.errors.slice(0, 20).map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </output>
      )}
    </>
  );
}
