import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { canManageSharing, roleAllows } from "./lib/sharing.js";
import { setupConvex, signedInAs, type TestConvex } from "./test.setup.js";

async function insertDocument(t: TestConvex, author: Id<"users">, orgId?: string) {
  return await t.run((ctx) =>
    ctx.db.insert("documents", {
      author,
      orgId,
      title: "Draft",
      slug: `doc-${Math.random().toString(36).slice(2)}`,
      status: false,
      content: "<p>Hello</p>",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
}

/** Ada owns a personal document and shares it; Sam is the outsider it is shared with. */
async function setup(role?: "editor" | "commenter" | "viewer") {
  const t = setupConvex();
  const ada = await signedInAs(t, { clerkId: "user_ada", name: "Ada" });
  const sam = await signedInAs(t, { clerkId: "user_sam", name: "Sam" });
  const docId = await insertDocument(t, ada.userId);
  if (role) {
    await ada.as.mutation(api.sharing.invite, {
      documentId: docId,
      email: "User_Sam@Example.com ",
      role,
    });
  }
  return { t, ada, sam, docId };
}

/** One representative action at each access level. */
const actions = (docId: Id<"documents">) => ({
  view: (as: Awaited<ReturnType<typeof setup>>["sam"]["as"]) =>
    as.query(api.references.listReferences, { documentId: docId }),
  comment: (as: Awaited<ReturnType<typeof setup>>["sam"]["as"]) =>
    as.mutation(api.chats.sendMessage, { documentId: docId, text: "hi" }),
  edit: (as: Awaited<ReturnType<typeof setup>>["sam"]["as"]) =>
    as.mutation(api.documents.updateDocument, { id: docId, content: "<p>changed</p>" }),
});

describe("what each shared role can do", () => {
  test.each([
    ["viewer", { view: true, comment: false, edit: false }],
    ["commenter", { view: true, comment: true, edit: false }],
    ["editor", { view: true, comment: true, edit: true }],
  ] as const)("%s", async (role, expected) => {
    const { sam, docId } = await setup(role);
    const act = actions(docId);
    for (const level of ["view", "comment", "edit"] as const) {
      const attempt = act[level](sam.as);
      if (expected[level]) await expect(attempt).resolves.not.toThrow();
      else await expect(attempt).rejects.toThrow(/Forbidden/);
    }
  });

  test("someone it is not shared with can do nothing", async () => {
    const { sam, docId } = await setup();
    const act = actions(docId);
    for (const level of ["view", "comment", "edit"] as const) {
      await expect(act[level](sam.as)).rejects.toThrow(/Forbidden/);
    }
    expect(await sam.as.query(api.documents.getDocumentById, { id: docId })).toBeNull();
  });

  test("a viewer can open the document and read its history, but not restore", async () => {
    const { ada, sam, docId } = await setup("viewer");
    const versionId = await ada.as.mutation(api.versions.saveNamed, { documentId: docId, name: "v1" });

    expect(await sam.as.query(api.documents.getDocumentById, { id: docId })).not.toBeNull();
    expect(await sam.as.query(api.versions.list, { documentId: docId })).toHaveLength(1);
    await expect(sam.as.query(api.versions.get, { versionId })).resolves.toBeTruthy();
    await expect(sam.as.mutation(api.versions.prepareRestore, { versionId })).rejects.toThrow(
      /Forbidden/
    );
  });

  test("the organization's members keep full access, unchanged by sharing", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada", orgIds: ["org_lab"] });
    const bob = await signedInAs(t, { clerkId: "user_bob", orgIds: ["org_lab"] });
    const docId = await insertDocument(t, ada.userId, "org_lab");

    await actions(docId).edit(bob.as);
    expect(await bob.as.query(api.sharing.myRole, { documentId: docId })).toEqual({
      role: "member",
      canManage: true,
    });
  });

  test("access ends when the document is binned", async () => {
    const { ada, sam, docId } = await setup("editor");
    await ada.as.mutation(api.trash.moveToTrash, { id: docId });

    await expect(actions(docId).view(sam.as)).rejects.toThrow();
    expect(await sam.as.query(api.sharing.sharedWithMe, {})).toEqual([]);
  });
});

describe("managing sharing", () => {
  test("invites match emails case-insensitively, and re-inviting changes the role", async () => {
    const { ada, sam, docId } = await setup("viewer");
    await ada.as.mutation(api.sharing.invite, { documentId: docId, email: "user_sam@example.com", role: "editor" });

    const members = await ada.as.query(api.sharing.listMembers, { documentId: docId });
    expect(members).toEqual([
      expect.objectContaining({ email: "user_sam@example.com", role: "editor", name: "Sam", hasAccount: true }),
    ]);
    expect(await sam.as.query(api.sharing.myRole, { documentId: docId })).toEqual({
      role: "editor",
      canManage: false,
    });
  });

  test("an invite for someone without an account starts working when they sign up", async () => {
    const { t, ada, docId } = await setup();
    await ada.as.mutation(api.sharing.invite, { documentId: docId, email: "new@example.com", role: "viewer" });

    const [pending] = await ada.as.query(api.sharing.listMembers, { documentId: docId });
    expect(pending).toMatchObject({ hasAccount: false });

    const newcomer = await signedInAs(t, { clerkId: "new" });
    await t.run((ctx) => ctx.db.patch(newcomer.userId, { email: "new@example.com" }));
    expect(await newcomer.as.query(api.sharing.myRole, { documentId: docId })).toMatchObject({ role: "viewer" });
  });

  test("invited people, even editors, cannot share it further", async () => {
    const { sam, docId } = await setup("editor");
    await expect(
      sam.as.mutation(api.sharing.invite, { documentId: docId, email: "x@example.com", role: "viewer" })
    ).rejects.toThrow(/only the author and organization members/);
  });

  test("bad emails and people who already have access are refused", async () => {
    const t = setupConvex();
    const ada = await signedInAs(t, { clerkId: "user_ada", orgIds: ["org_lab"] });
    await signedInAs(t, { clerkId: "user_bob", orgIds: ["org_lab"] });
    const docId = await insertDocument(t, ada.userId, "org_lab");
    const invite = (email: string) =>
      ada.as.mutation(api.sharing.invite, { documentId: docId, email, role: "viewer" });

    await expect(invite("not-an-email")).rejects.toThrow(/valid email/);
    await expect(invite("user_ada@example.com")).rejects.toThrow(/You already have access/);
    await expect(invite("user_bob@example.com")).rejects.toThrow(/through the organization/);
  });

  test("a manager can change a role and remove someone; people can remove themselves", async () => {
    const { ada, sam, docId } = await setup("viewer");
    const [member] = await ada.as.query(api.sharing.listMembers, { documentId: docId });

    await ada.as.mutation(api.sharing.setRole, { memberId: member!._id, role: "commenter" });
    expect(await sam.as.query(api.sharing.myRole, { documentId: docId })).toMatchObject({ role: "commenter" });

    await expect(sam.as.mutation(api.sharing.setRole, { memberId: member!._id, role: "editor" })).rejects.toThrow(
      /Forbidden/
    );

    await sam.as.mutation(api.sharing.remove, { memberId: member!._id });
    expect(await sam.as.query(api.sharing.myRole, { documentId: docId })).toBeNull();
  });

  test("shared documents are listed under Shared with me, with the role", async () => {
    const { sam, docId } = await setup("commenter");
    const shared = await sam.as.query(api.sharing.sharedWithMe, {});
    expect(shared.map((s) => [s.document._id, s.role])).toEqual([[docId, "commenter"]]);
  });

  test("shared people can be mentioned in the document's chat", async () => {
    const { ada, docId } = await setup("viewer");
    const people = await ada.as.query(api.chats.listCollaborators, { documentId: docId });
    expect(people.map((p) => p.name)).toEqual(["Ada", "Sam"]);
  });

  test("deleting the document forever removes its sharing", async () => {
    const { t, docId } = await setup("viewer");
    await t.run(async (ctx) => {
      const { cascadeDeleteDocument } = await import("./lib/cascade.js");
      await cascadeDeleteDocument(ctx, docId);
    });
    expect(await t.run((ctx) => ctx.db.query("documentMembers").collect())).toEqual([]);
  });
});

describe("live room access", () => {
  test("reports the role for the document's room, and nothing for others", async () => {
    const { ada, sam, docId } = await setup("viewer");

    expect(await sam.as.query(api.sharing.roomAccess, { room: docId })).toBe("viewer");
    expect(await ada.as.query(api.sharing.roomAccess, { room: docId })).toBe("owner");
    expect(await sam.as.query(api.sharing.roomAccess, { room: "not-a-document" })).toBeNull();
  });

  test("an outsider gets no room access", async () => {
    const { sam, docId } = await setup();
    expect(await sam.as.query(api.sharing.roomAccess, { room: docId })).toBeNull();
  });
});

test("role rules", () => {
  expect(roleAllows("viewer", "view")).toBe(true);
  expect(roleAllows("viewer", "comment")).toBe(false);
  expect(roleAllows("commenter", "comment")).toBe(true);
  expect(roleAllows("commenter", "edit")).toBe(false);
  expect(roleAllows("member", "edit")).toBe(true);
  expect(roleAllows(null, "view")).toBe(false);
  expect(canManageSharing("owner")).toBe(true);
  expect(canManageSharing("member")).toBe(true);
  expect(canManageSharing("editor")).toBe(false);
});
