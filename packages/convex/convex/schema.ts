import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/*
 * Shared validators for the LaTeX compilation contract.
 *
 * Documents are authored as rich text, but every template also carries the
 * manifest fields a real LaTeX toolchain needs (engine, bib tool, document
 * class). Nothing compiles LaTeX today; these exist so the "export to LaTeX"
 * path and, later, a compile service can be added without remodelling data.
 */
export const engineValidator = v.union(
  v.literal("pdflatex"),
  v.literal("xelatex"),
  v.literal("lualatex")
);

export const bibToolValidator = v.union(
  v.literal("biber"),
  v.literal("bibtex"),
  v.literal("none")
);

export const citationStyleValidator = v.union(
  v.literal("ieee"),
  v.literal("apa"),
  v.literal("acm"),
  v.literal("vancouver"),
  v.literal("chicago"),
  v.literal("numeric")
);

/** Mirrors the Overleaf gallery taxonomy so the categories are familiar. */
export const templateCategoryValidator = v.union(
  v.literal("journal-articles"),
  v.literal("theses"),
  v.literal("cvs"),
  v.literal("presentations"),
  v.literal("assignments"),
  v.literal("bibliographies"),
  v.literal("books"),
  v.literal("posters"),
  v.literal("formal-letters"),
  v.literal("newsletters"),
  v.literal("calendars")
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.string(),
    role: v.string(),
    createdAt: v.number(),
    orgIds: v.optional(v.array(v.string())),
  }).index("by_clerk_id", ["clerkId"]),


  documents: defineTable({
    author: v.id("users"),
    orgId: v.optional(v.string()),
    title: v.string(),
    slug: v.string(),
    status: v.boolean(),
    content: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),

    // Provenance: which template seeded this document, at which version. The
    // snapshot is copied at creation time so an admin editing the template
    // later never changes the compilation contract of documents already based
    // on it.
    templateId: v.optional(v.id("templates")),
    templateVersion: v.optional(v.number()),
    templateSnapshot: v.optional(
      v.object({
        slug: v.string(),
        name: v.string(),
        engine: engineValidator,
        bibTool: bibToolValidator,
        documentClass: v.string(),
        classOptions: v.array(v.string()),
        citationStyle: citationStyleValidator,
      })
    ),
  })
    .index("by_author", ["author"])
    .index("by_org_id", ["orgId"])
    .index("by_slug", ["slug"]),


  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.string(),
    admins: v.array(v.string()),
    members: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_org_id", ["clerkOrgId"]),

  chats: defineTable({
    documentId: v.id("documents"),
    /** May be empty when the message is only an attachment or a voice note. */
    text: v.string(),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.string(),
    createdAt: v.number(),

    /** The message being replied to. Absent for a message that starts a thread. */
    replyTo: v.optional(v.id("chats")),

    /**
     * Clerk ids of the people named in `text`. Stored alongside the text
     * rather than encoded into it, so that a mention still works after
     * somebody changes their display name — see `lib/chatMentions.ts`.
     */
    mentions: v.optional(v.array(v.string())),

    /**
     * Files and voice notes, in the order they were attached.
     *
     * The name, type and size are copied onto the message rather than read
     * back from storage metadata on every query: rendering a list of twenty
     * messages would otherwise mean twenty extra reads to draw file cards.
     */
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          mimeType: v.string(),
          size: v.number(),
          kind: v.union(v.literal("file"), v.literal("image"), v.literal("voice")),
          /** Voice only: clip length, so the player can show it before loading. */
          durationSec: v.optional(v.number()),
        })
      )
    ),
  })
    .index("by_document_id", ["documentId"])
    .index("by_document_and_time", ["documentId", "createdAt"]),

  /**
   * Emoji reactions, one row per person per emoji per message.
   *
   * A separate table rather than an array on the message, because an array
   * would have to be read, modified and written back: two people reacting at
   * the same moment would race, and the slower write would silently drop the
   * faster one's reaction. A row per reaction has no such step.
   */
  chatReactions: defineTable({
    messageId: v.id("chats"),
    /** Denormalised so a document's reactions can be fetched in one query. */
    documentId: v.id("documents"),
    userId: v.string(),
    userName: v.string(),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_document", ["documentId"])
    .index("by_message_user_emoji", ["messageId", "userId", "emoji"]),

  /**
   * How far each person has read each document's chat.
   *
   * Kept on the server rather than in the browser's local storage so that
   * "unread" means the same thing on a laptop and a phone: a marker held per
   * browser would show a full badge on every device the conversation had not
   * happened to be open in.
   *
   * One row per person per document, holding a timestamp rather than a set of
   * message ids — a conversation is read forwards, so the boundary is a point
   * in time and the row never grows.
   */
  chatReads: defineTable({
    documentId: v.id("documents"),
    userId: v.string(),
    lastReadAt: v.number(),
  }).index("by_document_and_user", ["documentId", "userId"]),

  paperSuggestions: defineTable({
    documentId: v.id("documents"),
    // Hash of the title + description the suggestions were generated from, so
    // the UI can tell the author when their context has drifted.
    contextHash: v.string(),
    queries: v.array(v.string()),
    papers: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        url: v.string(),
        abstract: v.string(),
        authors: v.array(v.string()),
        year: v.number(),
        citationCount: v.number(),
        venue: v.optional(v.string()),
        doi: v.optional(v.string()),
        openAccessUrl: v.optional(v.string()),
        // One line from the model on why this paper fits the document.
        reason: v.string(),
        status: v.union(
          v.literal("suggested"),
          v.literal("saved"),
          v.literal("dismissed")
        ),
      })
    ),
    generatedAt: v.number(),
  }).index("by_document_id", ["documentId"]),

  templateCategories: defineTable({
    slug: templateCategoryValidator,
    name: v.string(),
    description: v.optional(v.string()),
    // Lucide icon name, resolved on the client.
    icon: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
  }).index("by_slug", ["slug"]),

  templates: defineTable({
    slug: v.string(),
    name: v.string(),
    category: templateCategoryValidator,
    description: v.string(),
    tags: v.array(v.string()),

    /** Convex storage id for the gallery card image. */
    thumbnailId: v.optional(v.id("_storage")),
    /** Publisher-maintained formats (IEEE, ACM, Springer) get a trust badge. */
    official: v.boolean(),
    publisher: v.optional(v.string()),

    /** TipTap/HTML skeleton seeded into `documents.content`. */
    content: v.string(),

    /**
     * Structural outline of the skeleton. Drives section-aware features:
     * progress against word budgets, per-section assignment, and the
     * submission-readiness checklist.
     */
    sections: v.array(
      v.object({
        key: v.string(),
        title: v.string(),
        required: v.boolean(),
        targetWords: v.optional(v.number()),
        maxWords: v.optional(v.number()),
        guidance: v.optional(v.string()),
      })
    ),

    /** Fields collected by the create wizard, substituted into `{{TOKENS}}`. */
    fields: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        type: v.union(
          v.literal("text"),
          v.literal("textarea"),
          v.literal("authors"),
          v.literal("keywords"),
          v.literal("date")
        ),
        required: v.boolean(),
        placeholder: v.string(),
        defaultValue: v.optional(v.string()),
        help: v.optional(v.string()),
      })
    ),

    /* --- compilation contract (unused today, needed by the LaTeX export) --- */
    engine: engineValidator,
    bibTool: bibToolValidator,
    passes: v.number(),
    entryFile: v.string(),
    documentClass: v.string(),
    classOptions: v.array(
      v.object({
        value: v.string(),
        label: v.string(),
        isDefault: v.optional(v.boolean()),
        group: v.optional(v.string()),
      })
    ),
    requiredPackages: v.array(v.string()),
    /** Preamble/body skeleton with the same `{{TOKENS}}` as `content`. */
    latexSkeleton: v.optional(v.string()),
    citationStyle: citationStyleValidator,

    /* --- legal (see LICENSES.md) --- */
    license: v.object({
      spdx: v.string(),
      url: v.string(),
      redistributable: v.boolean(),
      notes: v.optional(v.string()),
    }),

    /* --- gallery + lifecycle --- */
    status: v.union(v.literal("draft"), v.literal("published")),
    featured: v.boolean(),
    order: v.number(),
    version: v.number(),
    usageCount: v.number(),
    /** Set for org-private templates; undefined means globally available. */
    orgId: v.optional(v.string()),
    /** Undefined for seeded built-ins. */
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_org_id", ["orgId"]),

  /**
   * A document's bibliography. Populated from saved OpenAlex suggestions, a
   * DOI lookup, or by hand; consumed by the citation node and the generated
   * reference list.
   */
  references: defineTable({
    documentId: v.id("documents"),
    /** BibTeX key, unique within the document (e.g. "vaswani2017"). */
    citationKey: v.string(),
    type: v.union(
      v.literal("article"),
      v.literal("inproceedings"),
      v.literal("book"),
      v.literal("incollection"),
      v.literal("techreport"),
      v.literal("phdthesis"),
      v.literal("misc")
    ),
    title: v.string(),
    authors: v.array(v.string()),
    year: v.optional(v.number()),
    /**
     * Month of publication, 1-12. IEEE prints it abbreviated before the year
     * in a journal reference ("Jun. 2014"), so it is stored as a number and
     * localised nowhere — the abbreviation is a formatting decision.
     */
    month: v.optional(v.number()),
    venue: v.optional(v.string()),
    publisher: v.optional(v.string()),
    /**
     * Where the publisher is: "Cambridge, MA, USA". IEEE puts it before the
     * publisher in a book reference and after the conference name in a
     * proceedings one, and there is nowhere else in the record to keep it.
     */
    address: v.optional(v.string()),
    volume: v.optional(v.string()),
    number: v.optional(v.string()),
    pages: v.optional(v.string()),
    doi: v.optional(v.string()),
    url: v.optional(v.string()),
    /**
     * When the author last opened the page, as epoch milliseconds. A web page
     * has no publication date to stand behind, so IEEE ends the reference with
     * "(accessed Jul. 18, 2022)" instead.
     */
    accessed: v.optional(v.number()),
    /**
     * Edition of a book, as typed: "5", "2nd", "Rev.". APA prints it after the
     * title, "(5th ed.)"; IEEE after the title, "5th ed.".
     */
    edition: v.optional(v.string()),
    /** Editors of the book a chapter or paper appears in, in credited order. */
    editors: v.optional(v.array(v.string())),
    abstract: v.optional(v.string()),
    source: v.union(
      v.literal("openalex"),
      v.literal("doi"),
      v.literal("manual"),
      v.literal("bibtex")
    ),
    /** OpenAlex work id, so a saved suggestion is not added twice. */
    externalId: v.optional(v.string()),
    addedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_document_id", ["documentId"])
    .index("by_document_and_key", ["documentId", "citationKey"])
    .index("by_document_and_external_id", ["documentId", "externalId"]),

  comments: defineTable({
    documentId: v.id("documents"),
    threadId: v.string(),
    commentId: v.string(),
    text: v.string(),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.string(),
    createdAt: v.number(),
  }).index("by_document_id", ["documentId"])
    .index("by_thread_id", ["threadId"]),

});
