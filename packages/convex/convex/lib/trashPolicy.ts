/** How long a document stays in the bin before the daily clean-up erases it. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a document binned at `deletedAt` is erased. */
export function purgeTimeFor(deletedAt: number): number {
  return deletedAt + TRASH_RETENTION_MS;
}

/** Whole days until the clean-up, never negative. */
export function daysUntilPurge(purgeAt: number, now: number): number {
  return Math.max(0, Math.ceil((purgeAt - now) / DAY_MS));
}

/**
 * Who may erase a binned document for good.
 *
 * The author always may. In an organization, an admin may too, but only once
 * the author has left it: an author who is still there decides for themselves.
 * A personal document has nobody but its author.
 */
export function canDeleteForever(facts: {
  isAuthor: boolean;
  isPersonal: boolean;
  callerIsOrgAdmin: boolean;
  authorStillMember: boolean;
}): boolean {
  if (facts.isAuthor) return true;
  if (facts.isPersonal) return false;
  return facts.callerIsOrgAdmin && !facts.authorStillMember;
}
