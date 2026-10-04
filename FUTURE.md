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

### Phase 2: Version history ⬜

| Step | Work |
|---|---|
| 2.1 | `documentVersions` table and `versions.ts` (list, get, create, restore) with access checks |
| 2.2 | Automatic snapshots: on save, at most one per N minutes of editing, skipping unchanged content |
| 2.3 | Named versions ("Submitted to journal") from the File menu |
| 2.4 | History side panel: list, read-only preview, Restore |
| 2.5 | Restore writes through the editor so collaborators see it live, and snapshots the current text first |
| 2.6 | Retention: keep named versions; thin out old automatic ones with a cron job |
| 2.7 | Versions removed with their document in the recycle-bin purge |

**Done when:** a user can see earlier versions, preview one, and restore it
without losing the text it replaced.

### Phase 3: Full-text search ⬜

Small, and makes later phases (sharing, notifications) easier to navigate.

| Step | Work |
|---|---|
| 3.1 | Optional `plainText` field on documents, filled on save |
| 3.2 | `searchIndex` on it, with the same filters as the title index |
| 3.3 | Search box on the documents page that searches title and body |
| 3.4 | One-off backfill for existing documents |

**Done when:** searching a phrase from inside a paper finds that paper.

### Phase 4: Per-document sharing and roles ⬜

The biggest change to how access works, so it comes after the safety net of
version history.

| Step | Work |
|---|---|
| 4.1 | `documentMembers` table: document, user, role (`owner`, `editor`, `commenter`, `viewer`) |
| 4.2 | Extend `requireDocumentAccess` so organization access keeps working unchanged, and direct members are added on top |
| 4.3 | Share dialog: invite by email, change role, remove |
| 4.4 | Read-only editor for viewers; comment-only mode for commenters |
| 4.5 | "Shared with me" list on the documents page |
| 4.6 | Tests for every role against every mutation |

**Done when:** an outside co-author can be invited to one paper with a chosen
role, and cannot see anything else.

### Phase 5: Notifications ⬜

| Step | Work |
|---|---|
| 5.1 | `notifications` table and `notifications.ts` (list, unread count, mark read) |
| 5.2 | Write a notification on chat mention, comment reply, and share invite |
| 5.3 | Bell with unread count in the app shell |
| 5.4 | Optional email digest from a cron job, with an opt-out setting |

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

### Phase 7: Smaller features ⬜

Independent of each other; pick up between phases.

| Step | Work |
|---|---|
| 7.1 | Writing goals: word targets per document and section, a deadline, a progress bar |
| 7.2 | BibTeX / Zotero `.bib` import into the references panel |
| 7.3 | `.docx` export |
| 7.4 | Save a document as a personal or organization template |
| 7.5 | Track changes / suggestion mode (large; plan separately) |
| 7.6 | Replace the starter README with real setup instructions |

### Known issues found along the way

- **Recycle-bin purge leaves chat files behind.** `lib/cascade.ts` deletes a
  document's chat rows but not the files in Convex storage that those messages
  attached. Fix before relying on "permanently erased" for files.
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

- DOI lookup, title search and PDF import already exist. Still missing:
  importing a `.bib` file, which also covers Zotero and Mendeley exports.
- Import `.docx` or `.tex` to start a document from existing work.

## 9. Smaller improvements

- **Track changes / suggestion mode**, for supervisors reviewing student work.
- **User templates:** save your own document as a private or organization
  template.
- **Admin:** an AI usage and cost dashboard once AI features grow.
- **README:** still the Turborepo starter text; replace it with real setup
  instructions.
