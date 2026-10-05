'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { deadlineLabel } from '@repo/convex/goals/policy';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import type { Editor } from '@tiptap/core';
import { useMutation } from 'convex/react';
import { CalendarClock, Check, Loader2, Target } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import type { TemplateSection } from '../lib/documentOutline';
import { useDocumentOutline } from './editor/useDocumentOutline';

export interface DocumentGoals {
  wordTarget?: number;
  deadline?: number;
  sectionTargets?: { title: string; words: number }[];
}

const numberFormat = new Intl.NumberFormat();

/** "2026-11-30" in the viewer's own time zone, for a date input. */
function toDateInput(timestamp: number | undefined): string {
  if (timestamp === undefined) return '';
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The end of the chosen day in the viewer's time zone: due means "by tonight". */
function fromDateInput(value: string): number | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

const parseWords = (value: string) => {
  const words = Number(value.replace(/[,\s]/g, ''));
  return value.trim() && Number.isFinite(words) && words > 0 ? Math.round(words) : null;
};

/**
 * Writing goals: a word target for the whole document, a deadline, and a
 * target for each section. Everyone with access sees them in the outline;
 * anyone who can edit can change them. Everyone on the document is reminded
 * 7, 3 and 1 days before the deadline.
 */
export function GoalsPanel({
  documentId,
  goals,
  editor,
  templateSections,
  readOnly = false,
}: {
  documentId: Id<'documents'>;
  goals: DocumentGoals;
  editor: Editor | null;
  /** The template's sections with the current targets already merged in. */
  templateSections: readonly TemplateSection[];
  readOnly?: boolean;
}) {
  const setGoals = useMutation(api.goals.setGoals);
  const { outline } = useDocumentOutline(editor, templateSections);

  const [wordTarget, setWordTarget] = useState(goals.wordTarget ? String(goals.wordTarget) : '');
  const [deadline, setDeadline] = useState(toDateInput(goals.deadline));
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries((goals.sectionTargets ?? []).map((t) => [t.title, String(t.words)]))
  );
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Top-level sections of the document, plus any targeted section that is
  // not in it (yet), so a target is never hidden just because its heading is.
  const titles = [
    ...new Set([
      ...outline.sections.filter((s) => s.depth === 0).map((s) => s.title),
      ...(goals.sectionTargets ?? []).map((t) => t.title),
    ]),
  ];
  const wordsBySection = new Map(outline.sections.map((s) => [s.title, s.words]));
  const templateTarget = (title: string) =>
    templateSections.find((s) => s.title.toLowerCase() === title.toLowerCase())?.targetWords;

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setState('saving');
    setError(null);
    try {
      await setGoals({
        documentId,
        wordTarget: parseWords(wordTarget),
        deadline: fromDateInput(deadline),
        sectionTargets: Object.entries(sectionDrafts).flatMap(([title, value]) => {
          const words = parseWords(value);
          return words ? [{ title, words }] : [];
        }),
      });
      setState('saved');
    } catch (err) {
      setState('error');
      setError(
        err instanceof Error
          ? (err.message.match(/Error: ([^\n]+)/)?.[1] ?? 'Could not save the goals.')
          : 'Could not save the goals.'
      );
    }
  };

  const now = Date.now();

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5 text-xs">
      <fieldset disabled={readOnly} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-words" className="flex items-center gap-1.5 font-semibold">
            <Target className="size-3.5 text-primary" aria-hidden="true" />
            Word target for the document
          </label>
          <Input
            id="goal-words"
            inputMode="numeric"
            value={wordTarget}
            onChange={(e) => {
              setWordTarget(e.target.value);
              setState('idle');
            }}
            placeholder={
              outline.totalTarget
                ? `Template suggests ${numberFormat.format(outline.totalTarget)}`
                : 'e.g. 8000'
            }
            className="h-8 text-xs"
          />
          <p className="text-muted-foreground">
            {numberFormat.format(outline.totalWords)} words written so far.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-deadline" className="flex items-center gap-1.5 font-semibold">
            <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
            Submission deadline
          </label>
          <Input
            id="goal-deadline"
            type="date"
            value={deadline}
            onChange={(e) => {
              setDeadline(e.target.value);
              setState('idle');
            }}
            className="h-8 text-xs"
          />
          <p className="text-muted-foreground">
            {goals.deadline !== undefined
              ? `${deadlineLabel(goals.deadline, now)}. Everyone on the document is reminded 7, 3 and 1 days before.`
              : 'Everyone on the document is reminded 7, 3 and 1 days before.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-semibold">Section targets</p>
          {titles.length === 0 ? (
            <p className="text-muted-foreground">
              Add headings to the document to set a target for each section.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {titles.map((title) => {
                const suggested = templateTarget(title);
                return (
                  <li key={title} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{title}</span>
                      <span className="text-muted-foreground">
                        {numberFormat.format(wordsBySection.get(title) ?? 0)} words
                      </span>
                    </span>
                    <Input
                      inputMode="numeric"
                      aria-label={`Word target for ${title}`}
                      value={sectionDrafts[title] ?? ''}
                      onChange={(e) => {
                        setSectionDrafts((drafts) => ({ ...drafts, [title]: e.target.value }));
                        setState('idle');
                      }}
                      placeholder={suggested ? numberFormat.format(suggested) : '—'}
                      className="h-7 w-20 text-right text-xs"
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-muted-foreground">
            Leave a box empty to keep the template&rsquo;s target, if it has one.
          </p>
        </div>
      </fieldset>

      {readOnly ? (
        <p className="text-muted-foreground">Only people who can edit can change the goals.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={state === 'saving'}>
            {state === 'saving' ? <Loader2 className="animate-spin" /> : 'Save goals'}
          </Button>
          {state === 'saved' && (
            <span className="flex items-center gap-1 text-success">
              <Check className="size-3.5" aria-hidden="true" />
              Saved
            </span>
          )}
          {error && (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
