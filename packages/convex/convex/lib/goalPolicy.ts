/**
 * Writing goals: limits on what can be set, and when deadline reminders go
 * out. Kept free of Convex so the web app and the tests can use it too.
 */

const DAY = 24 * 60 * 60 * 1000;

export const MAX_WORD_TARGET = 500_000;
export const MAX_SECTION_TARGETS = 50;
const MAX_SECTION_TITLE = 120;

/**
 * Reminders go out this many days before a deadline. The reminder job runs
 * once a day and looks at a one-day window for each, so each is sent once.
 */
export const REMINDER_DAYS = [7, 3, 1] as const;

export interface SectionTarget {
  title: string;
  words: number;
}

/** A word target, or undefined to clear it. Rejects nonsense values. */
export function cleanWordTarget(words: number | undefined): number | undefined {
  if (words === undefined || words === 0) return undefined;
  if (!Number.isFinite(words) || words < 0 || words > MAX_WORD_TARGET) {
    throw new Error(`A word target must be between 1 and ${MAX_WORD_TARGET.toLocaleString()}`);
  }
  return Math.round(words);
}

/** Section targets with blank titles and empty targets dropped, one per title. */
export function cleanSectionTargets(targets: SectionTarget[]): SectionTarget[] | undefined {
  const seen = new Set<string>();
  const cleaned: SectionTarget[] = [];
  for (const target of targets) {
    const title = target.title.trim().slice(0, MAX_SECTION_TITLE);
    const words = cleanWordTarget(target.words);
    const key = title.toLowerCase();
    if (!title || words === undefined || seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ title, words });
  }
  if (cleaned.length > MAX_SECTION_TARGETS) {
    throw new Error(`At most ${MAX_SECTION_TARGETS} section targets`);
  }
  return cleaned.length ? cleaned : undefined;
}

/**
 * Whole days from `now` to `deadline`, rounded up: 1 means "due within the
 * next 24 hours", 0 or less means it has passed.
 */
export function daysUntil(deadline: number, now: number): number {
  return Math.ceil((deadline - now) / DAY);
}

/**
 * The windows the daily reminder job searches: deadlines that are between
 * `days - 1` and `days` days away, for each reminder day.
 */
export function reminderWindows(now: number): { days: number; from: number; to: number }[] {
  return REMINDER_DAYS.map((days) => ({ days, from: now + (days - 1) * DAY, to: now + days * DAY }));
}

/**
 * "Due in 3 days", "Due within a day", "2 days overdue". Counted in 24-hour
 * steps rather than calendar days, so it reads the same in every time zone.
 */
export function deadlineLabel(deadline: number, now: number): string {
  const days = daysUntil(deadline, now);
  if (deadline < now) {
    const late = Math.max(1, Math.floor((now - deadline) / DAY));
    return late === 1 ? '1 day overdue' : `${late} days overdue`;
  }
  if (days <= 1) return 'Due within a day';
  return `Due in ${days} days`;
}
