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
  ListOrdered,
  Loader2,
  Plus,
  Quote,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { yearSuffixes } from '../lib/authorDate';
import {
  type CitationStyle,
  formatReference,
  isAuthorDateStyle,
  isNumberedStyle,
  type ReferenceSegment,
  type ReferenceType,
} from '../lib/citationFormat';
import { orderBibliography } from '../lib/citationNumbering';

interface ReferencesPanelProps {
  documentId: any;
  citationStyle?: CitationStyle;
  /** Provided by the editor page; absent when the editor has not mounted yet. */
  onInsertCitation?: (citationKey: string) => void;
  /**
   * Citation keys in the order the document first cites them, from the editor.
   *
   * IEEE numbers its reference list by first appearance rather than
   * alphabetically, so the order the list is displayed in is a fact about the
   * text and has to come from there.
   */
  citationOrder?: readonly string[];
  /**
   * Puts a References section into the document. Absent when the editor has
   * not mounted yet, the same as `onInsertCitation`.
   */
  onInsertBibliography?: () => void;
  /** True once the document has a References section, so the button can say so. */
  hasBibliography?: boolean;
}

/**
 * The manual entry form, as strings — every field arrives from an `<input>`,
 * and the numbers are parsed only on submission so that a half-typed year is
 * not repeatedly coerced to something the author did not mean.
 */
interface ManualEntry {
  type: ReferenceType;
  title: string;
  authors: string;
  year: string;
  month: string;
  venue: string;
  publisher: string;
  address: string;
  volume: string;
  number: string;
  pages: string;
  doi: string;
  url: string;
  accessed: string;
  edition: string;
  editors: string;
  authorAbbreviation: string;
}

const EMPTY_MANUAL: ManualEntry = {
  type: 'article',
  title: '',
  authors: '',
  year: '',
  month: '',
  venue: '',
  publisher: '',
  address: '',
  volume: '',
  number: '',
  pages: '',
  doi: '',
  url: '',
  accessed: '',
  edition: '',
  editors: '',
  authorAbbreviation: '',
};

/**
 * What to ask for, per kind of source.
 *
 * Different source types need genuinely different information — a book has a
 * publisher and a city, a web page has a URL and the date it was read, a
 * journal article has a volume and a page range — and IEEE prints whichever
 * of those the type calls for. Asking for all of them at once would be a form
 * that is mostly blank whatever is being cited, so the type chooses.
 *
 * `venue` is labelled per type because it is the same field playing different
 * parts: the journal, the proceedings, the website, the awarding university.
 */
const MANUAL_FIELDS: Record<ReferenceType, { venueLabel?: string; fields: (keyof ManualEntry)[] }> =
  {
    article: {
      venueLabel: 'Journal name',
      fields: ['venue', 'volume', 'number', 'pages', 'doi'],
    },
    inproceedings: {
      venueLabel: 'Conference or proceedings name',
      fields: ['venue', 'editors', 'address', 'pages', 'doi'],
    },
    incollection: {
      venueLabel: 'Book title',
      fields: ['venue', 'editors', 'edition', 'publisher', 'address', 'pages', 'doi'],
    },
    book: {
      fields: ['edition', 'publisher', 'address', 'doi'],
    },
    techreport: {
      venueLabel: 'Institution',
      fields: ['venue', 'number', 'address'],
    },
    phdthesis: {
      venueLabel: 'University',
      fields: ['venue', 'address'],
    },
    misc: {
      venueLabel: 'Website name',
      fields: ['venue', 'url', 'accessed'],
    },
  };

const MANUAL_LABELS: Record<keyof ManualEntry, string> = {
  type: 'Type',
  title: 'Title',
  authors: 'Authors, comma separated',
  year: 'Year',
  month: 'Month',
  venue: 'Journal or conference',
  publisher: 'Publisher',
  address: 'City, state, country',
  volume: 'Volume',
  number: 'Issue or report number',
  pages: 'Pages, e.g. 403-417',
  doi: 'DOI',
  url: 'URL',
  accessed: 'Date accessed',
  edition: 'Edition, e.g. 5 or Rev.',
  editors: 'Editors, comma separated',
  authorAbbreviation: 'Group author abbreviation, e.g. NIMH (optional)',
};

const TYPE_LABELS: Record<ReferenceType, string> = {
  article: 'Journal article',
  inproceedings: 'Conference paper',
  incollection: 'Book chapter',
  book: 'Book',
  techreport: 'Report',
  phdthesis: 'Thesis',
  misc: 'Website or other',
};

/** BibTeX month macros, written unbraced so the .bst styles resolve them. */
const BIBTEX_MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Renders one entry, keeping the container title in italics. */
function ReferenceText({ segments }: { segments: ReferenceSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.italic ? (
          // Segments are positional and the list is re-rendered whole, so the
          // index is the only stable identity available here.
          // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
          <i key={index}>{segment.text}</i>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}

export function ReferencesPanel({
  documentId,
  citationStyle = 'numeric',
  onInsertCitation,
  citationOrder,
  onInsertBibliography,
  hasBibliography = false,
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
  const [manual, setManual] = useState<ManualEntry>({ ...EMPTY_MANUAL });

  const numbered = isNumberedStyle(citationStyle);
  const authorDate = isAuthorDateStyle(citationStyle);

  /**
   * Numbered styles: cited references first, in the order the text cites them;
   * anything the document never cites falls to the end without a number. IEEE
   * expects every listed reference to be cited, so that tail is a problem to
   * show the author rather than a section to number.
   *
   * Author–date styles: alphabetical, the order the printed list takes.
   */
  const ordered = useMemo(
    () => orderBibliography(references ?? [], citationOrder ?? [], citationStyle),
    [references, citationOrder, citationStyle]
  );

  /** "2020a" / "2020b", worked out over the whole list so the text agrees. */
  const suffixes = useMemo(
    () => (authorDate ? yearSuffixes(references ?? []) : new Map<string, string>()),
    [authorDate, references]
  );

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

    /** Only fields the chosen type asks for are saved, so switching type
        mid-entry cannot leave a stray volume number on a book. */
    const asked = new Set<keyof ManualEntry>(MANUAL_FIELDS[manual.type].fields);
    const text = (field: keyof ManualEntry) =>
      asked.has(field) ? manual[field].trim() || undefined : undefined;

    // The date input gives "2022-07-18", which parses as UTC midnight — the
    // same basis the access date is read back on.
    const accessedText = text('accessed');
    const accessed = accessedText ? Date.parse(accessedText) : undefined;

    try {
      await addReference({
        documentId,
        type: manual.type,
        title: manual.title.trim(),
        authors: manual.authors
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        year: manual.year ? Number(manual.year) : undefined,
        month: manual.month ? Number(manual.month) : undefined,
        venue: text('venue'),
        publisher: text('publisher'),
        address: text('address'),
        volume: text('volume'),
        number: text('number'),
        pages: text('pages'),
        doi: text('doi'),
        url: text('url'),
        edition: text('edition'),
        editors: (text('editors') ?? '')
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
        accessed: accessed !== undefined && !Number.isNaN(accessed) ? accessed : undefined,
        // Only an author–date style uses it, and only for a braced group author.
        authorAbbreviation: authorDate ? manual.authorAbbreviation.trim() || undefined : undefined,
        source: 'manual',
      });
      setManual({ ...EMPTY_MANUAL });
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
              r.venue
                ? `  ${r.type === 'inproceedings' || r.type === 'incollection' ? 'booktitle' : 'journal'} = {${r.venue}}`
                : '',
              r.publisher ? `  publisher = {${r.publisher}}` : '',
              r.address ? `  address   = {${r.address}}` : '',
              r.volume ? `  volume    = {${r.volume}}` : '',
              r.number ? `  number    = {${r.number}}` : '',
              r.pages ? `  pages     = {${r.pages}}` : '',
              r.year ? `  year      = {${r.year}}` : '',
              r.month ? `  month     = ${BIBTEX_MONTHS[r.month - 1]}` : '',
              r.doi ? `  doi       = {${r.doi}}` : '',
              r.url ? `  url       = {${r.url}}` : '',
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
            {/* The type comes first because it decides what the rest of the
                form asks for — and, in turn, how IEEE sets the entry. */}
            <select
              value={manual.type}
              onChange={(e) => setManual({ ...manual, type: e.target.value as ReferenceType })}
              aria-label={MANUAL_LABELS.type}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
            >
              {(Object.keys(TYPE_LABELS) as ReferenceType[]).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>

            <Input
              value={manual.title}
              onChange={(e) => setManual({ ...manual, title: e.target.value })}
              placeholder={MANUAL_LABELS.title}
              className="h-8 text-xs"
            />
            {authorDate && (
              <p className="text-[10px] leading-snug text-muted-foreground">
                APA prints titles in sentence case. Wrap a name in braces, e.g. {'{Freud}'}, to keep
                its capital. Enter a group author in braces too, e.g.{' '}
                {'{American Psychological Association}'}, so it is spelled out in full. A suffix
                goes after the name: Alexander C. Evans Jr.
              </p>
            )}
            <Input
              value={manual.authors}
              onChange={(e) => setManual({ ...manual, authors: e.target.value })}
              placeholder={MANUAL_LABELS.authors}
              className="h-8 text-xs"
            />
            {/* APA defines a group author's abbreviation at its first citation
                and uses it after that, so it is only asked for a group author. */}
            {authorDate && /^\s*\{[^{}]+\}\s*$/.test(manual.authors) && (
              <Input
                value={manual.authorAbbreviation}
                onChange={(e) => setManual({ ...manual, authorAbbreviation: e.target.value })}
                placeholder={MANUAL_LABELS.authorAbbreviation}
                className="h-8 text-xs"
              />
            )}

            <div className="flex gap-2">
              <Input
                value={manual.year}
                onChange={(e) => setManual({ ...manual, year: e.target.value })}
                placeholder={MANUAL_LABELS.year}
                type="number"
                className="h-8 text-xs w-24"
              />
              {/* IEEE prints the month before the year in a journal reference
                  ("Jun. 2014"), so it is worth asking for. */}
              <select
                value={manual.month}
                onChange={(e) => setManual({ ...manual, month: e.target.value })}
                aria-label={MANUAL_LABELS.month}
                className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              >
                <option value="">Month (optional)</option>
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {MANUAL_FIELDS[manual.type].fields.map((field) => (
              <Input
                key={field}
                value={manual[field]}
                onChange={(e) => setManual({ ...manual, [field]: e.target.value })}
                placeholder={
                  field === 'venue'
                    ? (MANUAL_FIELDS[manual.type].venueLabel ?? MANUAL_LABELS.venue)
                    : MANUAL_LABELS[field]
                }
                aria-label={
                  field === 'venue'
                    ? (MANUAL_FIELDS[manual.type].venueLabel ?? MANUAL_LABELS.venue)
                    : MANUAL_LABELS[field]
                }
                type={field === 'accessed' ? 'date' : 'text'}
                className="h-8 text-xs"
              />
            ))}

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

        {/* The bibliography is a panel; the References section is part of the
            paper. This is what puts one in the document — and it is offered
            here as well as in the toolbar because this is where an author is
            already thinking about their references. */}
        {onInsertBibliography && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full text-[11px]"
            onClick={onInsertBibliography}
            title={
              hasBibliography
                ? 'The document already has one — this goes to it'
                : 'Add a References section to the end of the document'
            }
          >
            <ListOrdered className="h-3 w-3 mr-1.5" />
            {hasBibliography ? 'Go to the References section' : 'Add a References section'}
          </Button>
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
          {ordered.map(({ reference, number, cited }) => (
            <li
              key={reference._id}
              className="group rounded-lg border border-border/70 bg-card p-2.5 space-y-1.5"
            >
              {/* Hanging indent: the bracketed number sits flush left and the
                  entry wraps against its own edge, as IEEE sets it. */}
              <div className="grid grid-cols-[auto_1fr] gap-x-1.5 text-[11px] leading-relaxed text-foreground">
                {numbered && (
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {number !== undefined ? `[${number}]` : '[–]'}
                  </span>
                )}
                <span className={numbered ? '' : 'col-span-2'}>
                  <ReferenceText
                    segments={formatReference(reference, citationStyle, {
                      yearSuffix: suffixes.get(reference.citationKey),
                    })}
                  />
                </span>
              </div>

              {!cited && (
                <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
                  <span>
                    {authorDate
                      ? 'Not cited in the text yet. APA Style expects every work in the reference list to be cited in the text.'
                      : numbered
                        ? 'Not cited in the text yet, so it has no number. IEEE numbers references in the order they are first cited.'
                        : 'Not cited in the text yet.'}
                  </span>
                </p>
              )}

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
