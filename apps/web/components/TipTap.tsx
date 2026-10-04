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
import { Extension } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TableCell, TableHeader } from '@tiptap/extension-table';
import Underline from '@tiptap/extension-underline';
import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { useMutation as useConvexMutation } from 'convex/react';
import {
  Bold,
  BookMarked,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquarePlus,
  Quote,
  SeparatorHorizontal,
  Table as TableIcon,
  Terminal,
  Unlink,
  UserRound,
} from 'lucide-react';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CITATION_STYLE_LABELS,
  type CitationStyle,
  isAuthorDateStyle,
} from '../lib/citationFormat';
import type { TemplateSection } from '../lib/documentOutline';
import type { FloatScheme } from '../lib/floatNumbering';
import { getPageGeometry, PAGE_GAP_PX } from '../lib/pageGeometry';
import { useContributionTracker } from '../lib/useContributionTracker';
import { type CitableReference, CitePicker } from './editor/CitePicker';
import { DocumentOutline } from './editor/DocumentOutline';
import { type DocumentMenuActions, EditorMenuBar } from './editor/EditorMenuBar';
import { EditorStatusBar, type StatusWarning } from './editor/EditorStatusBar';
import { EditorToolbar, shortcut, type ToolbarState } from './editor/EditorToolbar';
import { useDocumentOutline } from './editor/useDocumentOutline';
import { useMediaQuery } from './editor/useMediaQuery';
import { ApaRoles, findRunningHead, RUNNING_HEAD_MAX, RunningHead } from './tiptap/ApaNodes';
import { Bibliography, hasBibliography, refreshBibliography } from './tiptap/BibliographyNode';
import { Citation } from './tiptap/CitationExtension';
import { CitationNumbering, refreshCitationNumbering } from './tiptap/CitationNumbering';
import { CrossReference } from './tiptap/CrossReferenceNode';
import { Figure, FloatCaption, FloatNote, floatAt, TableFigure } from './tiptap/FloatNodes';
import { FloatNumbering, getFloats } from './tiptap/FloatNumbering';
import { PageBreak } from './tiptap/PageBreakNode';
import { Pagination, setPagedView } from './tiptap/PaginationExtension';
import type { PrintableReference } from './tiptap/printDocument';
import { SectionNumbering } from './tiptap/SectionNumbering';
import { type SlashCommandItem, SlashCommands } from './tiptap/SlashCommands';
import { TableInsertDialog, TableToolbar } from './tiptap/TableControls';
import { getTableSelectionInfo, ResearchTable, ResearchTableRow } from './tiptap/TableExtensions';

/** Paged view is a personal reading preference, so it is remembered per browser. */
const PAGED_VIEW_STORAGE_KEY = 'colres:editor:paged-view';

/** Whether the outline is shown; unset means "on screens wide enough for it". */
const OUTLINE_STORAGE_KEY = 'colres:editor:outline';

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
  'This format sets two columns. Paged view shows the column flow; the continuous view does not.';

/**
 * y-prosemirror tags the transactions it applies from the shared document
 * with this meta key. That covers other people's edits, and also this
 * browser's own undo and redo, which it flags separately.
 */
const REMOTE_CHANGE_META = 'y-sync$';

function isLocalChange(
  meta: { isChangeOrigin?: boolean; isUndoRedoOperation?: boolean } | undefined
) {
  return !meta?.isChangeOrigin || meta.isUndoRedoOperation === true;
}

interface TipTapEditorProps {
  initialContent?: string;
  /**
   * Called with the document's HTML after every change. `isLocal` is false
   * for a change that arrived from a collaborator, which this browser does
   * not need to save — the collaborator's own browser does.
   */
  onChange?: (html: string, change: { isLocal: boolean }) => void;
  onEditorReady?: (editor: any) => void;
  /** `templateSnapshot.classOptions`, which decide page size and body size. */
  classOptions?: readonly string[];
  /** `templateSnapshot.documentClass` — decides margins, columns, typography. */
  documentClass?: string;
  /** The template's sections, for word budgets in the outline. */
  templateSections?: readonly TemplateSection[];
  /**
   * The bibliography, for resolving citation numbers and for printing the
   * reference list. Absent until the references query has loaded.
   */
  references?: readonly (PrintableReference & CitableReference)[];
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
  /** Opens the References panel, for adding a source the author cannot find. */
  onOpenReferences?: () => void;
  /** Saving, exporting and the side panels, for the File and View menus. */
  documentActions?: DocumentMenuActions;
  /** Reports focus mode, which hides the side panel the page thinks is open. */
  onFocusModeChange?: (focusMode: boolean) => void;
  /** The docked side panel, drawn to the right of the page when open. */
  panel?: ReactNode;
  /** The panel's icon rail, on the far right edge. */
  rail?: ReactNode;
  /** For people the document is shared with as viewer or commenter. */
  readOnly?: boolean;
}

/** How many times each source is cited, for the citation picker. */
function countCitations(doc: PMNode): Map<string, number> {
  const counts = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type.name === 'citation') {
      const key = String(node.attrs.citationKey ?? '');
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  return counts;
}

export default function TipTapEditor({
  initialContent,
  onChange,
  onEditorReady,
  classOptions,
  documentClass,
  templateSections,
  references,
  citationStyle = 'numeric',
  onCitationOrderChange,
  onUploadImage,
  onOpenReferences,
  documentActions,
  onFocusModeChange,
  panel,
  rail,
  readOnly = false,
}: TipTapEditorProps) {
  const [editMode, setIsEditable] = useState(true);
  // Read-only wins over the Editing/Reading switch; the server and the
  // Liveblocks room refuse edits from these users anyway.
  const isEditable = editMode && !readOnly;
  /** Focus mode leaves only the page: no outline, no side panel. */
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    onFocusModeChange?.(focusMode);
  }, [focusMode, onFocusModeChange]);
  const [isPaged, setIsPaged] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [citedCount, setCitedCount] = useState(0);

  /**
   * Figures and tables the prose never refers to.
   *
   * IEEE requires every one of them to be cited in the text, so this is a
   * defect rather than a preference — and one the author cannot see, which is
   * why the outline and status bar say so.
   */
  const [uncitedFloats, setUncitedFloats] = useState<{ id: string; label: string }[]>([]);
  const uncitedCallbackRef = useRef<((uncited: { id: string; label: string }[]) => void) | null>(
    setUncitedFloats
  );
  const uncitedFloatIds = useMemo(
    () => new Set(uncitedFloats.map((float) => float.id)),
    [uncitedFloats]
  );

  const [isUploading, setIsUploading] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /** The citation search, and how often each source was cited when it opened. */
  const [citePicker, setCitePicker] = useState<Map<string, number> | null>(null);

  const isWide = useMediaQuery('(min-width: 1280px)');
  const [outlinePreference, setOutlinePreference] = useState<boolean | null>(null);
  const outlineVisible = !focusMode && (outlinePreference ?? isWide);

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
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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

  /*
   * Actions reachable from keyboard shortcuts and slash commands. Both are
   * wired into extensions built once, so they read the current handlers
   * through this ref rather than capturing the first render's.
   */
  const actionsRef = useRef({
    openCite: () => {},
    insertFigure: () => {},
    insertTable: () => {},
    comment: () => {},
    toggleOutline: () => {},
  });

  const slashItemsRef = useRef<readonly SlashCommandItem[]>([]);

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
          setCitedCount(order.length);
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
        placeholder: 'Start writing, or type / for commands…',
      }),
      SlashCommands.configure({
        resolveItems: () => slashItemsRef.current,
      }),
      Extension.create({
        name: 'workspaceShortcuts',
        addKeyboardShortcuts: () => ({
          'Mod-Shift-c': () => {
            actionsRef.current.openCite();
            return true;
          },
          'Mod-Shift-f': () => {
            actionsRef.current.insertFigure();
            return true;
          },
          'Mod-Alt-m': () => {
            actionsRef.current.comment();
            return true;
          },
        }),
      }),
    ],
    onUpdate: ({ editor, transaction }) => {
      onChangeRef.current?.(editor.getHTML(), {
        isLocal: isLocalChange(transaction.getMeta(REMOTE_CHANGE_META)),
      });
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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(OUTLINE_STORAGE_KEY);
      if (stored !== null) setOutlinePreference(stored === 'true');
    } catch {
      // Falls back to showing the outline wherever it fits.
    }
  }, []);

  const toggleOutline = useCallback(() => {
    setOutlinePreference((previous) => {
      const next = !(previous ?? isWide);
      try {
        window.localStorage.setItem(OUTLINE_STORAGE_KEY, String(next));
      } catch {
        // As above.
      }
      return next;
    });
  }, [isWide]);

  // ⌘\ toggles the outline. The app sidebar owns that shortcut elsewhere; the
  // editor has no sidebar, so here the outline is the thing beside the page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        toggleOutline();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleOutline]);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      const current = ctx.editor;
      const headingLevel = current?.isActive('heading')
        ? Number(current.getAttributes('heading').level) || null
        : null;
      return {
        toolbar: {
          isBold: current?.isActive('bold') ?? false,
          isItalic: current?.isActive('italic') ?? false,
          isUnderline: current?.isActive('underline') ?? false,
          isStrikethrough: current?.isActive('strike') ?? false,
          isCode: current?.isActive('code') ?? false,
          isLink: current?.isActive('link') ?? false,
          isBulletList: current?.isActive('bulletList') ?? false,
          isOrderedList: current?.isActive('orderedList') ?? false,
          headingLevel,
          isHeading: headingLevel !== null,
          isUnnumbered: current?.getAttributes('heading').unnumbered === true,
          isInFloat:
            (current?.isActive('figure') ?? false) || (current?.isActive('tableFigure') ?? false),
          floatSpan:
            ((current?.getAttributes('figure').span ??
              current?.getAttributes('tableFigure').span) as string) ?? 'column',
          floatHasNote: current
            ? floatAt(current.state.selection.$from)?.node.lastChild?.type.name === 'floatNote'
            : false,
          hasSelection: current ? !current.state.selection.empty : false,
          hasReferencesSection: current ? hasBibliography(current) : false,
          hasRunningHead: current ? findRunningHead(current.state.doc) !== null : false,
          canUndo: current?.can().undo() ?? false,
          canRedo: current?.can().redo() ?? false,
        } satisfies ToolbarState,
        isCitation: current?.isActive('citation') ?? false,
        citationKey: (current?.getAttributes('citation').citationKey as string) ?? '',
        citationLocator: (current?.getAttributes('citation').locator as string) ?? '',
        citationNarrative: current?.getAttributes('citation').narrative === true,
        runningHead: current
          ? (findRunningHead(current.state.doc)?.node.textContent ?? null)
          : null,
        tableInfo: current ? getTableSelectionInfo(current.state) : null,
        // Floats in document order, for the outline and the cross-reference
        // menu. Read here so they refresh with the document.
        floats: current ? getFloats(current) : [],
      };
    },
  });

  const { outline, currentSection } = useDocumentOutline(editor, templateSections);

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

  const openCitePicker = useCallback(() => {
    if (!editor) return;
    setCitePicker(countCitations(editor.state.doc));
  }, [editor]);

  const closeCitePicker = useCallback(() => {
    setCitePicker(null);
    editor?.commands.focus();
  }, [editor]);

  /** Cites after the selection rather than over it, so selected text is kept. */
  const insertCitation = useCallback(
    (citationKey: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .setTextSelection(editor.state.selection.to)
        .insertCitation(citationKey)
        .run();
      setCitePicker(null);
    },
    [editor]
  );

  const addComment = useCallback(() => {
    if (!editor || editor.state.selection.empty) return;
    editor.chain().focus().addPendingComment().run();
  }, [editor]);

  actionsRef.current = {
    openCite: openCitePicker,
    insertFigure: () => imageInputRef.current?.click(),
    insertTable: () => setTableDialogOpen(true),
    comment: addComment,
    toggleOutline,
  };

  slashItemsRef.current = [
    {
      id: 'cite',
      title: 'Citation',
      group: 'Academic',
      icon: BookMarked,
      keywords: ['reference', 'source', 'bibliography'],
      shortcut: shortcut('C', { shift: true }),
      run: () => actionsRef.current.openCite(),
    },
    {
      id: 'figure',
      title: 'Figure',
      group: 'Academic',
      icon: ImageIcon,
      keywords: ['image', 'picture', 'graph', 'fig'],
      shortcut: shortcut('F', { shift: true }),
      run: () => actionsRef.current.insertFigure(),
    },
    {
      id: 'table',
      title: 'Table',
      group: 'Academic',
      icon: TableIcon,
      run: () => actionsRef.current.insertTable(),
    },
    {
      id: 'references',
      title: isMla ? 'Works Cited section' : 'References section',
      group: 'Academic',
      icon: BookMarked,
      keywords: ['bibliography', 'works cited'],
      run: (current) => current.chain().focus().insertReferencesSection().run(),
    },
    {
      id: 'h1',
      title: isApa ? 'Heading level 1' : 'Heading 1',
      group: 'Text',
      icon: Heading1,
      keywords: ['title'],
      run: (current) => current.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      title: geometry.styleId === 'ieee' ? 'Section heading' : 'Heading 2',
      group: 'Text',
      icon: Heading2,
      keywords: ['section'],
      run: (current) => current.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      title: geometry.styleId === 'ieee' ? 'Subsection heading' : 'Heading 3',
      group: 'Text',
      icon: Heading3,
      keywords: ['subsection'],
      run: (current) => current.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
      id: 'bullets',
      title: 'Bulleted list',
      group: 'Text',
      icon: List,
      run: (current) => current.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'numbers',
      title: 'Numbered list',
      group: 'Text',
      icon: ListOrdered,
      run: (current) => current.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'quote',
      title: 'Quote',
      group: 'Text',
      icon: Quote,
      keywords: ['blockquote'],
      run: (current) => current.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'code',
      title: 'Code block',
      group: 'Text',
      icon: Terminal,
      run: (current) => current.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'pagebreak',
      title: 'Page break',
      group: 'Layout',
      icon: SeparatorHorizontal,
      shortcut: shortcut('↵'),
      run: (current) => current.chain().focus().setPageBreak().run(),
    },
  ];

  const { threads } = useThreads({ query: { resolved: false } });
  const room = useRoom();
  useContributionTracker(editor, room.id);
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

  /** Scrolls a block to the top of the page area and puts the caret in it. */
  const jumpTo = useCallback(
    (pos: number) => {
      if (!editor) return;
      const dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) {
        dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setTextSelection(pos + 1)
        .run();
      if (!isWide) setOutlinePreference(false);
    },
    [editor, isWide]
  );

  const jumpToFloat = useCallback(
    (floatId: string) => {
      if (!editor) return;
      let found: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (found !== null) return false;
        if (node.attrs.floatId === floatId) {
          found = pos;
          return false;
        }
        return true;
      });
      if (found !== null) jumpTo(found);
    },
    [editor, jumpTo]
  );

  if (!editor || !editorState) {
    return null;
  }

  const {
    toolbar,
    isCitation,
    citationKey,
    citationLocator,
    citationNarrative,
    runningHead,
    tableInfo,
    floats,
  } = editorState;

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

  const warnings: StatusWarning[] = [];
  if (uncitedFloats.length > 0) {
    warnings.push({
      id: 'uncited-floats',
      text: `${uncitedFloats.map((float) => float.label).join(', ')} not cited`,
      detail: isApa
        ? 'APA Style expects every table and figure to be called out in the text before it appears.'
        : isMla
          ? 'MLA expects every table and figure to be referred to in the text, as in "(see fig. 1)".'
          : 'IEEE expects every figure and table to be mentioned in the text. Insert › Cross-reference adds one.',
    });
  }
  if (isApa && runningHead !== null && runningHead.length > RUNNING_HEAD_MAX) {
    warnings.push({
      id: 'running-head',
      text: `Running head ${runningHead.length}/${RUNNING_HEAD_MAX}`,
      detail: 'APA limits the running head to 50 characters, including spaces and punctuation.',
    });
  }

  const citePickerNode = citePicker ? (
    <CitePicker
      references={references ?? []}
      citedCounts={citePicker}
      onPick={insertCitation}
      onClose={closeCitePicker}
      onOpenReferences={() => {
        setCitePicker(null);
        onOpenReferences?.();
      }}
    />
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The figure picker, opened from the Insert menu, a slash command or ⌘⇧F. */}
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
        aria-hidden="true"
        tabIndex={-1}
      />

      <EditorMenuBar
        editor={editor}
        state={toolbar}
        styleId={geometry.styleId}
        isEditable={isEditable}
        words={outline.totalWords}
        isUploading={isUploading}
        onInsertFigure={() => imageInputRef.current?.click()}
        onInsertTable={() => setTableDialogOpen(true)}
        tableInfo={tableInfo}
        onSetLink={setLink}
        floats={floats}
        uncitedFloatIds={uncitedFloatIds}
        onOpenCite={openCitePicker}
        onComment={addComment}
        isPaged={isPaged}
        onPagedChange={setIsPaged}
        outlineOpen={outlineVisible}
        onToggleOutline={toggleOutline}
        focusMode={focusMode}
        onFocusModeChange={setFocusMode}
        documentActions={documentActions}
      />

      {isEditable && (
        <EditorToolbar
          editor={editor}
          state={toolbar}
          styleId={geometry.styleId}
          isTwoColumn={isTwoColumn}
          outlineOpen={outlineVisible}
          onToggleOutline={toggleOutline}
          isUploading={isUploading}
          onInsertFigure={() => imageInputRef.current?.click()}
          onInsertTable={() => setTableDialogOpen(true)}
          onSetLink={setLink}
          floats={floats}
          uncitedFloatIds={uncitedFloatIds}
          onOpenCite={openCitePicker}
          citePicker={citePickerNode}
          onComment={addComment}
          tableToolbar={tableInfo ? <TableToolbar editor={editor} info={tableInfo} /> : undefined}
        />
      )}

      <TableInsertDialog editor={editor} open={tableDialogOpen} onOpenChange={setTableDialogOpen} />

      <div className="relative flex min-h-0 flex-1">
        {outlineVisible && (
          <>
            {/* The scrim is a pointer convenience; ⌘\ and the toolbar close the outline too. */}
            {!isWide && (
              <div
                aria-hidden="true"
                onClick={toggleOutline}
                className="absolute inset-0 z-20 bg-foreground/20"
              />
            )}
            <aside
              className={`flex w-64 shrink-0 flex-col border-r border-border bg-card ${
                isWide ? '' : 'absolute inset-y-0 left-0 z-30 shadow-lg'
              }`}
            >
              <DocumentOutline
                outline={outline}
                currentSection={currentSection}
                floats={floats}
                uncitedFloatIds={uncitedFloatIds}
                citedCount={citedCount}
                onJumpToSection={jumpTo}
                onJumpToFloat={jumpToFloat}
              />
            </aside>
          </>
        )}

        {/* The page. Both modes render the same element structure so that
            toggling only swaps classes: remounting <EditorContent> would tear
            the ProseMirror DOM out of the page and drop the caret. */}
        <main
          id="document"
          aria-label="Document"
          tabIndex={-1}
          className={`min-w-0 flex-1 overflow-auto outline-none ${
            geometry.styleId === 'ieee' ? 'doc-ieee ' : ''
          }${isApa ? 'doc-apa ' : ''}${isMla ? 'doc-mla ' : ''}${
            geometry.styleId === 'default' ? 'doc-default ' : ''
          }${isPaged ? 'page-canvas-backdrop' : 'continuous-backdrop'}`}
        >
          <div
            className={
              isPaged
                ? `page-canvas${isTwoColumn ? ' page-canvas--columns' : ''}`
                : 'continuous-sheet'
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
        </main>

        {!focusMode && panel}
        {!focusMode && rail}
      </div>

      <EditorStatusBar
        sectionTitle={currentSection?.title ?? null}
        words={outline.totalWords}
        pageSummary={
          isPaged
            ? `${geometry.label}${isTwoColumn ? ' · 2 columns' : ''} · ~${pageCount} ${
                pageCount === 1 ? 'page' : 'pages'
              }`
            : null
        }
        pageNote={
          isTwoColumn ? `${COLUMN_LAYOUT_NOTE} ${APPROXIMATE_LAYOUT_NOTE}` : APPROXIMATE_LAYOUT_NOTE
        }
        citationStyleLabel={CITATION_STYLE_LABELS[citationStyle]}
        warnings={warnings}
        isPaged={isPaged}
        onPagedChange={setIsPaged}
        isEditable={isEditable}
        onEditableChange={setIsEditable}
      />

      {/* A selected citation gets its own menu: the only thing worth editing
          on one is the locator IEEE prints inside the brackets. */}
      {isEditable && isCitation && (
        <BubbleMenu
          editor={editor}
          pluginKey="citationBubble"
          options={{ placement: 'top', offset: 8 }}
        >
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-popover p-1.5 shadow-md">
            <span className="pl-0.5 font-mono text-xs text-muted-foreground">
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
                aria-pressed={citationNarrative}
                aria-label={
                  citationNarrative
                    ? 'Narrative: Smith (2020). Switch to parenthetical: (Smith, 2020)'
                    : 'Parenthetical: (Smith, 2020). Switch to narrative: Smith (2020)'
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
              className="h-7 w-24 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-primary"
            />
            {citationLocator && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => applyLocator('')}
                aria-label="Remove the page reference"
                title="Remove the page reference"
              >
                <Unlink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </BubbleMenu>
      )}

      {/* The selection toolbar: format, comment or cite right at the text. */}
      <FloatingToolbar
        editor={editor}
        className="z-50 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
      >
        <Button
          type="button"
          variant={toolbar.isBold ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
          aria-pressed={toolbar.isBold}
        >
          <Bold />
        </Button>
        <Button
          type="button"
          variant={toolbar.isItalic ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
          aria-pressed={toolbar.isItalic}
        >
          <Italic />
        </Button>
        <Button
          type="button"
          variant={toolbar.isLink ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={setLink}
          aria-label="Link"
          aria-pressed={toolbar.isLink}
        >
          <Link2 />
        </Button>
        <div aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="sm" onClick={addComment}>
          <MessageSquarePlus />
          Comment
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={openCitePicker}>
          <span className="font-mono text-xs">[1]</span>
          Cite
        </Button>
      </FloatingToolbar>
      <FloatingThreads editor={editor} threads={threads} className="floating-threads" />
      <FloatingComposer editor={editor} className="floating-composer" />
    </div>
  );
}
