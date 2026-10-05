import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { autoVersionsToPrune, hasChangedSince } from "./lib/versionPolicy.js";
import { setupConvex, signedInAs, type TestConvex } from "./test.setup.js";

const DAY = 24 * 60 * 60 * 1000;

async function insertDocument(
  t: TestConvex,
  author: Id<"users">,
  fields: { content?: string; orgId?: string; updatedAt?: number } = {}
) {
  return await t.run((ctx) =>
    ctx.db.insert("documents", {
      author,
      orgId: fields.orgId,
      title: "Draft",
      slug: `doc-${Math.random().toString(36).slice(2)}`,
      status: false,
      content: fields.content ?? "<p>First words</p>",
      createdAt: Date.now(),
      updatedAt: fields.updatedAt ?? Date.now(),
    })
  );
}

const versionsOf = (t: TestConvex, documentId: Id<"documents">) =>
  t.run((ctx) =>
    ctx.db
      .query("documentVersions")
      .withIndex("by_document_created", (q) => q.eq("documentId", documentId))
      .collect()
  );

describe("automatic capture", () => {
  test("captures an edited document once, then again only after it changes", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId);

    await t.mutation(internal.versions._captureRecent, {});
    await t.mutation(internal.versions._captureRecent, {});
    expect(await versionsOf(t, docId)).toHaveLength(1);

    await ada.as.mutation(api.documents.updateDocument, { id: docId, content: "<p>Second</p>" });
    await t.mutation(internal.versions._captureRecent, {});

    const versions = await versionsOf(t, docId);
    expect(versions.map((v) => v.content)).toEqual(["<p>First words</p>", "<p>Second</p>"]);
    expect(versions.every((v) => v.kind === "auto")).toBe(true);
  });

  test("skips documents not edited recently, empty ones, and ones in the bin", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const old = await insertDocument(t, ada.userId, { updatedAt: Date.now() - DAY });
    const empty = await insertDocument(t, ada.userId, { content: "" });
    const binned = await insertDocument(t, ada.userId);
    await ada.as.mutation(api.trash.moveToTrash, { id: binned });

    await t.mutation(internal.versions._captureRecent, {});

    expect(await versionsOf(t, old)).toHaveLength(0);
    expect(await versionsOf(t, empty)).toHaveLength(0);
    expect(await versionsOf(t, binned)).toHaveLength(0);
  });
});

describe("named versions and restore", () => {
  test("a named version holds the saved text and who saved it", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada", name: "Ada" });
    const docId = await insertDocument(t, ada.userId);

    await ada.as.mutation(api.versions.saveNamed, { documentId: docId, name: "  Submitted  " });

    const [listed] = await ada.as.query(api.versions.list, { documentId: docId });
    expect(listed).toMatchObject({ kind: "named", name: "Submitted", createdByName: "Ada", words: 2 });
    expect(listed).not.toHaveProperty("content");

    const full = await ada.as.query(api.versions.get, { versionId: listed!._id });
    expect(full.content).toBe("<p>First words</p>");
  });

  test("a blank name is refused", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId);

    await expect(
      ada.as.mutation(api.versions.saveNamed, { documentId: docId, name: "   " })
    ).rejects.toThrow(/name/);
  });

  test("renaming an automatic version makes it a named one", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId);
    await t.mutation(internal.versions._captureRecent, {});
    const [auto] = await versionsOf(t, docId);

    await ada.as.mutation(api.versions.rename, { versionId: auto!._id, name: "Draft 1" });

    expect(await t.run((ctx) => ctx.db.get(auto!._id))).toMatchObject({
      kind: "named",
      name: "Draft 1",
    });
  });

  test("restoring returns the old text and keeps the current text as a version", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId);
    const versionId = await ada.as.mutation(api.versions.saveNamed, { documentId: docId, name: "v1" });
    await ada.as.mutation(api.documents.updateDocument, { id: docId, content: "<p>Rewritten</p>" });

    const restored = await ada.as.mutation(api.versions.prepareRestore, { versionId });

    expect(restored).toEqual({ title: "Draft", content: "<p>First words</p>" });
    const kept = (await versionsOf(t, docId)).find((v) => v.kind === "restore");
    expect(kept).toMatchObject({ content: "<p>Rewritten</p>", name: 'Before restoring "v1"' });
  });

  test("restoring a version identical to the current text adds nothing", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId);
    const versionId = await ada.as.mutation(api.versions.saveNamed, { documentId: docId, name: "v1" });

    await ada.as.mutation(api.versions.prepareRestore, { versionId });

    expect(await versionsOf(t, docId)).toHaveLength(1);
  });
});

describe("access control", () => {
  test("someone outside the workspace cannot list, read, name or restore", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const eve = await signedInAs(t, { clerkId: "user_eve" });
    const docId = await insertDocument(t, ada.userId);
    const versionId = await ada.as.mutation(api.versions.saveNamed, { documentId: docId, name: "v1" });

    await expect(eve.as.query(api.versions.list, { documentId: docId })).rejects.toThrow(/Forbidden/);
    await expect(eve.as.query(api.versions.get, { versionId })).rejects.toThrow(/Forbidden/);
    await expect(
      eve.as.mutation(api.versions.saveNamed, { documentId: docId, name: "x" })
    ).rejects.toThrow(/Forbidden/);
    await expect(eve.as.mutation(api.versions.rename, { versionId, name: "x" })).rejects.toThrow(
      /Forbidden/
    );
    await expect(eve.as.mutation(api.versions.prepareRestore, { versionId })).rejects.toThrow(
      /Forbidden/
    );
  });

  test("organization members share a document's history", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada", orgIds: ["org_lab"] });
    const bob = await signedInAs(t, { clerkId: "user_bob", orgIds: ["org_lab"] });
    const docId = await insertDocument(t, ada.userId, { orgId: "org_lab" });
    await ada.as.mutation(api.versions.saveNamed, { documentId: docId, name: "v1" });

    expect(await bob.as.query(api.versions.list, { documentId: docId })).toHaveLength(1);
  });
});

test("deleting a document forever removes its versions", async () => {
  const t = setupConvex();
  const ada = await signedInAs(t, { clerkId: "user_ada" });
  const docId = await insertDocument(t, ada.userId);
  await ada.as.mutation(api.versions.saveNamed, { documentId: docId, name: "v1" });

  await t.run(async (ctx) => {
    const { cascadeDeleteDocument } = await import("./lib/cascade.js");
    await cascadeDeleteDocument(ctx, docId);
  });

  expect(await versionsOf(t, docId)).toHaveLength(0);
});

describe("retention rules", () => {
  const now = Date.UTC(2026, 5, 30, 12);
  const at = (id: string, msAgo: number) => ({ _id: id, createdAt: now - msAgo });

  test("keeps everything from the last two days", () => {
    expect(autoVersionsToPrune([at("a", 1000), at("b", DAY), at("c", 2 * DAY - 1)], now)).toEqual([]);
  });

  test("keeps the latest of each older day, and nothing past 90 days", () => {
    const day10 = 10 * DAY;
    const pruned = autoVersionsToPrune(
      [at("early", day10 + 3 * 3600_000), at("late", day10), at("ancient", 91 * DAY)],
      now
    );
    expect(pruned.sort()).toEqual(["ancient", "early"]);
  });

  test("a document counts as changed only when it was saved after its last version", () => {
    const latest = { title: "T", content: "a", createdAt: 100 };
    expect(hasChangedSince({ title: "T", content: "b", updatedAt: 50 }, latest)).toBe(false);
    expect(hasChangedSince({ title: "T", content: "a", updatedAt: 150 }, latest)).toBe(false);
    expect(hasChangedSince({ title: "T", content: "b", updatedAt: 150 }, latest)).toBe(true);
    expect(hasChangedSince({ title: "New", content: "a", updatedAt: 150 }, latest)).toBe(true);
    expect(hasChangedSince({ title: "T", content: " ", updatedAt: 1 }, null)).toBe(false);
  });
});
