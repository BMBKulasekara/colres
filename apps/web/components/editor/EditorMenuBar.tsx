'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@repo/ui/components/ui/menubar';
import type { Editor } from '@tiptap/core';
import {
  Bell,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  BookMarked,
  ClipboardPaste,
  Copy,
  Download,
  FileCode,
  FilePlus2,
  Files,
  FileText,
  Globe,
  Image as ImageIcon,
  Keyboard,
  Link2,
  MessageSquarePlus,
  PanelTop,
  Quote,
  Redo2,
  Save,
  Scissors,
  SeparatorHorizontal,
  SunMoon,
  TableColumnsSplit,
  Table as TableIcon,
  TableRowsSplit,
  Terminal,
  TextSelect,
  Trash2,
  Undo2,
  Waypoints,
  WholeWord,
} from 'lucide-react';
import { type ComponentProps, useRef, useState } from 'react';
import type { DocumentStyleId } from '../../lib/pageGeometry';
import { NOTIFICATION_OPTIONS, useNotificationSettings } from '../../lib/useNotificationSettings';
import { THEME_OPTIONS, type ThemePreference, useTheme } from '../../lib/useTheme';
import type { TableSelectionInfo } from '../tiptap/TableExtensions';
import { shortcut, TABLE_SIZES, type ToolbarState } from './EditorToolbar';
import { PANELS, type PanelId } from './SidePanel';

const numberFormat = new Intl.NumberFormat();

const plural = (count: number, word: string) =>
  `${count === 1 ? '' : `${count} `}${word}${count === 1 ? '' : 's'}`;

/**
 * What the File and View menus need from the page that owns the document.
 * The editor itself knows nothing about saving, printing or side panels.
 */
export interface DocumentMenuActions {
  onNewDocument: () => void;
  onOpenDocuments: () => void;
  onSave: () => void;
  onPrint: () => void;
  onDownloadHtml: () => void;
  /** LaTeX project as a zip. The menu item is hidden when absent. */
  onDownloadLatex?: () => void;
  activePanel: PanelId | null;
  onSelectPanel: (panel: PanelId | null) => void;
}

const SHORTCUT_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Document',
    items: [
      ['Save now', shortcut('S')],
      ['Print / save as PDF', shortcut('P')],
      ['Undo', shortcut('Z')],
      ['Redo', shortcut('Z', { shift: true })],
      ['Show or hide the outline', shortcut('\\')],
      ['Show or hide the side panel', shortcut('/')],
    ],
  },
  {
    title: 'Insert',
    items: [
      ['Commands', '/'],
      ['Citation', shortcut('C', { shift: true })],
      ['Figure', shortcut('F', { shift: true })],
      ['Comment on the selection', shortcut('M', { alt: true })],
      ['Page break', shortcut('↵')],
    ],
  },
  {
    title: 'Formatting',
    items: [
      ['Bold', shortcut('B')],
      ['Italic', shortcut('I')],
      ['Underline', shortcut('U')],
      ['Strikethrough', shortcut('S', { shift: true })],
      ['Inline code', shortcut('E')],
      ['Bulleted list', shortcut('8', { shift: true })],
      ['Numbered list', shortcut('7', { shift: true })],
    ],
  },
];

interface EditorMenuBarProps {
  editor: Editor;
  state: ToolbarState;
  styleId: DocumentStyleId;
  /** False in viewing mode, where Edit and Insert have nothing to act on. */
  isEditable: boolean;
  words: number;
  isUploading: boolean;
  onInsertFigure: () => void;
  /** Opens the size picker for a new table. */
  onInsertTable: () => void;
  /** The table the caret is in, or null outside one. */
  tableInfo: TableSelectionInfo | null;
  onSetLink: () => void;
  floats: readonly { id: string; label: string; caption: string }[];
  uncitedFloatIds: ReadonlySet<string>;
  onOpenCite: () => void;
  onComment: () => void;
  isPaged: boolean;
  onPagedChange: (paged: boolean) => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  focusMode: boolean;
  onFocusModeChange: (focus: boolean) => void;
  /** Absent when the editor is embedded without a document page around it. */
  documentActions?: DocumentMenuActions;
}

/**
 * The File / Edit / Insert / View / Help menus above the formatting toolbar.
 * Every item calls a command the editor already had; nothing here decides how
 * a format lays a document out.
 */
export function EditorMenuBar({
  editor,
  state,
  styleId,
  isEditable,
  words,
  isUploading,
  onInsertFigure,
  onInsertTable,
  tableInfo,
  onSetLink,
  floats,
  uncitedFloatIds,
  onOpenCite,
  onComment,
  isPaged,
  onPagedChange,
  outlineOpen,
  onToggleOutline,
  focusMode,
  onFocusModeChange,
  documentActions,
}: EditorMenuBarProps) {
  const isApa = styleId === 'apa';
  const isMla = styleId === 'mla';
  const chain = () => editor.chain().focus();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [notifications, setNotificationEnabled] = useNotificationSettings();
  const [theme, setTheme] = useTheme();

  // A menu hands focus back to its trigger when it closes, which would pull
  // the caret out of the document right after a command put it there.
  const actedRef = useRef(false);
  const act = (run: () => void) => () => {
    actedRef.current = true;
    run();
  };
  const contentProps = {
    onCloseAutoFocus: (event: Event) => {
      if (actedRef.current) event.preventDefault();
      actedRef.current = false;
    },
  } satisfies ComponentProps<typeof MenubarContent>;

  /** Cut and copy go through the browser so the editor's own handlers run. */
  const clipboardCommand = (command: 'cut' | 'copy') => {
    editor.view.focus();
    document.execCommand(command);
  };

  const paste = async () => {
    editor.view.focus();
    try {
      if (navigator.clipboard.read) {
        for (const item of await navigator.clipboard.read()) {
          if (item.types.includes('text/html')) {
            editor.view.pasteHTML(await (await item.getType('text/html')).text());
            return;
          }
        }
      }
      const text = await navigator.clipboard.readText();
      if (text) editor.view.pasteText(text);
    } catch (error) {
      // The browser refused clipboard access; the keyboard shortcut still works.
      console.error('The clipboard could not be read:', error);
    }
  };

  return (
    <>
      <Menubar
        aria-label="Editor menu"
        className="h-9 shrink-0 overflow-x-auto border-b border-border bg-card px-2 sm:px-3"
      >
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent {...contentProps} className="w-64">
            {documentActions && (
              <>
                <MenubarItem onSelect={act(documentActions.onNewDocument)}>
                  <FilePlus2 />
                  New document
                </MenubarItem>
                <MenubarItem onSelect={act(documentActions.onOpenDocuments)}>
                  <Files />
                  All documents
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onSelect={act(documentActions.onSave)}>
                  <Save />
                  Save now
                  <MenubarShortcut>{shortcut('S')}</MenubarShortcut>
                </MenubarItem>
              </>
            )}
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <WholeWord className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              Word count
              <MenubarShortcut className="tabular-nums">
                {numberFormat.format(words)}
              </MenubarShortcut>
            </div>
            {documentActions && (
              <>
                <MenubarSeparator />
                <MenubarSub>
                  <MenubarSubTrigger>
                    <Download />
                    Download &amp; export
                  </MenubarSubTrigger>
                  <MenubarSubContent className="w-60">
                    <MenubarLabel>Download</MenubarLabel>
                    <MenubarItem onSelect={act(documentActions.onPrint)}>
                      <FileText />
                      PDF (print)
                      <MenubarShortcut>{shortcut('P')}</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator />
                    <MenubarLabel>Export as</MenubarLabel>
                    <MenubarItem onSelect={act(documentActions.onDownloadHtml)}>
                      <Globe />
                      Web page
                      <MenubarShortcut>.html</MenubarShortcut>
                    </MenubarItem>
                    {documentActions.onDownloadLatex && (
                      <MenubarItem onSelect={act(documentActions.onDownloadLatex)}>
                        <FileCode />
                        LaTeX project
                        <MenubarShortcut>.zip</MenubarShortcut>
                      </MenubarItem>
                    )}
                  </MenubarSubContent>
                </MenubarSub>
              </>
            )}
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent {...contentProps} className="w-56">
            <MenubarItem
              disabled={!isEditable || !state.canUndo}
              onSelect={act(() => chain().undo().run())}
            >
              <Undo2 />
              Undo
              <MenubarShortcut>{shortcut('Z')}</MenubarShortcut>
            </MenubarItem>
            <MenubarItem
              disabled={!isEditable || !state.canRedo}
              onSelect={act(() => chain().redo().run())}
            >
              <Redo2 />
              Redo
              <MenubarShortcut>{shortcut('Z', { shift: true })}</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              disabled={!isEditable || !state.hasSelection}
              onSelect={act(() => clipboardCommand('cut'))}
            >
              <Scissors />
              Cut
              <MenubarShortcut>{shortcut('X')}</MenubarShortcut>
            </MenubarItem>
            <MenubarItem
              disabled={!state.hasSelection}
              onSelect={act(() => clipboardCommand('copy'))}
            >
              <Copy />
              Copy
              <MenubarShortcut>{shortcut('C')}</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!isEditable} onSelect={act(() => void paste())}>
              <ClipboardPaste />
              Paste
              <MenubarShortcut>{shortcut('V')}</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onSelect={act(() => chain().selectAll().run())}>
              <TextSelect />
              Select all
              <MenubarShortcut>{shortcut('A')}</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger disabled={!isEditable}>Insert</MenubarTrigger>
          <MenubarContent {...contentProps} className="w-72">
            <MenubarLabel>Content</MenubarLabel>
            <MenubarItem disabled={isUploading} onSelect={act(onInsertFigure)}>
              <ImageIcon />
              {isApa ? 'Figure (title above the image)' : 'Figure (image or graph)'}
              <MenubarShortcut>{shortcut('F', { shift: true })}</MenubarShortcut>
            </MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger>
                <TableIcon />
                Table
              </MenubarSubTrigger>
              <MenubarSubContent>
                {TABLE_SIZES.map(([rows, cols]) => (
                  <MenubarItem
                    key={`${rows}x${cols}`}
                    onSelect={act(() => chain().insertTableFigure({ rows, cols }).run())}
                  >
                    {rows} × {cols}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
                <MenubarItem onSelect={act(onInsertTable)}>Custom size…</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarItem onSelect={act(() => chain().toggleCodeBlock().run())}>
              <Terminal />
              Code listing
            </MenubarItem>
            <MenubarItem onSelect={act(() => chain().toggleBlockquote().run())}>
              <Quote />
              Quote
            </MenubarItem>
            <MenubarItem onSelect={act(() => chain().setPageBreak().run())}>
              <SeparatorHorizontal />
              Page break
              <MenubarShortcut>{shortcut('↵')}</MenubarShortcut>
            </MenubarItem>

            <MenubarSeparator />
            <MenubarLabel>References</MenubarLabel>
            <MenubarItem onSelect={act(onOpenCite)}>
              <span className="w-4 text-center font-mono text-xs text-muted-foreground">[1]</span>
              Citation…
              <MenubarShortcut>{shortcut('C', { shift: true })}</MenubarShortcut>
            </MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger disabled={floats.length === 0}>
                <Waypoints />
                Cross reference
                {uncitedFloatIds.size > 0 && (
                  <span className="ml-auto rounded-full bg-warning/12 px-1.5 text-xs text-warning">
                    {uncitedFloatIds.size} uncited
                  </span>
                )}
              </MenubarSubTrigger>
              <MenubarSubContent className="w-64">
                {floats.map((float) => (
                  <MenubarItem
                    key={float.id}
                    onSelect={act(() => chain().insertCrossReference(float.id).run())}
                  >
                    <span className="shrink-0 font-medium">{float.label}</span>
                    <span className="truncate text-muted-foreground">
                      {float.caption || 'No caption yet'}
                    </span>
                    {uncitedFloatIds.has(float.id) && (
                      <span className="ml-auto shrink-0 text-xs text-warning">not cited</span>
                    )}
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>
            <MenubarItem onSelect={act(() => chain().insertReferencesSection().run())}>
              <BookMarked />
              {state.hasReferencesSection
                ? 'Go to References'
                : isMla
                  ? 'Works Cited section'
                  : 'References section'}
            </MenubarItem>
            {(isApa || isMla) && (
              <MenubarItem
                onSelect={act(() =>
                  chain()
                    .insertRunningHead(isMla ? 'Last Name' : undefined)
                    .run()
                )}
              >
                <PanelTop />
                {isMla
                  ? state.hasRunningHead
                    ? 'Edit page header'
                    : 'Page header (last name)'
                  : state.hasRunningHead
                    ? 'Edit running head'
                    : 'Running head'}
              </MenubarItem>
            )}
            <MenubarItem onSelect={act(onSetLink)}>
              <Link2 />
              Link
            </MenubarItem>

            <MenubarSeparator />
            <MenubarItem disabled={!state.hasSelection} onSelect={act(onComment)}>
              <MessageSquarePlus />
              Comment
              <MenubarShortcut>{shortcut('M', { alt: true })}</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger disabled={!isEditable}>Table</MenubarTrigger>
          <MenubarContent {...contentProps} className="w-64">
            <MenubarItem onSelect={act(onInsertTable)}>
              <TableIcon />
              Insert table…
            </MenubarItem>
            <MenubarSeparator />
            {!tableInfo && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Click inside a table to edit its rows and columns.
              </p>
            )}
            <MenubarItem disabled={!tableInfo} onSelect={act(() => chain().addRowBefore().run())}>
              <BetweenHorizontalStart />
              Insert row above
            </MenubarItem>
            <MenubarItem disabled={!tableInfo} onSelect={act(() => chain().addRowAfter().run())}>
              <BetweenHorizontalEnd />
              Insert row below
            </MenubarItem>
            <MenubarItem
              disabled={!tableInfo}
              onSelect={act(() => chain().addColumnBefore().run())}
            >
              <BetweenVerticalStart />
              Insert column left
            </MenubarItem>
            <MenubarItem disabled={!tableInfo} onSelect={act(() => chain().addColumnAfter().run())}>
              <BetweenVerticalEnd />
              Insert column right
            </MenubarItem>
            <MenubarSeparator />
            {/* Deleting every row or column would leave an empty table, which
                the schema does not allow; Delete table is the way to do that. */}
            <MenubarItem
              disabled={!tableInfo || tableInfo.rows >= tableInfo.totalRows}
              onSelect={act(() => chain().deleteRow().run())}
            >
              <TableRowsSplit />
              Delete {plural(tableInfo?.rows ?? 1, 'row')}
            </MenubarItem>
            <MenubarItem
              disabled={!tableInfo || tableInfo.cols >= tableInfo.totalCols}
              onSelect={act(() => chain().deleteColumn().run())}
            >
              <TableColumnsSplit />
              Delete {plural(tableInfo?.cols ?? 1, 'column')}
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              disabled={!tableInfo}
              onSelect={act(() => chain().deleteTable().run())}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="text-destructive" />
              Delete table
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent {...contentProps} className="w-60">
            <MenubarCheckboxItem checked={isPaged} onCheckedChange={onPagedChange}>
              Page view
            </MenubarCheckboxItem>
            <MenubarCheckboxItem
              checked={outlineOpen}
              disabled={focusMode}
              onCheckedChange={onToggleOutline}
            >
              Outline
              <MenubarShortcut>{shortcut('\\')}</MenubarShortcut>
            </MenubarCheckboxItem>
            <MenubarCheckboxItem checked={focusMode} onCheckedChange={onFocusModeChange}>
              Focus mode
            </MenubarCheckboxItem>
            {documentActions && (
              <>
                <MenubarSeparator />
                <MenubarLabel>Side panel</MenubarLabel>
                {PANELS.map((panel) => (
                  <MenubarCheckboxItem
                    key={panel.id}
                    checked={documentActions.activePanel === panel.id}
                    disabled={focusMode}
                    onCheckedChange={(checked) =>
                      documentActions.onSelectPanel(checked ? panel.id : null)
                    }
                  >
                    {panel.title}
                  </MenubarCheckboxItem>
                ))}
              </>
            )}
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Help</MenubarTrigger>
          <MenubarContent {...contentProps} className="w-56">
            <MenubarItem onSelect={act(() => setShortcutsOpen(true))}>
              <Keyboard />
              Keyboard shortcuts
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Settings</MenubarTrigger>
          <MenubarContent {...contentProps} className="w-56">
            <MenubarSub>
              <MenubarSubTrigger>
                <Bell />
                Notifications
              </MenubarSubTrigger>
              <MenubarSubContent className="w-52">
                <MenubarLabel>Show a badge for</MenubarLabel>
                {NOTIFICATION_OPTIONS.map((option) => (
                  <MenubarCheckboxItem
                    key={option.id}
                    checked={notifications[option.id]}
                    onCheckedChange={(checked) => setNotificationEnabled(option.id, checked)}
                    // Left open, so several can be switched in one visit.
                    onSelect={(event) => event.preventDefault()}
                  >
                    {option.label}
                  </MenubarCheckboxItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSub>
              <MenubarSubTrigger>
                <SunMoon />
                Appearance
              </MenubarSubTrigger>
              <MenubarSubContent className="w-40">
                <MenubarRadioGroup
                  value={theme}
                  onValueChange={(value) => setTheme(value as ThemePreference)}
                >
                  {THEME_OPTIONS.map((option) => (
                    <MenubarRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </MenubarRadioItem>
                  ))}
                </MenubarRadioGroup>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Everything the editor answers to from the keys.</DialogDescription>
          </DialogHeader>
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {group.title}
              </h3>
              <dl className="divide-y divide-border text-sm">
                {group.items.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between py-1.5">
                    <dt>{label}</dt>
                    <dd>
                      <kbd className="font-mono text-xs text-muted-foreground">{keys}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
