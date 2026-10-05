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
- **Export:** PDF (via print), HTML, and `refs.bib` from the references panel.
- **Reference import:** DOI lookup, title search and PDF import already exist.

## Build plan

The features below are grouped into phases. Each phase ships on its own, is
mostly additive (new files, new tables, new menu items), and has a clear
"done when" so it can be tested before moving on. Phases are ordered by value
over effort, and by what later phases depend on.

Status key: ✅ done · 🚧 in progress · ⬜ not started

### Phase 1: LaTeX export 🚧

Frontend only: no schema change, no server cost. The data model already holds
everything LaTeX needs (`templateSnapshot`, BibTeX-shaped `references`,
citation keys on every citation).

| Step | Work | Status |
|---|---|---|
| 1.1 | Share the existing BibTeX writer (`convex/lib/citations.ts`) with the web app | ✅ |
| 1.2 | Converter: editor JSON → `main.tex` (headings, marks, lists, links, citations, page breaks) with LaTeX escaping | ✅ |
| 1.3 | Floats: figures, tables, captions, `\label` / `\ref` cross-references | ✅ |
| 1.4 | Preamble from the template: class, options, engine, bib tool, citation style | ✅ |
| 1.5 | Zip download (`main.tex`, `references.bib`, `figures/`) and a menu item | ✅ |
| 1.6 | Unit tests for the converter | ✅ |
| 1.7 | Check real exports compile in Overleaf; fix what breaks | ⬜ |
| 1.8 | Template specifics: APA 7 running head and author note, ACM/IEEE front matter | ⬜ |
| 1.9 | "Open in Overleaf" button | ⬜ |

**Done when:** an IEEE and a plain `article` paper export, upload to Overleaf,
and compile with no errors and correct citations, figures and references.

### Phase 2: Version history 🚧

| Step | Work | Status |
|---|---|---|
| 2.1 | `documentVersions` table and `versions.ts` (list, get, name, rename, restore) with access checks | ✅ |
| 2.2 | Automatic versions: a cron job every 10 minutes snapshots documents saved since, skipping unchanged and binned ones | ✅ |
| 2.3 | Named versions ("Submitted to journal") from the History panel; any version can be named later | ✅ |
| 2.4 | History side panel: list, sandboxed read-only preview, Restore with confirmation | ✅ |
| 2.5 | Restore writes through the editor so collaborators see it live, and keeps the replaced text as a version | ✅ |
| 2.6 | Retention: all automatic versions for 2 days, then one a day for 90 days; named versions kept | ✅ |
| 2.7 | Versions removed with their document by `cascadeDeleteDocument` | ✅ |
| 2.8 | Push the schema and cron to Convex (dev, then prod) and try it in the browser with two collaborators | ⬜ |

**Done when:** a user can see earlier versions, preview one, and restore it
without losing the text it replaced.

### Phase 3: Full-text search 🚧

Small, and makes later phases (sharing, notifications) easier to navigate.

| Step | Work | Status |
|---|---|---|
| 3.1 | `documentSearch` table holding each document's title and plain text, kept apart from `documents` so saving is untouched | ✅ |
| 3.2 | `search_text` index filtered by workspace; every hit re-checked against the real document and the bin | ✅ |
| 3.3 | Cron job every 5 minutes indexes recently saved documents | ✅ |
| 3.4 | Search box on the documents page: instant title matches, plus body matches with a highlighted excerpt | ✅ |
| 3.5 | One-off backfill for existing documents (`npx convex run search:_backfill`) | ✅ |
| 3.6 | Push to Convex, run the backfill on dev and prod, and try it in the browser | ⬜ |

**Limits:** body matches appear up to 5 minutes after a save, and only the
first 100,000 characters (about 15,000 words) of a document are searchable.

**Done when:** searching a phrase from inside a paper finds that paper.

### Phase 4: Per-document sharing and roles 🚧

The biggest change to how access works, so it comes after the safety net of
version history.

| Step | Work | Status |
|---|---|---|
| 4.1 | `documentMembers` table keyed by email (invites work before sign-up), roles `editor`, `commenter`, `viewer` | ✅ |
| 4.2 | `requireDocumentAccess` / `canAccessDocument` take an access level (default "edit"); author and organization access unchanged; read and comment actions opened explicitly | ✅ |
| 4.3 | **Security fix:** the Liveblocks auth route issued room access to any signed-in user for any room; it now asks Convex and grants per-document, per-role tokens | ✅ |
| 4.4 | Share dialog: invite by email, change role, remove; only the author and organization members can manage | ✅ |
| 4.5 | Read-only editor, title and status for viewers and commenters; History panel without naming or restore | ✅ |
| 4.6 | "Shared with me" section on the documents page | ✅ |
| 4.7 | Tests for every role against view, comment and edit actions | ✅ |
| 4.8 | Push to Convex, deploy, and try it with a second account: viewer, commenter, editor, and an outsider | ⬜ |

**Not yet:** invite emails are not sent (Phase 5); shared documents are not in
search results; an invite only matches if the invitee's Clerk email is the
same address.

**Done when:** an outside co-author can be invited to one paper with a chosen
role, and cannot see anything else.

### Phase 5: Notifications 🚧

| Step | Work | Status |
|---|---|---|
| 5.1 | `notifications` table and `notifications.ts` (list, unread count, mark read, mark all read); pruned after 90 days | ✅ |
| 5.2 | Written on chat mention, chat reply, comment reply, and share invite; never to the actor; hidden once access is lost | ✅ |
| 5.3 | Bell with unread count in the app's top bar and the editor header | ✅ |
| 5.4 | Optional email digest from a cron job, with an opt-out setting (needs an email service such as Resend) | ⬜ |
| 5.5 | Push to Convex and try it with two accounts | 🚧 pushed to dev; not yet tried with two accounts |

**Done when:** being mentioned or invited shows up in the bell without opening
the document.

### Phase 6: AI writing assistant ⬜

| Step | Work |
|---|---|
| 6.1 | Shared Gemini helper, reusing the setup in `research.ts` |
| 6.2 | Chat bot: `@assistant` in team chat schedules an action that replies as a bot message |
| 6.3 | Inline actions on selected text: improve tone, shorten, explain |
| 6.4 | "Draft abstract from sections" |
| 6.5 | Per-user rate limit and a friendly failure message |

**Done when:** a user can ask the assistant about the paper in chat and rewrite
a selected paragraph, within a rate limit.

### Phase 7: Smaller features 🚧

Independent of each other; pick up between phases.

| Step | Work | Status |
|---|---|---|
| 7.1 | Writing goals: own word target, section targets over the template's, deadline, progress bar in the outline, deadline chip on cards, reminders 7/3/1 days before (Goals panel) | ✅ |
| 7.2 | `.bib` import into the references panel (Zotero, Mendeley, JabRef, Overleaf): keeps the file's keys, skips duplicates, reports unreadable entries | ✅ |
| 7.3 | `.docx` export | ⬜ |
| 7.4 | Save a document as a personal or organization template | ⬜ |
| 7.5 | Track changes / suggestion mode (large; plan separately) | ⬜ |
| 7.6 | Replace the starter README with real setup instructions | ⬜ |
| 7.7 | `.docx` import: new document from a Word file (headings, lists, tables, bold/italic, links, images) | ✅ |
| 7.8 | `.tex` import: new document from a LaTeX file (large; LaTeX is hard to read reliably) | ⬜ |

### Known issues found along the way

- **Recycle-bin purge leaves chat files behind.** `lib/cascade.ts` deletes a
  document's chat rows but not the files in Convex storage that those messages
  attached. Fix before relying on "permanently erased" for files.
- **Mention names in Liveblocks comments never load.** The
  `/api/liveblocks-users` routes call admin-only Convex queries without
  signing in, so they fail for every normal user.
- **`.bib` titles are not escaped.** `toBibtexEntry` braces capitals in titles
  but does not escape `&`, `%`, `$`, `#` or `_`, so a title such as "R&D" breaks
  BibTeX. Affects both the `.bib` download and the LaTeX export.

---

# Feature details

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

- ✅ A `notifications` table, written on chat mentions, chat replies, comment
  replies, share invites and deadline reminders (Phase 5, step 7.1).
- ✅ A bell with an unread count in the top bar and the editor header.
- ⬜ Optional email digest sent by a cron job. Needs an email service (such as
  Resend) and an opt-out setting; nothing sends email yet.

## 6. Full-text search across documents

**Value:** medium · **Effort:** small

✅ Built in Phase 3: a `documentSearch` table indexed by a cron job, and a
search box on the documents page that matches titles and body text.

## 7. Writing goals and deadlines

**Value:** medium · **Effort:** small

✅ Built in step 7.1: a Goals panel to set a word target for the document,
targets per section (over the template's own budgets) and a deadline; a
progress bar and deadline in the outline; a deadline chip on document cards;
and bell reminders to everyone on the document 7, 3 and 1 days before.

## 8. Import references and documents

**Value:** medium · **Effort:** small

- ✅ DOI lookup, title search, PDF import and `.bib` import (step 7.2).
- ✅ Import `.docx` to start a document (step 7.7).
- ⬜ Import `.tex` (step 7.8).

## 9. Smaller improvements

- **Track changes / suggestion mode**, for supervisors reviewing student work.
- **User templates:** save your own document as a private or organization
  template.
- **Admin:** an AI usage and cost dashboard once AI features grow.
- **README:** still the Turborepo starter text; replace it with real setup
  instructions.
