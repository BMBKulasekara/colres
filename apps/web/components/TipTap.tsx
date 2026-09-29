'use client';

import { useRoom, useThreads } from '@liveblocks/react/suspense';
import {
  FloatingComposer,
  FloatingThreads,
  FloatingToolbar,
  useLiveblocksExtension,
} from '@liveblocks/react-tiptap';
import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TableCell, TableHeader } from '@tiptap/extension-table';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { useMutation as useConvexMutation } from 'convex/react';
import {
  Bold,
  BookMarked,
  Code,
  Columns2,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Image as ImageIcon,
  Italic,
  Link2,
  Link as Link2Icon,
  List,
  ListOrdered,
  Loader2,
  MessageSquareText,
  PanelTop,
  Printer,
  Quote,
  Redo2,
  SeparatorHorizontal,
  Strikethrough,
  Terminal,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  UserRound,
} from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CitationStyle, isAuthorDateStyle } from '../lib/citationFormat';
import type { FloatScheme } from '../lib/floatNumbering';
import { getPageGeometry, PAGE_GAP_PX } from '../lib/pageGeometry';
import { ApaRoles, findRunningHead, RUNNING_HEAD_MAX, RunningHead } from './tiptap/ApaNodes';
import { Bibliography, hasBibliography, refreshBibliography } from './tiptap/BibliographyNode';
import { Citation } from './tiptap/CitationExtension';
import {
  CitationNumbering,
  getCitationOrder,
  refreshCitationNumbering,
} from './tiptap/CitationNumbering';
import { CrossReference } from './tiptap/CrossReferenceNode';
import { Figure, FloatCaption, FloatNote, floatAt, TableFigure } from './tiptap/FloatNodes';
import { FloatNumbering, getFloats } from './tiptap/FloatNumbering';
import { PageBreak } from './tiptap/PageBreakNode';
import { Pagination, setPagedView } from './tiptap/PaginationExtension';
import { type PrintableReference, printDocument } from './tiptap/printDocument';
import { SectionNumbering } from './tiptap/SectionNumbering';
import { TableInsertMenu, TableToolbar } from './tiptap/TableControls';
import { getTableSelectionInfo, ResearchTable, ResearchTableRow } from './tiptap/TableExtensions';

/** Paged view is a personal reading preference, so it is remembered per browser. */
const PAGED_VIEW_STORAGE_KEY = 'colres:editor:paged-view';

/**
 * The paged view lays the document out as the browser would print it, which is
 * not how the publisher's LaTeX class will set it — different fonts and a
 * different measure, even where the column count matches. It is a writing aid,
 * so it says so rather than letting an author trust it for a page limit.
 */
const APPROXIMATE_LAYOUT_NOTE =
  'Approximate layout. Final pagination is decided when the document is compiled from its template.';

/** Shown on the paged-view toggle for two-column formats, where it does more. */
const COLUMN_LAYOUT_NOTE =
  'This format sets two columns. Page View shows the column flow; the continuous view does not.';

interface TipTapEditorProps {
  isPageScrolled?: boolean;
  initialContent?: string;
  onChange?: (html: string) => void;
  onEditorReady?: (editor: any) => void;
  /** Used as the print job's document title. */
  documentTitle?: string;
  /** `templateSnapshot.classOptions`, which decide page size and body size. */
  classOptions?: readonly string[];
  /** `templateSnapshot.documentClass` — decides margins, columns, typography. */
  documentClass?: string;
  /**
   * The bibliography, for resolving citation numbers and for printing the
   * reference list. Absent until the references query has loaded.
   */
  references?: readonly PrintableReference[];
  citationStyle?: CitationStyle;
  /**
   * Reports the order citations first appear in, which is the order IEEE
   * numbers the reference list in.
   */
  onCitationOrderChange?: (order: string[]) => void;
  /**
   * Uploads a figure's image and resolves with a URL to serve it from.
   *
   * Passed in rather than done here because the editor has no business knowing
   * which document it belongs to or how this deployment stores files; the page
   * that owns both supplies it. Absent means figures can still be placed and
   * captioned, just not illustrated.
   */
  onUploadImage?: (file: File) => Promise<string>;
}

export default function TipTapEditor({
  isPageScrolled = false,
  initialContent,
  onChange,
  onEditorReady,
  documentTitle,
  classOptions,
  documentClass,
  references,
  citationStyle = 'numeric',
  onCitationOrderChange,
  onUploadImage,
}: TipTapEditorProps) {
  const [isEditable, setIsEditable] = useState(true);
  const [isPaged, setIsPaged] = useState(false);
  const [pageCount, setPageCount] = useState(1);

  /**
   * Figures and tables the prose never refers to.
   *
   * IEEE requires every one of them to be cited in the text, so this is a
   * defect rather than a preference — and one the author cannot see, which is
   * why the toolbar says so.
   */
  const [uncitedFloats, setUncitedFloats] = useState<{ id: string; label: string }[]>([]);
  const uncitedCallbackRef = useRef<((uncited: { id: string; label: string }[]) => void) | null>(
    setUncitedFloats
  );

  const [isUploading, setIsUploading] = useState(false);
  const [floatMenuOpen, setFloatMenuOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Convex hands back a fresh array on every poll, so the key set is rebuilt
  // from a value signature rather than from the array's identity.
  const knownKeysSignature = (references ?? []).map((reference) => reference.citationKey).join(' ');

  const knownKeys = useMemo(
    () => new Set(knownKeysSignature ? knownKeysSignature.split(' ') : []),
    [knownKeysSignature]
  );

  // The editor is built once and must not be rebuilt, or the caret is lost.
  // These refs are how values that change afterwards reach the extension.
  const knownKeysRef = useRef<ReadonlySet<string>>(knownKeys);
  const orderCallbackRef = useRef(onCitationOrderChange);
  orderCallbackRef.current = onCitationOrderChange;

  // The reference list the editor draws is derived from all three of these,
  // and none of them are part of the document.
  const referencesRef = useRef<readonly PrintableReference[]>(references ?? []);
  referencesRef.current = references ?? [];
  const citationStyleRef = useRef<CitationStyle>(citationStyle);
  citationStyleRef.current = citationStyle;
  const citationOrderRef = useRef<readonly string[]>([]);
  /** The editor, reachable from the extension callbacks it was built with. */
  const editorRef = useRef<any>(null);

  /**
   * Everything the rendered reference list depends on, as one value.
   *
   * Compared by value for the same reason the key set is: Convex hands back a
   * fresh array on every poll, so redrawing on the array's identity would
   * rebuild the section several times a second for a document nobody is
   * editing.
   */
  const bibliographySignature = useMemo(
    () => JSON.stringify([citationStyle, references ?? []]),
    [citationStyle, references]
  );

  const geometry = useMemo(
    () => getPageGeometry(classOptions, documentClass),
    [classOptions, documentClass]
  );

  const isTwoColumn = geometry.columns > 1;
  const isApa = geometry.styleId === 'apa';
  const isMla = geometry.styleId === 'mla';

  /** APA labels floats "Figure 1" / "Table 1", MLA "Fig. 1." / "Table 1"; everything else IEEE's way. */
  const floatSchemeRef = useRef<FloatScheme>('ieee');
  floatSchemeRef.current = isApa ? 'apa' : isMla ? 'mla' : 'ieee';

  /** Page pitch: one page plus the gutter beneath it. */
  const pagePeriodPx = geometry.pageHeightPx + PAGE_GAP_PX;

  /** Height of the whole stack of pages, gutters included but not trailing. */
  const canvasHeightPx = pageCount * pagePeriodPx - PAGE_GAP_PX;

  // Handed to CSS as custom properties so the stylesheet paints the pages and
  // the extension measures them from one set of numbers.
  const canvasStyle = useMemo(
    () =>
      ({
        '--page-width': `${geometry.pageWidthPx}px`,
        '--page-height': `${geometry.pageHeightPx}px`,
        '--page-gap': `${PAGE_GAP_PX}px`,
        '--page-margin-top': `${geometry.margin.top}px`,
        '--page-margin-right': `${geometry.margin.right}px`,
        '--page-margin-bottom': `${geometry.margin.bottom}px`,
        '--page-margin-left': `${geometry.margin.left}px`,
        '--page-font-size': `${geometry.bodyFontPx}px`,
        '--content-width': `${geometry.contentWidthPx}px`,
        '--column-width': `${geometry.columnWidthPx}px`,
        '--column-gap': `${geometry.columnGapPx}px`,
        // In column flow every block is displaced out of the natural stack, so
        // the editor element no longer has a useful height of its own and is
        // pinned to the page stack instead.
        '--page-flow-height': `${canvasHeightPx}px`,
        minHeight: `${canvasHeightPx}px`,
      }) as CSSProperties,
    [geometry, canvasHeightPx]
  );

  const liveblocks = useLiveblocksExtension({
    initialContent,
  });

  const editor = useEditor({
    extensions: [
      liveblocks,
      StarterKit.configure({
        undoRedo: false, // Liveblocks handles history/undo-redo
        heading: {
          // Levels 4 and 5 exist for APA, whose headings go five deep. Other
          // formats simply never offer them in the toolbar.
          levels: [1, 2, 3, 4, 5],
        },
      }),
      // Must stay registered even for documents with no citations: without it
      // TipTap cannot parse existing `<span data-citation>` markers and would
      // silently strip them on load.
      Citation,
      CitationNumbering.configure({
        resolveKnownKeys: () => knownKeysRef.current,
        resolveStyle: () => citationStyleRef.current,
        resolveReferences: () => referencesRef.current,
        onOrderChange: (order) => {
          citationOrderRef.current = order;
          orderCallbackRef.current?.(order);
          // Citing a new source renumbers the list and may add an entry to it,
          // so the section has to be redrawn along with the markers.
          if (editorRef.current) refreshBibliography(editorRef.current);
        },
      }),
      Bibliography.configure({
        resolveReferences: () => referencesRef.current,
        resolveOrder: () => citationOrderRef.current,
        resolveStyle: () => citationStyleRef.current,
      }),
      // Figures and tables. The image node is registered on its own because
      // the figure's content expression names it; it is not offered as a
      // standalone block, since a bare image in an IEEE paper is a figure
      // missing its caption.
      Image.configure({ inline: false, allowBase64: false }),
      FloatCaption,
      FloatNote,
      Figure,
      TableFigure,
      // Columns are resized by dragging their right edge, rows by dragging
      // their bottom edge; both can also be typed in from the table toolbar.
      ResearchTable.configure({ resizable: true }),
      ResearchTableRow,
      TableHeader,
      TableCell,
      CrossReference,
      FloatNumbering.configure({
        resolveScheme: () => floatSchemeRef.current,
        onUncitedChange: (uncited) => uncitedCallbackRef.current?.(uncited),
      }),
      PageBreak,
      SectionNumbering,
      // APA's running head and heading roles. Registered for every document
      // so that one pasted into another format is kept rather than dropped.
      RunningHead,
      ApaRoles,
      Pagination.configure({
        geometry,
        gapPx: PAGE_GAP_PX,
        onPagesChange: setPageCount,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer hover:opacity-85',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start typing your document here...',
      }),
    ],
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditable);
    }
  }, [isEditable, editor]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Adding or deleting a reference changes which citations resolve without
  // touching the document, so the numbering has to be asked to recompute — and
  // the References section with it, since an entry has appeared or gone.
  useEffect(() => {
    knownKeysRef.current = knownKeys;
    if (editor) {
      refreshCitationNumbering(editor);
      refreshBibliography(editor);
    }
  }, [editor, knownKeys]);

  // Editing a reference in place — correcting a title, adding the DOI — leaves
  // the key set identical, so the effect above never fires. The entries
  // themselves have changed, and the section is showing the old text until it
  // is told otherwise. So are author–date citations, whose label is made of
  // the authors and year being edited.
  const drawnSignature = useRef('');

  useEffect(() => {
    if (!editor || drawnSignature.current === bibliographySignature) return;
    drawnSignature.current = bibliographySignature;
    refreshCitationNumbering(editor);
    refreshBibliography(editor);
  }, [editor, bibliographySignature]);

  useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  // Restored after mount rather than during render: reading localStorage while
  // rendering would make the server and client markup disagree.
  //
  // A two-column format opens paged by default, because the continuous view
  // cannot show columns at all — an author who has never touched the toggle
  // would otherwise be told the document is two-column and shown one column.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PAGED_VIEW_STORAGE_KEY);
      setIsPaged(stored === null ? isTwoColumn : stored === 'true');
    } catch {
      setIsPaged(isTwoColumn);
    }
  }, [isTwoColumn]);

  useEffect(() => {
    if (!editor) return;
    setPagedView(editor, isPaged);
    try {
      window.localStorage.setItem(PAGED_VIEW_STORAGE_KEY, String(isPaged));
    } catch {
      // Not being able to remember the preference is not worth failing over.
    }
  }, [editor, isPaged]);

  const handlePrint = useCallback(() => {
    if (!editor) return;
    printDocument({
      title: documentTitle?.trim() || 'Untitled Document',
      contentHtml: editor.getHTML(),
      geometry,
      citationStyle,
      references: references ?? [],
      // The printed reference list is numbered by first appearance, so it
      // needs the same order the markers in the text were numbered from.
      citationOrder: getCitationOrder(editor),
    });
  }, [editor, documentTitle, geometry, citationStyle, references]);

  const {
    isBold,
    isItalic,
    isUnderline,
    isStrikethrough,
    isCode,
    isHeading,
    isUnnumbered,
    isCitation,
    citationKey,
    citationLocator,
    citationNarrative,
    runningHead,
    hasReferencesSection,
    isInFloat,
    floatSpan,
    tableInfo,
    floatHasNote,
  } = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive('bold') ?? false,
      isItalic: ctx.editor?.isActive('italic') ?? false,
      isUnderline: ctx.editor?.isActive('underline') ?? false,
      isStrikethrough: ctx.editor?.isActive('strike') ?? false,
      isCode: ctx.editor?.isActive('code') ?? false,
      isHeading: ctx.editor?.isActive('heading') ?? false,
      isUnnumbered: ctx.editor?.getAttributes('heading').unnumbered === true,
      isCitation: ctx.editor?.isActive('citation') ?? false,
      citationKey: (ctx.editor?.getAttributes('citation').citationKey as string) ?? '',
      citationLocator: (ctx.editor?.getAttributes('citation').locator as string) ?? '',
      citationNarrative: ctx.editor?.getAttributes('citation').narrative === true,
      runningHead: ctx.editor
        ? (findRunningHead(ctx.editor.state.doc)?.node.textContent ?? null)
        : null,
      hasReferencesSection: ctx.editor ? hasBibliography(ctx.editor) : false,
      isInFloat:
        (ctx.editor?.isActive('figure') ?? false) || (ctx.editor?.isActive('tableFigure') ?? false),
      floatSpan:
        ((ctx.editor?.getAttributes('figure').span ??
          ctx.editor?.getAttributes('tableFigure').span) as string) ?? 'column',
      tableInfo: ctx.editor ? getTableSelectionInfo(ctx.editor.state) : null,
      floatHasNote: ctx.editor
        ? floatAt(ctx.editor.state.selection.$from)?.node.lastChild?.type.name === 'floatNote'
        : false,
    }),
  });

  const applyLocator = useCallback(
    (value: string) => {
      editor?.chain().focus().setCitationLocator(value).run();
    },
    [editor]
  );

  /**
   * Places a figure around the chosen image.
   *
   * The figure is inserted only once the upload has succeeded, so a failed
   * upload leaves no empty figure behind for the author to clear up — and,
   * more to the point, no figure silently consuming a number.
   */
  const handleInsertFigure = useCallback(
    async (file: File) => {
      if (!editor) return;

      if (!onUploadImage) {
        // Still useful without an uploader: the figure can be placed and
        // captioned now and illustrated later.
        editor.chain().focus().insertFigure().run();
        return;
      }

      setIsUploading(true);
      try {
        const src = await onUploadImage(file);
        editor.chain().focus().insertFigure({ src, alt: file.name }).run();
      } catch (error) {
        console.error('The figure image could not be uploaded:', error);
      } finally {
        setIsUploading(false);
      }
    },
    [editor, onUploadImage]
  );

  /** Floats in document order, for the cross-reference menu. */
  const floats = editor ? getFloats(editor) : [];

  const { threads } = useThreads({ query: { resolved: false } });
  const room = useRoom();
  const syncConvexComments = useConvexMutation(api.comments.syncComments);

  useEffect(() => {
    if (!threads || !room) return;

    const mappedComments = threads.flatMap((thread) =>
      thread.comments.map((c) => ({
        threadId: thread.id,
        commentId: c.id,
        text: JSON.stringify(c.body) || '',
        senderId: c.userId || '',
      }))
    );

    if (mappedComments.length > 0) {
      void syncConvexComments({
        documentId: room.id,
        comments: mappedComments,
      });
    }
  }, [threads, room, syncConvexComments]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-col w-full rounded-lg border border-border bg-background shadow-xs">
      {/* Control Bar for Editor Config */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b border-border bg-muted text-xs text-muted-foreground sticky transition-all duration-300 z-10 ${
          isPageScrolled ? 'top-14' : 'top-24'
        }`}
      >
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="editable"
            checked={isEditable}
            onChange={() => setIsEditable(!isEditable)}
            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
          />
          <label
            htmlFor="editable"
            className="cursor-pointer font-medium select-none text-foreground"
          >
            Editable Mode
          </label>

          <div className="w-px h-4 bg-border mx-1" />

          <input
            type="checkbox"
            id="paged-view"
            checked={isPaged}
            onChange={() => setIsPaged(!isPaged)}
            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
          />
          <label
            htmlFor="paged-view"
            className="cursor-pointer font-medium select-none text-foreground"
            title={isTwoColumn ? COLUMN_LAYOUT_NOTE : APPROXIMATE_LAYOUT_NOTE}
          >
            Page View
          </label>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Status:{' '}
            <span className="font-semibold text-foreground">
              {isEditable ? 'Editing' : 'Read-only'}
            </span>
          </span>
          {isApa && runningHead !== null && runningHead.length > RUNNING_HEAD_MAX && (
            <span
              className="font-semibold text-amber-600"
              title="APA limits the running head to 50 characters, including spaces and punctuation."
            >
              Running head: {runningHead.length}/{RUNNING_HEAD_MAX} characters
            </span>
          )}
          {isPaged && (
            <span
              className="font-semibold text-foreground cursor-help"
              title={APPROXIMATE_LAYOUT_NOTE}
            >
              {geometry.label}
              {isTwoColumn ? ' • 2 columns' : ''} • ~{pageCount}{' '}
              {pageCount === 1 ? 'page' : 'pages'}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            title="Print document content"
            className="h-7 px-2.5 text-xs font-semibold gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </div>

      {/* Editor Toolbar */}
      {isEditable && (
        <div
          className={`flex flex-wrap gap-1 p-2 border-b border-border bg-muted items-center justify-between sticky transition-all duration-300 z-20 ${
            isPageScrolled ? 'top-[88px]' : 'top-[128px]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1">
            {/* Inline styles */}
            <Button
              type="button"
              variant={isBold ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={isItalic ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={isUnderline ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline"
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={isStrikethrough ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={isCode ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleCode().run()}
              title="Code"
            >
              <Code className="h-4 w-4" />
            </Button>

            <div className="w-px h-5 bg-border mx-1 self-center" />

            {/* Headings */}
            <Button
              type="button"
              variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title={
                isApa
                  ? 'APA Level 1 — centred, bold'
                  : isMla
                    ? 'Title or Works Cited — centred, plain'
                    : 'Heading 1'
              }
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title={
                isApa
                  ? 'APA Level 2 — flush left, bold'
                  : isMla
                    ? 'MLA section heading — flush left, bold'
                    : 'Heading 2'
              }
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title={
                isApa
                  ? 'APA Level 3 — flush left, bold italic'
                  : isMla
                    ? 'MLA subheading — flush left, italic'
                    : 'Heading 3'
              }
            >
              <Heading3 className="h-4 w-4" />
            </Button>
            {/* APA's run-in levels. The text after the heading continues on
                the same line, so the heading should end with a period. */}
            {isApa && (
              <>
                <Button
                  type="button"
                  variant={editor.isActive('heading', { level: 4 }) ? 'secondary' : 'ghost'}
                  size="icon-xs"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                  title="APA Level 4 — indented, bold, ending with a period; the paragraph runs on"
                >
                  <Heading4 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={editor.isActive('heading', { level: 5 }) ? 'secondary' : 'ghost'}
                  size="icon-xs"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
                  title="APA Level 5 — indented, bold italic, ending with a period; the paragraph runs on"
                >
                  <Heading5 className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              type="button"
              variant={
                editor.isActive('paragraph') && !editor.isActive('heading') ? 'secondary' : 'ghost'
              }
              size="icon-xs"
              onClick={() => editor.chain().focus().setParagraph().run()}
              title="Paragraph Text"
            >
              <Type className="h-4 w-4" />
            </Button>
            {/* Numbering only means anything in a format that numbers its
                sections, so the control appears only there. */}
            {isHeading && geometry.styleId === 'ieee' && (
              <Button
                type="button"
                variant={isUnnumbered ? 'ghost' : 'secondary'}
                size="icon-xs"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes('heading', { unnumbered: !isUnnumbered })
                    .run()
                }
                title={
                  isUnnumbered
                    ? 'Number this section (I, II, III…)'
                    : 'Leave this section unnumbered, like Acknowledgment and References'
                }
              >
                <Hash className="h-4 w-4" />
              </Button>
            )}

            <div className="w-px h-5 bg-border mx-1 self-center" />

            {/* Lists */}
            <Button
              type="button"
              variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>

            <div className="w-px h-5 bg-border mx-1 self-center" />

            {/* Hyperlinks */}
            <Button
              type="button"
              variant={editor.isActive('link') ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={setLink}
              title="Hyperlink"
            >
              <Link2 className="h-4 w-4" />
            </Button>
            {editor.isActive('link') && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => editor.chain().focus().unsetLink().run()}
                title="Unlink"
                className="text-destructive hover:bg-destructive/10"
              >
                <Unlink className="h-4 w-4" />
              </Button>
            )}

            <div className="w-px h-5 bg-border mx-1 self-center" />

            {/* Formatting items */}
            <Button
              type="button"
              variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Blockquote"
            >
              <Quote className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              title="Code Block"
            >
              <Terminal className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => editor.chain().focus().setPageBreak().run()}
              title="Insert page break (Ctrl/Cmd + Enter)"
            >
              <SeparatorHorizontal className="h-4 w-4" />
            </Button>

            <div className="w-px h-5 bg-border mx-1 self-center" />

            {/* Figures and tables. Both are inserted with a caption already
                attached, because IEEE has no such thing as an uncaptioned
                float and an empty caption is easier to fill in than to
                remember to add. */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleInsertFigure(file);
                // Cleared so choosing the same file twice still fires.
                event.target.value = '';
              }}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={isUploading}
              onClick={() => imageInputRef.current?.click()}
              title={
                isApa
                  ? 'Insert a figure — labelled Figure N, with its title above the image'
                  : 'Insert a figure — an image or a graph, captioned Fig. N. below'
              }
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </Button>
            <TableInsertMenu editor={editor} />

            {/* Cross-references. Every figure and table has to be mentioned in
                the prose, and a reference inserted here renumbers itself when
                the paper is reordered, which a typed "Fig. 1" does not. */}
            <div className="relative">
              <Button
                type="button"
                variant={uncitedFloats.length > 0 ? 'secondary' : 'ghost'}
                size="icon-xs"
                disabled={floats.length === 0}
                onClick={() => setFloatMenuOpen((open) => !open)}
                aria-expanded={floatMenuOpen}
                title={
                  floats.length === 0
                    ? 'No figures or tables to refer to yet'
                    : uncitedFloats.length > 0
                      ? `Refer to a figure or table — ${uncitedFloats.length} not yet mentioned in the text`
                      : 'Refer to a figure or table in the text'
                }
              >
                <Link2Icon className="h-4 w-4" />
              </Button>

              {floatMenuOpen && floats.length > 0 && (
                <div className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-background shadow-md">
                  <ul className="max-h-56 overflow-y-auto">
                    {floats.map((float) => {
                      const isUncited = uncitedFloats.some((item) => item.id === float.id);
                      return (
                        <li key={float.id}>
                          <button
                            type="button"
                            onClick={() => {
                              editor.chain().focus().insertCrossReference(float.id).run();
                              setFloatMenuOpen(false);
                            }}
                            className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                          >
                            <span className="shrink-0 font-semibold">{float.label}</span>
                            <span className="truncate text-[10px] text-muted-foreground">
                              {float.caption || 'No caption yet'}
                            </span>
                            {isUncited && (
                              <span
                                className="ml-auto shrink-0 text-[9px] font-bold text-amber-600"
                                title="Not yet mentioned in the text"
                              >
                                !
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {uncitedFloats.length > 0 && (
                    <p className="border-t border-border bg-muted/40 px-2.5 py-1.5 text-[10px] leading-snug text-muted-foreground">
                      {isApa
                        ? 'APA Style expects every table and figure to be called out in the text before it appears.'
                        : isMla
                          ? 'MLA expects every table and figure to be referred to in the text, as in "(see fig. 1)".'
                          : 'IEEE expects every figure and table to be mentioned in the text.'}{' '}
                      Those marked ! are not yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* How wide the float is set. Only meaningful in a format with
                more than one column, which is where spanning both means
                anything at all. */}
            {isTwoColumn && isInFloat && (
              <Button
                type="button"
                variant={floatSpan === 'page' ? 'secondary' : 'ghost'}
                size="icon-xs"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .setFloatSpan(floatSpan === 'page' ? 'column' : 'page')
                    .run()
                }
                title={
                  floatSpan === 'page'
                    ? 'Set this float in one column'
                    : 'Span this float across both columns (takes effect on paper; Page View still previews it one column wide)'
                }
              >
                <Columns2 className="h-4 w-4" />
              </Button>
            )}

            {/* A note under the table or figure: APA's "Note. …". */}
            {isInFloat && (
              <Button
                type="button"
                variant={floatHasNote ? 'secondary' : 'ghost'}
                size="icon-xs"
                onClick={() => editor.chain().focus().toggleFloatNote().run()}
                title={
                  floatHasNote
                    ? 'Remove the note under this float'
                    : 'Add a note under this float ("Note. …")'
                }
              >
                <MessageSquareText className="h-4 w-4" />
              </Button>
            )}

            {/* The running head: required on a professional APA paper, and
                added to a student paper only when the instructor asks. */}
            {/* MLA's page header is the author's last name beside the page
                number, top right of every page. */}
            {(isApa || isMla) && (
              <Button
                type="button"
                variant={runningHead !== null ? 'secondary' : 'ghost'}
                size="icon-xs"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertRunningHead(isMla ? 'Last Name' : undefined)
                    .run()
                }
                title={
                  isMla
                    ? runningHead !== null
                      ? 'Edit the page header (your last name, before the page number, top right of every page)'
                      : 'Add the page header: your last name before the page number, top right of every page'
                    : runningHead !== null
                      ? 'Edit the running head (top left of every page, in capitals)'
                      : 'Add a running head: a shortened title, top left of every page'
                }
              >
                <PanelTop className="h-4 w-4" />
              </Button>
            )}

            <div className="w-px h-5 bg-border mx-1 self-center" />

            {/* The References section. Its entries are drawn from the
                bibliography rather than typed, so this inserts the section
                once and the list keeps itself in step from then on. */}
            <Button
              type="button"
              variant={hasReferencesSection ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().insertReferencesSection().run()}
              title={
                hasReferencesSection
                  ? 'Go to the References section'
                  : isApa
                    ? 'Add a References section on a new page, listed alphabetically by author'
                    : isMla
                      ? 'Add a Works Cited list on a new page, listed alphabetically by author'
                      : 'Add a References section, numbered in the order the text cites each source'
              }
            >
              <BookMarked className="h-4 w-4" />
            </Button>
          </div>

          {/* History Actions */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Shown while the caret is in a table, on a line of its own. */}
          {tableInfo && <TableToolbar editor={editor} info={tableInfo} />}
        </div>
      )}

      {/* A selected citation gets its own menu: the only thing worth editing
          on one is the locator IEEE prints inside the brackets. */}
      {editor && isEditable && isCitation && (
        <BubbleMenu
          editor={editor}
          pluginKey="citationBubble"
          options={{ placement: 'top', offset: 8 }}
        >
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background p-1.5 shadow-md">
            <span className="text-[10px] font-mono text-muted-foreground pl-0.5">
              {citationKey || 'citation'}
            </span>
            {/* Author–date styles only: whether the author is named in the
                sentence, "Smith (2020)", or in parentheses, "(Smith, 2020)". */}
            {isAuthorDateStyle(citationStyle) && (
              <Button
                type="button"
                variant={citationNarrative ? 'secondary' : 'ghost'}
                size="icon-xs"
                onClick={() =>
                  editor.chain().focus().setCitationNarrative(!citationNarrative).run()
                }
                title={
                  citationNarrative
                    ? 'Narrative: Smith (2020). Click for parenthetical: (Smith, 2020)'
                    : 'Parenthetical: (Smith, 2020). Click for narrative: Smith (2020)'
                }
              >
                <UserRound className="h-3 w-3" />
              </Button>
            )}
            <input
              // Remounted per citation, so selecting another one shows that
              // citation's locator rather than the last thing typed here.
              key={`${citationKey}:${citationLocator}`}
              defaultValue={citationLocator}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLocator(event.currentTarget.value);
                }
              }}
              onBlur={(event) => applyLocator(event.currentTarget.value)}
              placeholder="p. 13"
              aria-label="Page or section for this citation, e.g. p. 13"
              className="h-6 w-24 rounded border border-border bg-background px-1.5 text-[11px] outline-none focus:border-primary"
            />
            {citationLocator && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => applyLocator('')}
                title="Remove the page reference"
              >
                <Unlink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </BubbleMenu>
      )}

      {/* Bubble Menu for Inline text highlighting / editing */}
      {editor && isEditable && !isCitation && (
        <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }}>
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-1 shadow-md">
            <Button
              type="button"
              variant={isBold ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={isItalic ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={isUnderline ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('link') ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={setLink}
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </BubbleMenu>
      )}

      {/* Editor Area.
          Both modes render the same element structure so that toggling only
          swaps classes. Remounting <EditorContent> would tear the ProseMirror
          DOM out of the page and drop the caret. */}
      <div
        className={`${geometry.styleId === 'ieee' ? 'doc-ieee ' : ''}${isApa ? 'doc-apa ' : ''}${
          isMla ? 'doc-mla ' : ''
        }${isPaged ? 'page-canvas-backdrop' : 'bg-background w-full rounded-b-lg'}`}
      >
        <div
          className={
            isPaged
              ? `page-canvas${isTwoColumn ? ' page-canvas--columns' : ''}`
              : 'prose max-w-none min-h-[450px] p-4'
          }
          style={isPaged ? canvasStyle : undefined}
        >
          <EditorContent editor={editor} />
          {isPaged &&
            Array.from({ length: pageCount }, (_, index) => (
              <div
                key={`page-${index + 1}`}
                className="page-canvas__label"
                style={{ top: index * pagePeriodPx + geometry.pageHeightPx + 6 }}
              >
                Page {index + 1} of {pageCount}
              </div>
            ))}
          {/* The page number in the header, top right, where APA and MLA put
              it on every page including the first. Drawn over the page rather
              than written into it, since which page a line lands on is a
              measurement, not content. MLA puts the author's last name before
              it: page one shows the editable block itself beside the number,
              and every later page repeats the name here. */}
          {isPaged &&
            geometry.pageNumbers &&
            Array.from({ length: pageCount }, (_, index) => (
              <div
                key={`page-number-${index + 1}`}
                className="page-canvas__number"
                style={{
                  top: index * pagePeriodPx + geometry.margin.top / 2,
                  right: geometry.margin.right,
                  fontSize: geometry.bodyFontPx,
                }}
                aria-hidden="true"
              >
                {isMla && index > 0 && runningHead ? `${runningHead} ${index + 1}` : index + 1}
              </div>
            ))}
          {/* The running head repeated in the header of every page after the
              first; page one shows the editable block itself. */}
          {isPaged &&
            isApa &&
            runningHead &&
            Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => (
              <div
                key={`running-head-${index + 2}`}
                className="page-canvas__number page-canvas__running-head"
                style={{
                  top: (index + 1) * pagePeriodPx + geometry.margin.top / 2,
                  left: geometry.margin.left,
                  right: geometry.margin.right + geometry.bodyFontPx * 3,
                  fontSize: geometry.bodyFontPx,
                }}
                aria-hidden="true"
              >
                {runningHead}
              </div>
            ))}
        </div>
      </div>

      {/* Floating UI Elements */}
      <FloatingToolbar
        editor={editor}
        className="bg-background border border-border shadow-md rounded-lg p-1.5 flex gap-1 items-center z-50 animate-in fade-in zoom-in-95 duration-100"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => editor.commands.addPendingComment()}
          title="Add Comment"
          className="text-primary hover:bg-primary/10 h-7 px-2.5 flex items-center gap-1.5 text-xs font-bold transition-all rounded-md"
        >
          <Quote className="h-3.5 w-3.5" />
          Comment
        </Button>
      </FloatingToolbar>
      <FloatingThreads editor={editor} threads={threads} className="floating-threads" />
      <FloatingComposer editor={editor} className="floating-composer" />
    </div>
  );
}
