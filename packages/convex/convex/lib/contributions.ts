import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";

export type ContributionDeltas = Partial<
  Pick<
    Doc<"contributionStats">,
    | "wordsAdded"
    | "charsAdded"
    | "charsDeleted"
    | "activeMinutes"
    | "references"
    | "comments"
    | "messages"
  >
>;

const COUNTERS = [
  "wordsAdded",
  "charsAdded",
  "charsDeleted",
  "activeMinutes",
  "references",
  "comments",
  "messages",
] as const;

/**
 * How much each signal is worth in the composite score. Writing is measured
 * per word, so the others are scaled to be comparable: one reference found
 * and added is worth roughly a short paragraph.
 */
export const SCORE_WEIGHTS = {
  wordsAdded: 1,
  activeMinutes: 2,
  references: 25,
  comments: 8,
  messages: 2,
} as const;

/** Days of daily history returned for the activity chart. */
const HISTORY_DAYS = 30;

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Adds `deltas` to today's row for this member and document. */
export async function bumpContribution(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  userId: Id<"users">,
  deltas: ContributionDeltas
) {
  const now = Date.now();
  const day = utcDay(now);
  const existing = await ctx.db
    .query("contributionStats")
    .withIndex("by_document_user_day", (q) =>
      q.eq("documentId", documentId).eq("userId", userId).eq("day", day)
    )
    .unique();

  if (existing) {
    const patch: Partial<Doc<"contributionStats">> = { lastActiveAt: now };
    for (const key of COUNTERS) {
      if (deltas[key]) patch[key] = existing[key] + (deltas[key] ?? 0);
    }
    await ctx.db.patch(existing._id, patch);
    return;
  }

  await ctx.db.insert("contributionStats", {
    documentId,
    userId,
    day,
    wordsAdded: deltas.wordsAdded ?? 0,
    charsAdded: deltas.charsAdded ?? 0,
    charsDeleted: deltas.charsDeleted ?? 0,
    activeMinutes: deltas.activeMinutes ?? 0,
    references: deltas.references ?? 0,
    comments: deltas.comments ?? 0,
    messages: deltas.messages ?? 0,
    lastActiveAt: now,
  });
}

/**
 * Per-member totals for a document, plus a daily series for the last
 * {@link HISTORY_DAYS} days. Shared by the member-facing and admin queries,
 * which differ only in who may call them.
 */
export async function summarizeDocument(ctx: QueryCtx, documentId: Id<"documents">) {
  const rows = await ctx.db
    .query("contributionStats")
    .withIndex("by_document_and_day", (q) => q.eq("documentId", documentId))
    .collect();

  const since = utcDay(Date.now() - (HISTORY_DAYS - 1) * 86_400_000);
  const byUser = new Map<Id<"users">, Omit<Doc<"contributionStats">, "_id" | "_creationTime" | "day" | "documentId"> & { activeDays: number }>();
  const daily = new Map<string, number>();

  for (const row of rows) {
    const total = byUser.get(row.userId) ?? {
      userId: row.userId,
      wordsAdded: 0,
      charsAdded: 0,
      charsDeleted: 0,
      activeMinutes: 0,
      references: 0,
      comments: 0,
      messages: 0,
      lastActiveAt: 0,
      activeDays: 0,
    };
    for (const key of COUNTERS) total[key] += row[key];
    total.lastActiveAt = Math.max(total.lastActiveAt, row.lastActiveAt);
    total.activeDays += 1;
    byUser.set(row.userId, total);

    if (row.day >= since) daily.set(row.day, (daily.get(row.day) ?? 0) + score(row));
  }

  const members = await Promise.all(
    [...byUser.values()].map(async (total) => {
      const user = await ctx.db.get(total.userId);
      return {
        ...total,
        name: user?.name ?? "Former member",
        imageUrl: user?.imageUrl ?? "",
        score: score(total),
      };
    })
  );
  const teamScore = members.reduce((sum, m) => sum + m.score, 0);

  const days: { day: string; score: number }[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const day = utcDay(Date.now() - i * 86_400_000);
    days.push({ day, score: daily.get(day) ?? 0 });
  }

  return {
    weights: SCORE_WEIGHTS,
    teamScore,
    members: members
      .map((m) => ({ ...m, share: teamScore ? m.score / teamScore : 0 }))
      .sort((a, b) => b.score - a.score),
    days,
  };
}

function score(row: Pick<Doc<"contributionStats">, keyof typeof SCORE_WEIGHTS>): number {
  let total = 0;
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    total += row[key as keyof typeof SCORE_WEIGHTS] * weight;
  }
  return Math.round(total);
}
