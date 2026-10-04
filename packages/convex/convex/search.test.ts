import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { htmlToText, searchTextFor, snippetFor } from "./lib/searchText.js";
import { setupConvex, signedInAs, type TestConvex } from "./test.setup.js";

async function insertDocument(
  t: TestConvex,
  author: Id<"users">,
  fields: { title?: string; content: string; orgId?: string; updatedAt?: number }
) {
  return await t.run((ctx) =>
    ctx.db.insert("documents", {
      author,
      orgId: fields.orgId,
      title: fields.title ?? "Draft",
      slug: `doc-${Math.random().toString(36).slice(2)}`,
      status: false,
      content: fields.content,
      createdAt: Date.now(),
      updatedAt: fields.updatedAt ?? Date.now(),
    })
  );
}

const titles = (results: { document: { title: string } }[]) => results.map((r) => r.document.title);

describe("document search", () => {
  test("finds a document by words in its body, with an excerpt", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    await insertDocument(t, ada.userId, {
      title: "Paper A",
      content: "<p>We train a <strong>transformer</strong> on protein folding data.</p>",
    });
    await insertDocument(t, ada.userId, { title: "Paper B", content: "<p>Graph networks.</p>" });
    await t.mutation(internal.search._indexRecent, {});

    const results = await ada.as.query(api.search.documents, { query: "transformer" });

    expect(titles(results)).toEqual(["Paper A"]);
    expect(results[0]!.snippet).toContain("transformer on protein folding");
  });

  test("finds a document by its title", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    await insertDocument(t, ada.userId, { title: "Quantum Survey", content: "<p>Body</p>" });
    await t.mutation(internal.search._indexRecent, {});

    expect(titles(await ada.as.query(api.search.documents, { query: "quantum" }))).toEqual([
      "Quantum Survey",
    ]);
  });

  test("an edit is picked up by the next indexing run", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId, { content: "<p>old words</p>" });
    await t.mutation(internal.search._indexRecent, {});

    await ada.as.mutation(api.documents.updateDocument, { id: docId, content: "<p>fresh idea</p>" });
    await t.mutation(internal.search._indexRecent, {});

    expect(await ada.as.query(api.search.documents, { query: "fresh" })).toHaveLength(1);
    expect(await ada.as.query(api.search.documents, { query: "old" })).toHaveLength(0);
  });

  test("the backfill indexes documents too old for the regular job", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    await insertDocument(t, ada.userId, {
      content: "<p>ancient manuscript</p>",
      updatedAt: Date.now() - 365 * 24 * 3600 * 1000,
    });

    await t.mutation(internal.search._indexRecent, {});
    expect(await ada.as.query(api.search.documents, { query: "manuscript" })).toHaveLength(0);

    await t.mutation(internal.search._backfill, {});
    expect(await ada.as.query(api.search.documents, { query: "manuscript" })).toHaveLength(1);
  });

  test("queries shorter than two characters return nothing", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    await insertDocument(t, ada.userId, { content: "<p>a b c</p>" });
    await t.mutation(internal.search._indexRecent, {});

    expect(await ada.as.query(api.search.documents, { query: " a " })).toEqual([]);
  });
});

describe("search access", () => {
  test("other people's personal documents never appear", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const eve = await signedInAs(t, { clerkId: "user_eve" });
    await insertDocument(t, ada.userId, { content: "<p>secret findings</p>" });
    await t.mutation(internal.search._indexRecent, {});

    expect(await eve.as.query(api.search.documents, { query: "secret" })).toEqual([]);
  });

  test("an organization search covers members' documents, and only for members", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada", orgIds: ["org_lab"] });
    const bob = await signedInAs(t, { clerkId: "user_bob", orgIds: ["org_lab"] });
    const eve = await signedInAs(t, { clerkId: "user_eve" });
    await insertDocument(t, ada.userId, { content: "<p>shared results</p>", orgId: "org_lab" });
    await t.mutation(internal.search._indexRecent, {});

    expect(await bob.as.query(api.search.documents, { query: "shared", orgId: "org_lab" })).toHaveLength(1);
    expect(await eve.as.query(api.search.documents, { query: "shared", orgId: "org_lab" })).toEqual([]);
    // The personal workspace does not show organization documents.
    expect(await ada.as.query(api.search.documents, { query: "shared" })).toEqual([]);
  });

  test("documents in the bin are left out, and come back when restored", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId, { content: "<p>binned thoughts</p>" });
    await t.mutation(internal.search._indexRecent, {});

    await ada.as.mutation(api.trash.moveToTrash, { id: docId });
    expect(await ada.as.query(api.search.documents, { query: "binned" })).toEqual([]);

    await ada.as.mutation(api.trash.restore, { id: docId });
    expect(await ada.as.query(api.search.documents, { query: "binned" })).toHaveLength(1);
  });

  test("deleting a document forever removes its search row", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId, { content: "<p>gone</p>" });
    await t.mutation(internal.search._indexRecent, {});

    await t.run(async (ctx) => {
      const { cascadeDeleteDocument } = await import("./lib/cascade.js");
      await cascadeDeleteDocument(ctx, docId);
    });

    expect(await t.run((ctx) => ctx.db.query("documentSearch").collect())).toEqual([]);
  });
});

describe("search text", () => {
  test("strips markup and decodes entities", () => {
    expect(htmlToText("<h1>R&amp;D</h1><p>caf&eacute; &#8212; 5&nbsp;%</p><script>x()</script>")).toBe(
      "R&D caf&eacute; — 5 %"
    );
  });

  test("the title is searchable along with the body, and length is capped", () => {
    expect(searchTextFor("Title", "<p>Body</p>")).toBe("Title\nBody");
    expect(searchTextFor("T", `<p>${"word ".repeat(50_000)}</p>`).length).toBe(100_000);
  });

  test("the snippet centres on the first matching word, in whole words", () => {
    const text = `Title\n${"filler ".repeat(40)}the key finding is here ${"tail ".repeat(40)}`;
    const snippet = snippetFor(text, "finding", 20);
    expect(snippet).toMatch(/^…/);
    expect(snippet).toMatch(/…$/);
    expect(snippet).toContain("the key finding is here");
    expect(snippet).not.toContain("Title");
  });

  test("with no match in the body, the snippet is the opening", () => {
    expect(snippetFor("Quantum\nShort body.", "quantum")).toBe("Short body.");
  });
});
