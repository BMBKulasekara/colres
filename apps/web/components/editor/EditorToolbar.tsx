'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/ui/tooltip';
import type { Editor } from '@tiptap/core';
import {
  Bold,
  BookMarked,
  ChevronDown,
  Code,
  Columns2,
  Hash,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  MoreHorizontal,
  PanelLeft,
  PanelTop,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  SeparatorHorizontal,
  Strikethrough,
  Table as TableIcon,
  Terminal,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  Waypoints,
} from 'lucide-react';
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import type { DocumentStyleId } from '../../lib/pageGeometry';

/** The toolbar's view of the editor, computed once per transaction by the caller. */
export interface ToolbarState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isCode: boolean;
  isLink: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  headingLevel: number | null;
  isHeading: boolean;
  isUnnumbered: boolean;
  isInFloat: boolean;
  floatSpan: string;
  floatHasNote: boolean;
  hasSelection: boolean;
  hasReferencesSection: boolean;
  hasRunningHead: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const MOD = typeof navigator !== 'undefined' && /Mac|iP/.test(navigator.platform) ? '⌘' : 'Ctrl+';
const SHIFT = MOD === '⌘' ? '⇧' : 'Shift+';
const ALT = MOD === '⌘' ? '⌥' : 'Alt+';

/** Shortcut text for this platform: `shortcut('B')` is "⌘B" on a Mac, "Ctrl+B" elsewhere. */
export function shortcut(key: string, { shift = false, alt = false } = {}): string {
  return `${MOD}${alt ? ALT : ''}${shift ? SHIFT : ''}${key}`;
}

export const TABLE_SIZES: [number, number][] = [
  [2, 2],
  [3, 3],
  [4, 3],
  [5, 4],
];

function headingLabels(styleId: DocumentStyleId): Record<number, { label: string; hint?: string }> {
  if (styleId === 'apa') {
    return {
      1: { label: 'Level 1', hint: 'Centred, bold' },
      2: { label: 'Level 2', hint: 'Flush left, bold' },
      3: { label: 'Level 3', hint: 'Flush left, bold italic' },
      4: { label: 'Level 4', hint: 'Indented, bold, runs into the paragraph' },
      5: { label: 'Level 5', hint: 'Indented, bold italic, runs into the paragraph' },
    };
  }
  if (styleId === 'mla') {
    return {
      1: { label: 'Title', hint: 'Centred, plain; also Works Cited' },
      2: { label: 'Section heading', hint: 'Flush left, bold' },
      3: { label: 'Subheading', hint: 'Flush left, italic' },
    };
  }
  if (styleId === 'ieee') {
    return {
      1: { label: 'Paper title' },
      2: { label: 'Section', hint: 'I. INTRODUCTION' },
      3: { label: 'Subsection', hint: 'A. Italic heading' },
    };
  }
  return { 1: { label: 'Heading 1' }, 2: { label: 'Heading 2' }, 3: { label: 'Heading 3' } };
}

interface EditorToolbarProps {
  editor: Editor;
  state: ToolbarState;
  styleId: DocumentStyleId;
  isTwoColumn: boolean;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  isUploading: boolean;
  onInsertFigure: () => void;
  /** Opens the size picker for a new table. */
  onInsertTable: () => void;
  onSetLink: () => void;
  floats: readonly { id: string; label: string; caption: string }[];
  uncitedFloatIds: ReadonlySet<string>;
  onOpenCite: () => void;
  /** The open citation search, anchored under the Cite button. */
  citePicker: ReactNode;
  onComment: () => void;
  /** Shown on its own row while the caret is in a table. */
  tableToolbar?: ReactNode;
}

export function EditorToolbar({
  editor,
  state,
  styleId,
  isTwoColumn,
  outlineOpen,
  onToggleOutline,
  isUploading,
  onInsertFigure,
  onInsertTable,
  onSetLink,
  floats,
  uncitedFloatIds,
  onOpenCite,
  citePicker,
  onComment,
  tableToolbar,
}: EditorToolbarProps) {
  const isApa = styleId === 'apa';
  const isMla = styleId === 'mla';
  const headings = headingLabels(styleId);
  const levels = Object.keys(headings).map(Number);
  const currentBlock = state.headingLevel
    ? (headings[state.headingLevel]?.label ?? `Heading ${state.headingLevel}`)
    : 'Paragraph';
  const chain = () => editor.chain().focus();
  const citeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex h-11 items-center gap-1 overflow-x-auto px-2 sm:px-3"
      >
        <ToolbarButton
          label={outlineOpen ? 'Hide outline' : 'Show outline'}
          shortcutText={shortcut('\\')}
          pressed={outlineOpen}
          onClick={onToggleOutline}
        >
          <PanelLeft />
        </ToolbarButton>
        <Divider />

        <ToolbarButton
          label="Undo"
          shortcutText={shortcut('Z')}
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          shortcutText={shortcut('Z', { shift: true })}
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>
        <Divider />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="min-w-32 shrink-0 justify-between"
              aria-label={`Text style: ${currentBlock}`}
            >
              <span className="truncate">{currentBlock}</span>
              <ChevronDown aria-hidden="true" className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onSelect={() => chain().setParagraph().run()}>
              Paragraph
            </DropdownMenuItem>
            {levels.map((level) => (
              <DropdownMenuItem
                key={level}
                onSelect={() =>
                  chain()
                    .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 })
                    .run()
                }
                className="flex-col items-start gap-0"
              >
                <span className={state.headingLevel === level ? 'font-semibold' : ''}>
                  {headings[level]?.label}
                </span>
                {headings[level]?.hint && (
                  <span className="text-xs text-muted-foreground">{headings[level]?.hint}</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Numbering only means anything in a format that numbers its sections. */}
        {state.isHeading && styleId === 'ieee' && (
          <ToolbarButton
            label={
              state.isUnnumbered
                ? 'Number this section (I, II, III…)'
                : 'Leave this section unnumbered, like Acknowledgment and References'
            }
            pressed={!state.isUnnumbered}
            onClick={() =>
              chain().updateAttributes('heading', { unnumbered: !state.isUnnumbered }).run()
            }
          >
            <Hash />
          </ToolbarButton>
        )}
        <Divider />

        <ToolbarButton
          label="Bold"
          shortcutText={shortcut('B')}
          pressed={state.isBold}
          onClick={() => chain().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          shortcutText={shortcut('I')}
          pressed={state.isItalic}
          onClick={() => chain().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          shortcutText={shortcut('U')}
          pressed={state.isUnderline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={state.isStrikethrough || state.isCode ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  aria-label="More text formatting"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More formatting</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => chain().toggleStrike().run()}>
              <Strikethrough />
              Strikethrough
              <DropdownMenuShortcut>{shortcut('S', { shift: true })}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => chain().toggleCode().run()}>
              <Code />
              Inline code
              <DropdownMenuShortcut>{shortcut('E')}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => chain().unsetAllMarks().run()}>
              <RemoveFormatting />
              Clear formatting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Divider />

        <ToolbarButton
          label="Bulleted list"
          shortcutText={shortcut('8', { shift: true })}
          pressed={state.isBulletList}
          onClick={() => chain().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          shortcutText={shortcut('7', { shift: true })}
          pressed={state.isOrderedList}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton label="Link" pressed={state.isLink} onClick={onSetLink}>
          <Link2 />
        </ToolbarButton>
        {state.isLink && (
          <ToolbarButton label="Remove link" onClick={() => chain().unsetLink().run()}>
            <Unlink />
          </ToolbarButton>
        )}
        <Divider />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              {isUploading ? <Loader2 className="animate-spin" /> : <Plus aria-hidden="true" />}
              Insert
              <ChevronDown aria-hidden="true" className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Academic
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={onOpenCite}>
              <span className="w-4 text-center font-mono text-xs">[1]</span>
              Citation…
              <DropdownMenuShortcut>{shortcut('C', { shift: true })}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onInsertFigure} disabled={isUploading}>
              <ImageIcon />
              {isApa ? 'Figure (title above the image)' : 'Figure (image or graph)'}
              <DropdownMenuShortcut>{shortcut('F', { shift: true })}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <TableIcon className="size-4 text-muted-foreground" />
                Table
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {TABLE_SIZES.map(([rows, cols]) => (
                  <DropdownMenuItem
                    key={`${rows}x${cols}`}
                    onSelect={() => chain().insertTableFigure({ rows, cols }).run()}
                  >
                    {rows} × {cols}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onInsertTable}>Custom size…</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={floats.length === 0}>
                <Waypoints className="size-4 text-muted-foreground" />
                Cross-reference
                {uncitedFloatIds.size > 0 && (
                  <span className="ml-auto rounded-full bg-warning/12 px-1.5 text-xs text-warning">
                    {uncitedFloatIds.size} uncited
                  </span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                {floats.map((float) => (
                  <DropdownMenuItem
                    key={float.id}
                    onSelect={() => chain().insertCrossReference(float.id).run()}
                  >
                    <span className="shrink-0 font-medium">{float.label}</span>
                    <span className="truncate text-muted-foreground">
                      {float.caption || 'No caption yet'}
                    </span>
                    {uncitedFloatIds.has(float.id) && (
                      <span className="ml-auto shrink-0 text-xs text-warning">not cited</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={() => chain().insertReferencesSection().run()}>
              <BookMarked />
              {state.hasReferencesSection
                ? 'Go to References'
                : isMla
                  ? 'Works Cited section'
                  : 'References section'}
            </DropdownMenuItem>
            {(isApa || isMla) && (
              <DropdownMenuItem
                onSelect={() =>
                  chain()
                    .insertRunningHead(isMla ? 'Last Name' : undefined)
                    .run()
                }
              >
                <PanelTop />
                {isMla
                  ? state.hasRunningHead
                    ? 'Edit page header'
                    : 'Page header (last name)'
                  : state.hasRunningHead
                    ? 'Edit running head'
                    : 'Running head'}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Layout</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => chain().setPageBreak().run()}>
              <SeparatorHorizontal />
              Page break
              <DropdownMenuShortcut>{shortcut('↵')}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => chain().toggleBlockquote().run()}>
              <Quote />
              Quote
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => chain().toggleCodeBlock().run()}>
              <Terminal />
              Code block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={citeButtonRef}
                variant="outline"
                size="sm"
                onClick={onOpenCite}
                aria-haspopup="listbox"
              >
                <span className="font-mono text-xs">[1]</span>
                Cite
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Insert a citation <Kbd>{shortcut('C', { shift: true })}</Kbd>
            </TooltipContent>
          </Tooltip>
          {citePicker && <FixedBelow anchorRef={citeButtonRef}>{citePicker}</FixedBelow>}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            {/* aria-disabled rather than disabled, so the tooltip still explains why. */}
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              aria-disabled={!state.hasSelection}
              onClick={() => state.hasSelection && onComment()}
            >
              <MessageSquarePlus aria-hidden="true" />
              <span className="hidden md:inline">Comment</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {state.hasSelection ? 'Comment on the selection' : 'Select some text to comment on it'}{' '}
            <Kbd>{shortcut('M', { alt: true })}</Kbd>
          </TooltipContent>
        </Tooltip>

        {state.isInFloat && (
          <>
            <Divider />
            {isTwoColumn && (
              <ToolbarButton
                label={
                  state.floatSpan === 'page'
                    ? 'Set this float in one column'
                    : 'Span this float across both columns (on paper; Page View still previews one column)'
                }
                pressed={state.floatSpan === 'page'}
                onClick={() =>
                  chain()
                    .setFloatSpan(state.floatSpan === 'page' ? 'column' : 'page')
                    .run()
                }
              >
                <Columns2 />
              </ToolbarButton>
            )}
            <ToolbarButton
              label={
                state.floatHasNote
                  ? 'Remove the note under this float'
                  : 'Add a note under this float ("Note. …")'
              }
              pressed={state.floatHasNote}
              onClick={() => chain().toggleFloatNote().run()}
            >
              <MessageSquareText />
            </ToolbarButton>
          </>
        )}

        <p className="ml-auto hidden shrink-0 pl-3 text-sm text-muted-foreground xl:block">
          Type <Kbd>/</Kbd> for commands
        </p>
      </div>

      {tableToolbar && <div className="border-t border-border px-3 py-1.5">{tableToolbar}</div>}
    </div>
  );
}

function ToolbarButton({
  label,
  shortcutText,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcutText?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={pressed ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className="shrink-0"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcutText && <Kbd>{shortcutText}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Places a popover under an anchor with fixed positioning. The toolbar row
 * scrolls sideways on narrow screens, which would clip anything absolutely
 * positioned inside it.
 */
function FixedBelow({
  anchorRef,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchorRef]);

  if (!position) return null;
  return (
    <div className="fixed z-50" style={position}>
      {children}
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ml-1.5 font-mono opacity-70">{children}</kbd>;
}

function Divider() {
  return <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />;
}
