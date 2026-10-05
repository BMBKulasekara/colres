import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { cleanSectionTargets, daysUntil, deadlineLabel } from "./lib/goalPolicy.js";
import { setupConvex, signedInAs, type TestConvex } from "./test.setup.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 1, 8, 0, 0);

async function insertDocument(t: TestConvex, author: Id<"users">, fields: { orgId?: string; deadline?: number } = {}) {
  return await t.run((ctx) =>
    ctx.db.insert("documents", {
      author,
      title: "Thesis",
      slug: `doc-${Math.random().toString(36).slice(2)}`,
      status: false,
      content: "",
      createdAt: NOW - DAY,
      updatedAt: NOW - DAY,
      ...fields,
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("setting goals", () => {
  test("an editor sets, changes and clears goals without bumping updatedAt", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "ada" });
    const docId = await insertDocument(t, ada.userId);

    await ada.as.mutation(api.goals.setGoals, {
      documentId: docId,
      wordTarget: 8000,
      deadline: NOW + 10 * DAY,
      sectionTargets: [
        { title: " Introduction ", words: 800 },
        { title: "introduction", words: 900 },
        { title: "", words: 100 },
        { title: "Method", words: 0 },
      ],
    });
    let doc = await t.run((ctx) => ctx.db.get(docId));
    expect(doc).toMatchObject({
      wordTarget: 8000,
      deadline: NOW + 10 * DAY,
      sectionTargets: [{ title: "Introduction", words: 800 }],
      updatedAt: NOW - DAY,
    });

    // Fields left out are kept; null clears.
    await ada.as.mutation(api.goals.setGoals, { documentId: docId, wordTarget: null });
    doc = await t.run((ctx) => ctx.db.get(docId));
    expect(doc?.wordTarget).toBeUndefined();
    expect(doc?.deadline).toBe(NOW + 10 * DAY);
  });

  test("silly targets are refused", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "ada" });
    const docId = await insertDocument(t, ada.userId);
    await expect(ada.as.mutation(api.goals.setGoals, { documentId: docId, wordTarget: -5 })).rejects.toThrow(
      /word target/
    );
  });

  test("viewers cannot set goals", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "ada" });
    const sam = await signedInAs(t, { clerkId: "sam" });
    const docId = await insertDocument(t, ada.userId);
    await ada.as.mutation(api.sharing.invite, { documentId: docId, email: "sam@example.com", role: "viewer" });

    await expect(sam.as.mutation(api.goals.setGoals, { documentId: docId, wordTarget: 10 })).rejects.toThrow(
      /Forbidden/
    );
  });
});

describe("deadline reminders", () => {
  async function remindersFor(t: TestConvex, userId: Id<"users">) {
    return await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .collect()
    );
  }

  test("everyone on the document is reminded 3 days before, once", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "ada", orgIds: ["org_lab"] });
    const bob = await signedInAs(t, { clerkId: "bob", orgIds: ["org_lab"] });
    await t.run((ctx) =>
      ctx.db.insert("organizations", {
        clerkOrgId: "org_lab",
        name: "Lab",
        slug: "lab",
        ownerId: "ada",
        admins: ["ada"],
        members: ["ada", "bob"],
        createdAt: NOW,
        updatedAt: NOW,
      })
    );
    await insertDocument(t, ada.userId, { orgId: "org_lab", deadline: NOW + 2.5 * DAY });

    await t.mutation(internal.goals._remindDeadlines, {});
    for (const person of [ada, bob]) {
      const sent = await remindersFor(t, person.userId);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ kind: "deadline", actorName: "Colres", preview: "Due in 3 days" });
    }

    // A late run overlapping the same window does not repeat it.
    vi.setSystemTime(NOW + DAY / 4);
    await t.mutation(internal.goals._remindDeadlines, {});
    expect(await remindersFor(t, ada.userId)).toHaveLength(1);

    // Two days later it is due within a day: the last reminder.
    vi.setSystemTime(NOW + 2 * DAY);
    await t.mutation(internal.goals._remindDeadlines, {});
    const sent = await remindersFor(t, ada.userId);
    expect(sent.map((n) => n.preview)).toEqual(["Due in 3 days", "Due within a day"]);
  });

  test("no reminder far from the deadline, after it, or for binned documents", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "ada" });
    await insertDocument(t, ada.userId, { deadline: NOW + 5 * DAY });
    await insertDocument(t, ada.userId, { deadline: NOW - DAY });
    const binned = await insertDocument(t, ada.userId, { deadline: NOW + 0.5 * DAY });
    await ada.as.mutation(api.trash.moveToTrash, { id: binned });

    await t.mutation(internal.goals._remindDeadlines, {});
    expect(await remindersFor(t, ada.userId)).toEqual([]);
  });
});

test("goal rules", () => {
  expect(daysUntil(NOW + 2.5 * DAY, NOW)).toBe(3);
  expect(deadlineLabel(NOW + 0.9 * DAY, NOW)).toBe("Due within a day");
  expect(deadlineLabel(NOW + 1.5 * DAY, NOW)).toBe("Due in 2 days");
  expect(deadlineLabel(NOW - 2 * DAY, NOW)).toBe("2 days overdue");
  expect(cleanSectionTargets([])).toBeUndefined();
});
