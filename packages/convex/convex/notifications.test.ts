import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api.js";
import { commentBodyText, previewOf } from "./lib/notify.js";
import { setupConvex, signedInAs } from "./test.setup.js";

/** Ada and Bob share an organization and a document in it. */
async function setup() {
  const t = setupConvex();
  const ada = await signedInAs(t, { clerkId: "user_ada", name: "Ada", orgIds: ["org_lab"] });
  const bob = await signedInAs(t, { clerkId: "user_bob", name: "Bob", orgIds: ["org_lab"] });
  await t.run((ctx) =>
    ctx.db.insert("organizations", {
      clerkOrgId: "org_lab",
      name: "Lab",
      slug: "lab",
      ownerId: "user_ada",
      admins: ["user_ada"],
      members: ["user_ada", "user_bob"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
  const docId = await t.run((ctx) =>
    ctx.db.insert("documents", {
      author: ada.userId,
      orgId: "org_lab",
      title: "Our Paper",
      slug: "our-paper",
      status: false,
      content: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
  return { t, ada, bob, docId };
}

describe("notifications", () => {
  test("a chat mention notifies the person mentioned, not the sender", async () => {
    const { ada, bob, docId } = await setup();
    await ada.as.mutation(api.chats.sendMessage, {
      documentId: docId,
      text: "@Bob can you check section 2?",
      mentions: ["user_bob", "user_ada"],
    });

    const [note] = await bob.as.query(api.notifications.list, {});
    expect(note).toMatchObject({
      kind: "mention",
      actorName: "Ada",
      preview: "@Bob can you check section 2?",
      documentTitle: "Our Paper",
      documentSlug: "our-paper",
    });
    expect(await bob.as.query(api.notifications.unreadCount, {})).toBe(1);
    expect(await ada.as.query(api.notifications.list, {})).toEqual([]);
  });

  test("a chat reply notifies the person replied to, once even if also mentioned", async () => {
    const { ada, bob, docId } = await setup();
    const first = await bob.as.mutation(api.chats.sendMessage, { documentId: docId, text: "Draft is up" });

    await ada.as.mutation(api.chats.sendMessage, { documentId: docId, text: "Thanks", replyTo: first });
    await ada.as.mutation(api.chats.sendMessage, {
      documentId: docId,
      text: "@Bob again",
      replyTo: first,
      mentions: ["user_bob"],
    });

    const kinds = (await bob.as.query(api.notifications.list, {})).map((n) => n.kind);
    expect(kinds).toEqual(["mention", "chat_reply"]);
  });

  test("a new comment in an existing thread notifies its earlier commenters", async () => {
    const { ada, bob, docId } = await setup();
    const body = (text: string) => JSON.stringify({ version: 1, content: [{ type: "paragraph", children: [{ text }] }] });

    // First sync: a brand-new thread notifies nobody.
    await ada.as.mutation(api.comments.syncComments, {
      documentId: docId,
      comments: [{ threadId: "th1", commentId: "c1", text: body("Is this right?"), senderId: "user_ada" }],
    });
    expect(await ada.as.query(api.notifications.unreadCount, {})).toBe(0);

    // Bob replies; any client may sync it, and syncing it twice changes nothing.
    const reply = { threadId: "th1", commentId: "c2", text: body("Yes, fixed it"), senderId: "user_bob" };
    await ada.as.mutation(api.comments.syncComments, { documentId: docId, comments: [reply] });
    await bob.as.mutation(api.comments.syncComments, { documentId: docId, comments: [reply] });

    const notes = await ada.as.query(api.notifications.list, {});
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: "comment_reply", actorName: "Bob", preview: "Yes, fixed it" });
    expect(await bob.as.query(api.notifications.list, {})).toEqual([]);
  });

  test("sharing with someone who has an account notifies them", async () => {
    const { t, ada, docId } = await setup();
    const sam = await signedInAs(t, { clerkId: "user_sam" });
    await ada.as.mutation(api.sharing.invite, { documentId: docId, email: "user_sam@example.com", role: "commenter" });

    const [note] = await sam.as.query(api.notifications.list, {});
    expect(note).toMatchObject({ kind: "share", preview: "Can comment", actorName: "Ada" });
  });

  test("losing access hides the notification", async () => {
    const { t, ada, docId } = await setup();
    const sam = await signedInAs(t, { clerkId: "user_sam" });
    await ada.as.mutation(api.sharing.invite, { documentId: docId, email: "user_sam@example.com", role: "viewer" });
    const [member] = await ada.as.query(api.sharing.listMembers, { documentId: docId });
    await ada.as.mutation(api.sharing.remove, { memberId: member!._id });

    expect(await sam.as.query(api.notifications.list, {})).toEqual([]);
  });

  test("marking one or all as read", async () => {
    const { ada, bob, docId } = await setup();
    for (const text of ["one", "two"]) {
      await ada.as.mutation(api.chats.sendMessage, { documentId: docId, text, mentions: ["user_bob"] });
    }
    const [latest] = await bob.as.query(api.notifications.list, {});
    await bob.as.mutation(api.notifications.markRead, { id: latest!._id });
    expect(await bob.as.query(api.notifications.unreadCount, {})).toBe(1);

    // Someone else cannot mark Bob's as read.
    const [other] = await bob.as.query(api.notifications.list, {});
    await ada.as.mutation(api.notifications.markRead, { id: other!._id });

    await bob.as.mutation(api.notifications.markAllRead, {});
    expect(await bob.as.query(api.notifications.unreadCount, {})).toBe(0);
  });

  test("old notifications are pruned", async () => {
    const { t, ada, bob, docId } = await setup();
    await ada.as.mutation(api.chats.sendMessage, { documentId: docId, text: "hi", mentions: ["user_bob"] });
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("notifications").collect();
      for (const row of rows) await ctx.db.patch(row._id, { createdAt: Date.now() - 91 * 86_400_000 });
    });
    await t.mutation(internal.notifications._pruneOld, {});
    expect(await bob.as.query(api.notifications.list, {})).toEqual([]);
  });
});

test("previews are one line and cut on a word", () => {
  expect(previewOf("a\n\n b")).toBe("a b");
  const long = "word ".repeat(60);
  expect(previewOf(long).length).toBeLessThanOrEqual(141);
  expect(previewOf(long).endsWith("word…")).toBe(true);
  expect(commentBodyText("not json")).toBe("not json");
});
