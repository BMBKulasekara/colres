/**
 * When automatic versions are taken and how long they are kept.
 *
 * Kept free of Convex so the rules can be tested on their own, like
 * `trashPolicy.ts`. Named versions and pre-restore versions are never pruned;
 * these rules apply to `auto` versions only.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How often the capture job runs. */
export const CAPTURE_INTERVAL_MINUTES = 10;

/**
 * How far back each run looks for edited documents. Longer than the interval,
 * so a run that starts late does not skip anything; repeats are harmless
 * because unchanged documents are not captured twice.
 */
export const CAPTURE_LOOKBACK_MS = 15 * MINUTE;

/** Every automatic version from the last two days is kept. */
export const KEEP_ALL_MS = 2 * DAY;

/** Older than that, one per day is kept, up to this age. */
export const KEEP_DAILY_MS = 90 * DAY;

export interface VersionStamp<Id> {
  _id: Id;
  createdAt: number;
}

/**
 * The automatic versions to delete: past two days old, all but the latest of
 * each UTC day; past 90 days, all of them.
 */
export function autoVersionsToPrune<Id>(versions: VersionStamp<Id>[], now: number): Id[] {
  const prune: Id[] = [];
  const latestPerDay = new Map<number, VersionStamp<Id>>();

  for (const version of versions) {
    const age = now - version.createdAt;
    if (age <= KEEP_ALL_MS) continue;
    if (age > KEEP_DAILY_MS) {
      prune.push(version._id);
      continue;
    }
    const day = Math.floor(version.createdAt / DAY);
    const kept = latestPerDay.get(day);
    if (!kept) {
      latestPerDay.set(day, version);
    } else if (version.createdAt > kept.createdAt) {
      prune.push(kept._id);
      latestPerDay.set(day, version);
    } else {
      prune.push(version._id);
    }
  }

  return prune;
}

/** Whether a document's current text differs from its last version. */
export function hasChangedSince(
  document: { title: string; content: string; updatedAt: number },
  latest: { title: string; content: string; createdAt: number } | null
): boolean {
  if (!latest) return document.content.trim() !== '';
  if (document.updatedAt <= latest.createdAt) return false;
  return document.content !== latest.content || document.title !== latest.title;
}
