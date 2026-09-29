import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { setupConvex, signedInAs, type TestConvex } from "./test.setup.js";

async function insertDocument(
  t: TestConvex,
  author: Id<"users">,
  fields: { slug: string; orgId?: string }
) {
  return await t.run((ctx) =>
    ctx.db.insert("documents", {
      author,
      orgId: fields.orgId,
      title: "Draft",
      slug: fields.slug,
      status: false,
      content: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
}

const comment = { threadId: "th_1", commentId: "cm_1", text: "Needs a citation" };

describe("comments access control", () => {
  test("the author can comment on and read their own document, by id or slug", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada", name: "Ada" });
    const docId = await insertDocument(t, ada.userId, { slug: "ada-draft" });

    await ada.as.mutation(api.comments.saveComment, { documentId: docId, ...comment });

    const bySlug = await ada.as.query(api.comments.getByDocumentId, { documentId: "ada-draft" });
    expect(bySlug).toHaveLength(1);
    expect(bySlug[0]).toMatchObject({ text: "Needs a citation", senderName: "Ada" });

    const byId = await ada.as.query(api.comments.getByDocumentId, { documentId: docId });
    expect(byId).toHaveLength(1);
  });

  test("saving a comment counts towards the author's contribution", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const docId = await insertDocument(t, ada.userId, { slug: "ada-draft" });

    await ada.as.mutation(api.comments.saveComment, { documentId: docId, ...comment });

    const stats = await t.run((ctx) => ctx.db.query("contributionStats").collect());
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ userId: ada.userId, comments: 1 });
  });

  test("an outsider cannot read or write comments on a private document", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });
    const mallory = await signedInAs(t, { clerkId: "user_mallory" });
    const docId = await insertDocument(t, ada.userId, { slug: "ada-draft" });

    await expect(
      mallory.as.mutation(api.comments.saveComment, { documentId: docId, ...comment })
    ).rejects.toThrow(/Forbidden/);
    await expect(
      mallory.as.query(api.comments.getByDocumentId, { documentId: "ada-draft" })
    ).rejects.toThrow(/Forbidden/);
  });

  test("members of the document's organization share access", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada", orgIds: ["org_lab"] });
    const grace = await signedInAs(t, { clerkId: "user_grace", orgIds: ["org_lab"] });
    const docId = await insertDocument(t, ada.userId, { slug: "lab-paper", orgId: "org_lab" });

    await grace.as.mutation(api.comments.saveComment, { documentId: docId, ...comment });

    const rows = await ada.as.query(api.comments.getByDocumentId, { documentId: docId });
    expect(rows).toHaveLength(1);
  });

  test("an unknown document reference is reported as not found", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada" });

    await expect(
      ada.as.query(api.comments.getByDocumentId, { documentId: "no-such-slug" })
    ).rejects.toThrow(/Document not found/);
  });
});

describe("comments.syncComments", () => {
  test("mirrors each Liveblocks comment once and resolves sender names", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada", name: "Ada" });
    const docId = await insertDocument(t, ada.userId, { slug: "ada-draft" });

    const payload = {
      documentId: docId,
      comments: [
        { ...comment, senderId: "user_ada" },
        { threadId: "th_1", commentId: "cm_2", text: "Agreed", senderId: "user_gone" },
      ],
    };
    await ada.as.mutation(api.comments.syncComments, payload);
    await ada.as.mutation(api.comments.syncComments, payload);

    const rows = await ada.as.query(api.comments.getByDocumentId, { documentId: docId });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.senderName).sort()).toEqual(["Ada", "Anonymous"]);
  });
});
