# Future features

Proposed features for Colres, ordered by value. Each entry says why it matters,
how it fits the existing code, and roughly what it involves.

## Where the product stands

- **Editor:** TipTap with citations, cross-references, figure/table and section
  numbering, pagination, slash commands, tables and a document outline.
- **Live collaboration:** Liveblocks presence, comments, and team chat with
  replies, mentions, files, voice notes, reactions and read tracking.
- **Research:** a references panel with citation styles, and AI paper
  suggestions (Gemini + OpenAlex) in `packages/convex/convex/research.ts`.
- **Templates:** a LaTeX-style template gallery; each document keeps a snapshot
  of the template it was created from.
- **Team features:** organizations, contribution stats, and a recycle bin
  purged after 30 days by a cron job.
- **Admin app:** users, organizations, documents, templates, activity, stats.
- **Export:** PDF (via print) and HTML only.

## Recommended order

1. LaTeX export
2. Version history
3. Per-document sharing and roles
4. AI writing assistant
5. Notifications

---

## 1. Version history

**Value:** high · **Effort:** medium

Documents store only their latest `content`. Once someone overwrites another
person's work, it cannot be recovered, which is a real risk in a collaborative
editor.

- Add a `documentVersions` table: `documentId`, `content`, `createdAt`,
  `authorId`, optional `name`.
- Save a snapshot every N minutes of active editing, on large changes, and when
  the user names a version (e.g. "Submitted to journal").
- Add a history panel listing versions with a preview and a **Restore** action.
- Reuses the same idea as the recycle bin's restore flow.

## 2. LaTeX export

**Value:** high · **Effort:** small–medium

The schema already stores `engine`, `bibTool`, `documentClass` and
`classOptions` on each document's template snapshot, and its comments say they
exist "so the export to LaTeX path … can be added". The data model is ready;
only the exporter is missing.

- Convert TipTap JSON to `.tex`: headings → `\section`, citations →
  `\cite{key}`, figures/tables → `figure`/`table` environments.
- Generate a `.bib` file from the document's references.
- Download both as a `.zip`. "Open in Overleaf" can come later.
- Also worth adding: `.docx` export, since many journals and supervisors
  require Word.

## 3. Per-document sharing and roles

**Value:** high · **Effort:** medium

Access is decided by organization or author today. Researchers often need to
share a single paper with an outside co-author, or with a supervisor who should
only comment.

- Add a `documentMembers` table: `documentId`, `userId`,
  `role: owner | editor | commenter | viewer`.
- Invite by email or shareable link.
- Enforce the role inside `requireDocumentAccess` in `lib/auth.ts`.

## 4. AI writing assistant

**Value:** medium–high · **Effort:** medium

A chatbot inside the existing team chat, plus inline actions in the editor.

- **Chat bot:** when a message @mentions the assistant, `chats.send` schedules
  a Convex action. The action loads recent messages and the document text,
  calls the model, and inserts the reply as a normal `chats` row with a bot
  sender. Convex reactivity updates the chat UI with no extra work.
- **Inline actions** on selected text: improve academic tone, shorten, explain,
  draft an abstract from the sections.
- Suggest citations from the document's own references.
- Reuse the Gemini setup already in `research.ts` rather than adding a second
  provider.
- Keep the API key in Convex environment variables, rate-limit calls per user,
  and post a friendly message when the model call fails.

## 5. Notifications

**Value:** medium · **Effort:** medium

Chat mentions and comments are stored, but nobody is told about them until they
open the document.

- Add a `notifications` table, written on mentions, comment replies and shares.
- A bell icon with an unread count in the app shell.
- Optional email digest sent by a cron job, following the same pattern as the
  recycle-bin purge in `crons.ts`.

## 6. Full-text search across documents

**Value:** medium · **Effort:** small

The search index covers `title` only.

- Store a plain-text copy of the content on save and add a `searchIndex` on it.
- Lets users find a paper by what they wrote in it, not just its title.

## 7. Writing goals and deadlines

**Value:** medium · **Effort:** small

- Word-count targets per document and per section.
- A submission deadline with a progress bar.
- A reminder to document members before the deadline.
- Builds on the existing contribution stats.

## 8. Import references and documents

**Value:** medium · **Effort:** small

- Import references from BibTeX, a DOI, or a Zotero export. DOI lookup is
  close to free, since the app already pulls data from OpenAlex and Crossref.
- Import `.docx` or `.tex` to start a document from existing work.

## 9. Smaller improvements

- **Track changes / suggestion mode**, for supervisors reviewing student work.
- **User templates:** save your own document as a private or organization
  template.
- **Admin:** an AI usage and cost dashboard once AI features grow.
- **README:** still the Turborepo starter text; replace it with real setup
  instructions.
