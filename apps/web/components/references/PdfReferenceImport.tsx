'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { useAction, useMutation } from 'convex/react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Quote, X } from 'lucide-react';
import { type DragEvent, useId, useMemo, useRef, useState } from 'react';
import {
  CITATION_STYLE_LABELS,
  type CitationStyle,
  citationSystem,
  type DisplayReference,
  formatReference,
  type ReferenceSegment,
  type ReferenceType,
  surname,
} from '../../lib/citationFormat';
import { labelCitations } from '../../lib/citationLabels';
import { readPdf, validatePdfFile } from '../../lib/pdfExtract';
import {
  analyzePdf,
  type ExtractedFields,
  type FieldName,
  mergeRecord,
  type PdfAnalysis,
  pickMatchingRecord,
  reviewFields,
} from '../../lib/pdfReference';

interface PdfReferenceImportProps {
  documentId: any;
  citationStyle: CitationStyle;
  /** The document's other references, so the preview disambiguates as the text will. */
  references: readonly DisplayReference[];
  /** Absent until the editor has mounted; "Add & insert" is disabled without it. */
  onInsertCitation?: (citationKey: string) => void;
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string }
  | { kind: 'looking-up'; fileName: string }
  | {
      kind: 'review';
      fileName: string;
      analysis: PdfAnalysis;
      matchedBy: 'doi' | 'title' | null;
      offline: boolean;
    };

/** The review form, as strings: names one per line, numbers parsed on save. */
type Form = Record<
  | 'type'
  | 'title'
  | 'authors'
  | 'year'
  | 'month'
  | 'venue'
  | 'volume'
  | 'number'
  | 'pages'
  | 'doi'
  | 'publisher'
  | 'address'
  | 'url'
  | 'edition'
  | 'editors',
  string
>;

type FormKey = keyof Form;

const TYPE_LABELS: Record<ReferenceType, string> = {
  article: 'Journal article',
  inproceedings: 'Conference paper',
  book: 'Book',
  incollection: 'Book chapter',
  techreport: 'Report',
  phdthesis: 'Thesis or dissertation',
  misc: 'Web page or other',
};

/** Which fields to show for each kind of work, and what `venue` means for it. */
const TYPE_FIELDS: Record<ReferenceType, { venue?: string; number?: string; fields: FormKey[] }> = {
  article: {
    venue: 'Journal',
    number: 'Issue',
    fields: ['venue', 'volume', 'number', 'pages', 'doi', 'publisher', 'url'],
  },
  inproceedings: {
    venue: 'Proceedings title',
    fields: ['venue', 'editors', 'publisher', 'address', 'pages', 'doi'],
  },
  book: { fields: ['edition', 'publisher', 'address', 'doi', 'url'] },
  incollection: {
    venue: 'Book title',
    fields: ['venue', 'editors', 'edition', 'publisher', 'address', 'pages', 'doi'],
  },
  techreport: {
    venue: 'Institution',
    number: 'Report number',
    fields: ['venue', 'number', 'publisher', 'url'],
  },
  phdthesis: { venue: 'University', fields: ['venue', 'url'] },
  misc: { venue: 'Website name', fields: ['venue', 'url', 'publisher'] },
};

const LABELS: Record<FormKey, string> = {
  type: 'Type',
  title: 'Title',
  authors: 'Authors (one per line)',
  year: 'Year',
  month: 'Month',
  venue: 'Journal',
  volume: 'Volume',
  number: 'Issue',
  pages: 'Pages',
  doi: 'DOI',
  publisher: 'Publisher',
  address: 'Place of publication',
  url: 'URL',
  edition: 'Edition',
  editors: 'Editors (one per line)',
};

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

function formFromFields(fields: ExtractedFields): Form {
  const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));
  return {
    type: fields.type?.value ?? 'article',
    title: text(fields.title?.value),
    authors: (fields.authors?.value ?? []).join('\n'),
    year: text(fields.year?.value),
    month: text(fields.month?.value),
    venue: text(fields.venue?.value),
    volume: text(fields.volume?.value),
    number: text(fields.number?.value),
    pages: text(fields.pages?.value),
    doi: text(fields.doi?.value),
    publisher: text(fields.publisher?.value),
    address: text(fields.address?.value),
    url: text(fields.url?.value),
    edition: text(fields.edition?.value),
    editors: (fields.editors?.value ?? []).join('\n'),
  };
}

const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** The form as a reference, keeping only the fields its type uses. */
function referenceFromForm(form: Form, citationKey: string): DisplayReference {
  const type = form.type as ReferenceType;
  const shown = new Set<FormKey>([
    'title',
    'authors',
    'year',
    'month',
    ...TYPE_FIELDS[type].fields,
  ]);
  const value = (key: FormKey) => (shown.has(key) ? form[key].trim() || undefined : undefined);
  const year = Number(form.year);
  const month = Number(form.month);
  return {
    citationKey,
    type,
    title: form.title.trim(),
    authors: lines(form.authors),
    year: Number.isInteger(year) && year > 0 ? year : undefined,
    month: month >= 1 && month <= 12 ? month : undefined,
    venue: value('venue'),
    volume: value('volume'),
    number: value('number'),
    pages: value('pages'),
    doi: value('doi'),
    publisher: value('publisher'),
    address: value('address'),
    url: value('url'),
    edition: value('edition'),
    editors: shown.has('editors') ? lines(form.editors) : undefined,
  };
}

function Segments({ segments }: { segments: ReferenceSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.italic ? (
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

/** A small tag beside a field saying how far to trust it. */
function TrustBadge({
  state,
}: {
  state: 'verified' | 'likely' | 'uncertain' | 'missing' | 'edited';
}) {
  const styles = {
    verified: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-400',
    likely: 'text-sky-700 bg-sky-500/10 dark:text-sky-400',
    uncertain: 'text-amber-700 bg-amber-500/10 dark:text-amber-400',
    missing: 'text-red-700 bg-red-500/10 dark:text-red-400',
    edited: 'text-muted-foreground bg-muted',
  } as const;
  const text = {
    verified: 'Verified',
    likely: 'From PDF',
    uncertain: 'Check',
    missing: 'Missing',
    edited: 'Edited',
  } as const;
  return (
    <span
      className={`rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${styles[state]}`}
    >
      {text[state]}
    </span>
  );
}

/**
 * Upload a PDF, read its bibliographic details, and add it as a reference.
 *
 * The PDF is read in the browser. A DOI found in it is resolved with Crossref;
 * without one, the title found on the first page is searched for, and a
 * result is only taken when it is plainly the same work. The author then
 * reviews every field — each marked verified, read from the PDF, or to check
 * — sees the citation and reference-list entry in the document's style, and
 * adds it, optionally citing it at the cursor.
 */
export function PdfReferenceImport({
  documentId,
  citationStyle,
  references,
  onInsertCitation,
}: PdfReferenceImportProps) {
  const lookupDoi = useAction(api.references.lookupDoi);
  const searchWorksByTitle = useAction(api.references.searchWorksByTitle);
  const addReference = useMutation(api.references.addReference);

  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [form, setForm] = useState<Form | null>(null);
  const [edited, setEdited] = useState<Set<FormKey>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const reset = () => {
    setStage({ kind: 'idle' });
    setForm(null);
    setEdited(new Set());
    if (inputRef.current) inputRef.current.value = '';
  };

  const analyse = async (file: File) => {
    setError(null);
    setAdded(null);
    const problem = validatePdfFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    try {
      setStage({ kind: 'reading', fileName: file.name });
      let analysis = analyzePdf(await readPdf(file));

      setStage({ kind: 'looking-up', fileName: file.name });
      let matchedBy: 'doi' | 'title' | null = null;
      let offline = false;

      if (analysis.doi) {
        try {
          const result = await lookupDoi({ doi: analysis.doi });
          if (result.ok) {
            analysis = mergeRecord(analysis, result.reference);
            matchedBy = 'doi';
          }
        } catch {
          offline = true;
        }
      }

      const title = analysis.fields.title;
      if (!matchedBy && title && title.source !== 'file-name') {
        try {
          const firstAuthor = analysis.fields.authors?.value[0];
          const result = await searchWorksByTitle({
            title: title.value,
            author: firstAuthor ? surname(firstAuthor) : undefined,
          });
          const match = result.ok
            ? pickMatchingRecord(result.candidates, title.value, analysis.fields.year?.value)
            : undefined;
          if (match) {
            analysis = mergeRecord(analysis, match);
            matchedBy = 'title';
          }
        } catch {
          offline = true;
        }
      }

      setForm(formFromFields(analysis.fields));
      setEdited(new Set());
      setStage({ kind: 'review', fileName: file.name, analysis, matchedBy, offline });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The PDF could not be read.');
      reset();
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 1) {
      setError('Drop one PDF at a time.');
      return;
    }
    if (files[0]) void analyse(files[0]);
  };

  const review = stage.kind === 'review' ? stage : null;
  const type = (form?.type ?? 'article') as ReferenceType;

  /** Missing and to-check fields, recomputed as the author edits. */
  const checks = useMemo(() => {
    if (!review || !form) return { missing: new Set<FieldName>(), uncertain: new Set<FieldName>() };
    const draft = referenceFromForm(form, 'draft');
    const fields: ExtractedFields = {};
    for (const [key, value] of Object.entries(draft)) {
      if (key === 'citationKey') continue;
      const original = review.analysis.fields[key as FieldName];
      (fields as Record<string, unknown>)[key] = {
        value,
        source: original?.source ?? 'pdf-text',
        confidence: edited.has(key as FormKey) ? 'verified' : (original?.confidence ?? 'uncertain'),
      };
    }
    const result = reviewFields(fields);
    return { missing: new Set(result.missing), uncertain: new Set(result.uncertain) };
  }, [review, form, edited]);

  const trust = (
    key: FormKey
  ): 'verified' | 'likely' | 'uncertain' | 'missing' | 'edited' | null => {
    if (checks.missing.has(key as FieldName)) return 'missing';
    if (edited.has(key)) return 'edited';
    const confidence = review?.analysis.fields[key as FieldName]?.confidence;
    return confidence ?? null;
  };

  /** The citation and entry exactly as the document will show them. */
  const preview = useMemo(() => {
    if (!form || !form.title.trim()) return null;
    const draft = referenceFromForm(form, '__pdf-preview__');
    const all = [
      ...references.filter((reference) => reference.citationKey !== draft.citationKey),
      draft,
    ];
    const system = citationSystem(citationStyle);
    const cite = (narrative: boolean) =>
      labelCitations(
        [{ citationKey: draft.citationKey, adjacentToPrevious: false, narrative }],
        all,
        citationStyle
      ).labels[0];
    return {
      parenthetical: cite(false),
      narrative: system === 'numbered' ? undefined : cite(true),
      numbered: system === 'numbered',
      entry: formatReference(draft, citationStyle),
    };
  }, [form, references, citationStyle]);

  const save = async (insert: boolean) => {
    if (!form || !form.title.trim()) {
      setError('A title is required.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const { citationKey: _unused, ...reference } = referenceFromForm(form, '');
      const result = await addReference({
        documentId,
        ...reference,
        editors: reference.editors?.length ? reference.editors : undefined,
        source: 'pdf',
      });
      if (insert) onInsertCitation?.(result.citationKey);
      setAdded(
        insert
          ? `Added and cited as ${result.citationKey}.`
          : `Added to the references as ${result.citationKey}.`
      );
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The reference could not be added.');
    } finally {
      setIsSaving(false);
    }
  };

  const update = (key: FormKey, value: string) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setEdited((current) => new Set(current).add(key));
  };

  const fieldLabel = (key: FormKey) => {
    if (key === 'venue') return TYPE_FIELDS[type].venue ?? LABELS.venue;
    if (key === 'number') return TYPE_FIELDS[type].number ?? LABELS.number;
    return LABELS[key];
  };

  const renderField = (key: FormKey) => {
    if (!form) return null;
    const id = `${formId}-${key}`;
    const state = trust(key);
    const multiline = key === 'authors' || key === 'editors' || key === 'title';
    return (
      <div key={key} className="space-y-0.5">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"
        >
          {fieldLabel(key)}
          {state && <TrustBadge state={state} />}
        </label>
        {key === 'month' ? (
          <select
            id={id}
            value={form.month}
            onChange={(event) => update('month', event.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
          >
            <option value="">Not given</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            id={id}
            value={form[key]}
            onChange={(event) => update(key, event.target.value)}
            rows={key === 'title' ? 2 : Math.min(6, Math.max(2, lines(form[key]).length))}
            className={`w-full rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary ${
              state === 'missing'
                ? 'border-red-500/60'
                : state === 'uncertain'
                  ? 'border-amber-500/60'
                  : 'border-border'
            }`}
          />
        ) : (
          <Input
            id={id}
            value={form[key]}
            onChange={(event) => update(key, event.target.value)}
            inputMode={key === 'year' ? 'numeric' : undefined}
            className={`h-8 text-xs ${
              state === 'missing'
                ? 'border-red-500/60'
                : state === 'uncertain'
                  ? 'border-amber-500/60'
                  : ''
            }`}
          />
        )}
      </div>
    );
  };

  const busy = stage.kind === 'reading' || stage.kind === 'looking-up';

  return (
    <div className="space-y-2">
      {!review && (
        // biome-ignore lint/a11y/noStaticElementInteractions: the drop target; the button inside is the keyboard route
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => (busy ? event.preventDefault() : onDrop(event))}
          className={`rounded-lg border border-dashed p-3 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
          }`}
        >
          {busy ? (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {stage.kind === 'reading'
                ? `Reading ${stage.fileName}…`
                : 'Looking up the published record…'}
            </p>
          ) : (
            <>
              <FileUp className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Drop a PDF here to create a reference from it
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-[11px]"
                onClick={() => inputRef.current?.click()}
              >
                Choose a PDF
              </Button>
              <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                PDF, up to 25 MB. The file is read in your browser and is not uploaded.
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void analyse(file);
            }}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1 text-[11px] text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          {error}
        </p>
      )}
      {added && !review && (
        <output className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {added}
        </output>
      )}

      {review && form && (
        <div className="space-y-2.5 rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="truncate text-[11px] font-semibold text-foreground"
                title={review.fileName}
              >
                {review.fileName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {review.matchedBy === 'doi'
                  ? 'Matched to the published record by its DOI.'
                  : review.matchedBy === 'title'
                    ? 'Matched to the published record by its title. Check it is the same work.'
                    : review.offline
                      ? 'The publication database could not be reached, so these details come from the PDF alone.'
                      : 'No published record was found, so these details come from the PDF alone.'}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Discard this PDF"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {(checks.missing.size > 0 ||
            checks.uncertain.size > 0 ||
            review.analysis.warnings.length > 0) && (
            <ul className="space-y-1 rounded-md bg-amber-500/10 p-2 text-[10px] text-amber-800 dark:text-amber-300">
              {checks.missing.size > 0 && (
                <li>
                  Missing:{' '}
                  {[...checks.missing]
                    .map((name) => fieldLabel(name as FormKey).replace(/ \(.*\)$/, ''))
                    .join(', ')}
                  . Fill these in if the work has them.
                </li>
              )}
              {[...checks.uncertain].filter((name) => !edited.has(name as FormKey)).length > 0 && (
                <li>Fields marked “Check” were read from the page layout and may be wrong.</li>
              )}
              {review.analysis.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <div className="space-y-0.5">
              <label
                htmlFor={`${formId}-type`}
                className="text-[10px] font-medium text-muted-foreground"
              >
                Type
              </label>
              <select
                id={`${formId}-type`}
                value={form.type}
                onChange={(event) => update('type', event.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              >
                {(Object.keys(TYPE_LABELS) as ReferenceType[]).map((value) => (
                  <option key={value} value={value}>
                    {TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            {renderField('title')}
            {renderField('authors')}
            <div className="grid grid-cols-2 gap-2">
              {renderField('year')}
              {renderField('month')}
            </div>
            {TYPE_FIELDS[type].fields.map(renderField)}
          </div>

          {preview && (
            <div className="space-y-1 rounded-md border border-border bg-background p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {CITATION_STYLE_LABELS[citationStyle]} preview
              </p>
              <p className="text-[11px]">
                <span className="text-muted-foreground">In text: </span>
                {preview.parenthetical?.segments ? (
                  <Segments segments={preview.parenthetical.segments} />
                ) : (
                  preview.parenthetical?.text
                )}
                {preview.narrative && (
                  <>
                    <span className="text-muted-foreground"> or </span>
                    {preview.narrative.segments ? (
                      <Segments segments={preview.narrative.segments} />
                    ) : (
                      preview.narrative.text
                    )}
                  </>
                )}
              </p>
              {preview.numbered && (
                <p className="text-[10px] text-muted-foreground">
                  The number depends on where it is first cited in the text.
                </p>
              )}
              <p className="text-[11px] leading-relaxed pl-4 -indent-4">
                <Segments segments={preview.entry} />
              </p>
            </div>
          )}

          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex-1 text-[11px]"
              disabled={isSaving}
              onClick={() => save(false)}
            >
              Add reference
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 flex-1 text-[11px]"
              disabled={isSaving || !onInsertCitation}
              title={
                onInsertCitation
                  ? 'Add it and cite it at the cursor'
                  : 'Open the editor to insert citations'
              }
              onClick={() => save(true)}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Quote className="h-3 w-3 mr-1" />
              )}
              Add &amp; insert citation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
