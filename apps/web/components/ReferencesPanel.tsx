'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { useAction, useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  BookMarked,
  Check,
  Copy,
  Download,
  Loader2,
  Plus,
  Quote,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { type CitationStyle, formatReference, isNumberedStyle } from '../lib/citationFormat';

interface ReferencesPanelProps {
  documentId: any;
  citationStyle?: CitationStyle;
  /** Provided by the editor page; absent when the editor has not mounted yet. */
  onInsertCitation?: (citationKey: string) => void;
}

export function ReferencesPanel({
  documentId,
  citationStyle = 'numeric',
  onInsertCitation,
}: ReferencesPanelProps) {
  const references = useQuery(api.references.listReferences, { documentId });
  const addReference = useMutation(api.references.addReference);
  const deleteReference = useMutation(api.references.deleteReference);
  const lookupDoi = useAction(api.references.lookupDoi);

  const [doi, setDoi] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ title: '', authors: '', year: '', venue: '' });

  const numbered = isNumberedStyle(citationStyle);

  const handleDoiLookup = async () => {
    if (!doi.trim() || isLooking) return;
    setIsLooking(true);
    setError(null);
    try {
      const result = await lookupDoi({ doi });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await addReference({ documentId, ...result.reference, source: 'doi' });
      setDoi('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The lookup failed.');
    } finally {
      setIsLooking(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manual.title.trim()) {
      setError('A title is required.');
      return;
    }
    setError(null);
    try {
      await addReference({
        documentId,
        title: manual.title.trim(),
        authors: manual.authors
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        year: manual.year ? Number(manual.year) : undefined,
        venue: manual.venue.trim() || undefined,
        source: 'manual',
      });
      setManual({ title: '', authors: '', year: '', venue: '' });
      setShowManual(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the reference.');
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Clipboard access can be denied; the key is visible on screen regardless.
    }
  };

  const handleDownloadBib = () => {
    if (!references) return;
    // Built client-side from what is already loaded, so no extra round trip.
    const blob = new Blob(
      [
        references
          .map((r) => {
            const fields = [
              r.authors.length ? `  author    = {${r.authors.join(' and ')}}` : '',
              `  title     = {${r.title}}`,
              r.venue ? `  journal   = {${r.venue}}` : '',
              r.year ? `  year      = {${r.year}}` : '',
              r.doi ? `  doi       = {${r.doi}}` : '',
            ].filter(Boolean);
            return `@${r.type}{${r.citationKey},\n${fields.join(',\n')}\n}`;
          })
          .join('\n\n'),
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'refs.bib';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <BookMarked className="h-3.5 w-3.5" />
          Bibliography
          {references && <span className="font-mono normal-case">({references.length})</span>}
        </h3>
        {references && references.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={handleDownloadBib}
            title="Download refs.bib"
          >
            <Download className="h-3 w-3 mr-1" />
            .bib
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5">
          <div className="flex items-center gap-1.5 flex-1 rounded-lg border border-border bg-background px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDoiLookup()}
              placeholder="Paste a DOI to add a reference"
              className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground min-w-0"
            />
          </div>
          <Button
            size="sm"
            className="h-[34px] px-2.5"
            onClick={handleDoiLookup}
            disabled={isLooking || !doi.trim()}
          >
            {isLooking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] w-full justify-start text-muted-foreground"
          onClick={() => setShowManual((v) => !v)}
        >
          <Plus className="h-3 w-3 mr-1" />
          {showManual ? 'Cancel manual entry' : 'Add a reference manually'}
        </Button>

        {showManual && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-2.5">
            <Input
              value={manual.title}
              onChange={(e) => setManual({ ...manual, title: e.target.value })}
              placeholder="Title"
              className="h-8 text-xs"
            />
            <Input
              value={manual.authors}
              onChange={(e) => setManual({ ...manual, authors: e.target.value })}
              placeholder="Authors, comma separated"
              className="h-8 text-xs"
            />
            <div className="flex gap-2">
              <Input
                value={manual.year}
                onChange={(e) => setManual({ ...manual, year: e.target.value })}
                placeholder="Year"
                type="number"
                className="h-8 text-xs w-24"
              />
              <Input
                value={manual.venue}
                onChange={(e) => setManual({ ...manual, venue: e.target.value })}
                placeholder="Journal or conference"
                className="h-8 text-xs flex-1"
              />
            </div>
            <Button size="sm" className="h-7 text-[11px] w-full" onClick={handleManualAdd}>
              Add reference
            </Button>
          </div>
        )}

        {error && (
          <p className="text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1.5">
            {error}
          </p>
        )}
      </div>

      {references === undefined ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : references.length === 0 ? (
        <p className="text-center text-[11px] text-muted-foreground py-8 leading-relaxed">
          No references yet. Save a paper from the Research tab, paste a DOI, or add one by hand.
        </p>
      ) : (
        <ol className="space-y-2">
          {references.map((reference, index) => (
            <li
              key={reference._id}
              className="group rounded-lg border border-border/70 bg-card p-2.5 space-y-1.5"
            >
              <p className="text-[11px] leading-relaxed text-foreground">
                {numbered && (
                  <span className="font-mono text-muted-foreground mr-1">[{index + 1}]</span>
                )}
                {formatReference(reference, citationStyle)}
              </p>

              {reference.unprotectedCapitals.length > 0 && (
                <p
                  className="flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-500"
                  title="BibTeX styles lowercase title words unless their capitals are braced"
                >
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
                  <span>
                    Unbraced capitals may be lowercased on export:{' '}
                    {reference.unprotectedCapitals.join(', ')}
                  </span>
                </p>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopyKey(reference.citationKey)}
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy citation key"
                >
                  {copiedKey === reference.citationKey ? (
                    <Check className="h-2.5 w-2.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-2.5 w-2.5" />
                  )}
                  {reference.citationKey}
                </button>

                <span className="flex-1" />

                {onInsertCitation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] text-primary"
                    onClick={() => onInsertCitation(reference.citationKey)}
                    title="Insert a citation at the cursor"
                  >
                    <Quote className="h-2.5 w-2.5 mr-0.5" />
                    Cite
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteReference({ id: reference._id })}
                  title="Remove from bibliography"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
