'use client';

import { deadlineLabel } from '@repo/convex/goals/policy';
import { AlertTriangle, CalendarClock, Check } from 'lucide-react';
import type { BudgetTone, Outline, OutlineSection } from '../../lib/documentOutline';

const BAR_TONE: Record<BudgetTone, string> = {
  none: 'bg-primary/60',
  progress: 'bg-primary',
  met: 'bg-success',
  over: 'bg-warning',
};

const numberFormat = new Intl.NumberFormat();

interface DocumentOutlineProps {
  outline: Outline;
  currentSection: OutlineSection | null;
  floats: readonly { id: string; label: string; caption: string }[];
  uncitedFloatIds: ReadonlySet<string>;
  /** How many sources the text cites. */
  citedCount: number;
  onJumpToSection: (pos: number) => void;
  onJumpToFloat: (floatId: string) => void;
  /** The authors' own word target for the whole document. */
  wordTarget?: number;
  /** Submission deadline, epoch milliseconds. */
  deadline?: number;
}

/**
 * The left-hand outline: the document's sections with live word counts
 * against the template's budgets, then its figures and tables. A landmark
 * navigation region, so it can be reached directly with a screen reader.
 */
export function DocumentOutline({
  outline,
  currentSection,
  floats,
  uncitedFloatIds,
  citedCount,
  onJumpToSection,
  onJumpToFloat,
  wordTarget,
  deadline,
}: DocumentOutlineProps) {
  const { sections, totalWords, missing } = outline;
  // The authors' own target wins over the sum of the template's budgets.
  const totalTarget = wordTarget ?? outline.totalTarget;

  return (
    <nav aria-label="Document outline" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Outline
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {numberFormat.format(totalWords)}
          {totalTarget > 0 && ` / ${numberFormat.format(totalTarget)}`}
        </span>
      </div>

      {(wordTarget !== undefined || deadline !== undefined) && (
        <GoalSummary totalWords={totalWords} wordTarget={wordTarget} deadline={deadline} />
      )}

      {sections.length === 0 ? (
        <p className="px-4 py-2 text-sm text-muted-foreground">
          Headings you add appear here, with a word count for each section.
        </p>
      ) : (
        <ol className="flex flex-col gap-0.5 px-2">
          {sections.map((section) => (
            <li key={section.pos}>
              <SectionRow
                section={section}
                isCurrent={section === currentSection}
                onClick={() => onJumpToSection(section.pos)}
              />
            </li>
          ))}
        </ol>
      )}

      {missing.length > 0 && (
        <div className="mx-4 mt-3 rounded-md border border-warning/30 bg-warning/8 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <AlertTriangle className="size-3.5 text-warning" aria-hidden="true" />
            Required by the template
          </p>
          <ul className="mt-1 text-xs text-muted-foreground">
            {missing.map((section) => (
              <li key={section.key}>{section.title}</li>
            ))}
          </ul>
        </div>
      )}

      {citedCount > 0 && (
        <p className="mx-4 mt-3 flex justify-between border-t border-border pt-3 text-sm text-foreground">
          References
          <span className="text-xs text-muted-foreground">{citedCount} cited</span>
        </p>
      )}

      {floats.length > 0 && (
        <div className="mt-4 border-t border-border px-2 pt-3 pb-4">
          <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Figures &amp; tables
          </h2>
          <ul className="flex flex-col gap-0.5">
            {floats.map((float) => (
              <li key={float.id}>
                <button
                  type="button"
                  onClick={() => onJumpToFloat(float.id)}
                  className="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                >
                  <span className="shrink-0 font-medium">{float.label}</span>
                  <span className="truncate text-muted-foreground">{float.caption}</span>
                  {uncitedFloatIds.has(float.id) && (
                    <span className="ml-auto shrink-0 rounded-full bg-warning/12 px-1.5 text-xs text-warning">
                      not cited
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

/** The document's own goal: progress towards its word target, and its deadline. */
function GoalSummary({
  totalWords,
  wordTarget,
  deadline,
}: {
  totalWords: number;
  wordTarget?: number;
  deadline?: number;
}) {
  const progress = wordTarget ? Math.min(1, totalWords / wordTarget) : 0;
  const now = Date.now();
  const overdue = deadline !== undefined && deadline < now;
  const soon = deadline !== undefined && !overdue && deadline - now < 3 * 24 * 60 * 60 * 1000;

  return (
    <div className="mx-4 mb-3 flex flex-col gap-1.5 rounded-md bg-muted/60 px-3 py-2 text-xs">
      {wordTarget !== undefined && (
        <>
          <span className="flex justify-between text-muted-foreground">
            Word goal
            <span className="font-medium tabular-nums text-foreground">
              {Math.round(progress * 100)}%
            </span>
          </span>
          <span
            role="progressbar"
            aria-label="Progress towards the word goal"
            aria-valuemin={0}
            aria-valuemax={wordTarget}
            aria-valuenow={Math.min(totalWords, wordTarget)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-background"
          >
            <span
              className={`block h-full rounded-full ${progress >= 1 ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${progress * 100}%` }}
            />
          </span>
        </>
      )}
      {deadline !== undefined && (
        <span
          className={`flex items-center gap-1.5 ${overdue ? 'font-medium text-destructive' : soon ? 'font-medium text-warning' : 'text-muted-foreground'}`}
          title={new Date(deadline).toLocaleDateString(undefined, { dateStyle: 'full' })}
        >
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {deadlineLabel(deadline, now)}
        </span>
      )}
    </div>
  );
}

function SectionRow({
  section,
  isCurrent,
  onClick,
}: {
  section: OutlineSection;
  isCurrent: boolean;
  onClick: () => void;
}) {
  const { template, words, tone } = section;
  const target = template?.maxWords ?? template?.targetWords;
  const progress = target ? Math.min(1, words / target) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? 'location' : undefined}
      title={template?.guidance}
      className={`flex w-full flex-col gap-1 rounded-md py-1.5 pr-2 text-left transition-colors duration-150 ${
        isCurrent ? 'bg-primary-soft' : 'hover:bg-muted'
      }`}
      style={{ paddingLeft: `${0.5 + section.depth * 0.75}rem` }}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span
          className={`truncate text-sm ${section.depth === 0 ? 'font-medium' : ''} ${
            isCurrent ? 'text-accent-foreground' : 'text-foreground'
          }`}
        >
          {section.title}
        </span>
        <span
          className={`flex shrink-0 items-center gap-0.5 text-xs tabular-nums ${
            tone === 'over' ? 'font-medium text-warning' : 'text-muted-foreground'
          }`}
        >
          {tone === 'met' && <Check className="size-3 text-success" aria-label="On target" />}
          {tone === 'over' && <AlertTriangle className="size-3" aria-label="Over budget" />}
          {numberFormat.format(words)}
          {target !== undefined && `/${numberFormat.format(target)}`}
        </span>
      </span>
      {target !== undefined && (
        <span className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span
            className={`block h-full rounded-full ${BAR_TONE[tone]}`}
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      )}
    </button>
  );
}
