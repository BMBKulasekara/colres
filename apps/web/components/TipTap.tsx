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
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { useMutation as useConvexMutation } from 'convex/react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Terminal,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface TipTapEditorProps {
  isPageScrolled?: boolean;
  initialContent?: string;
  onChange?: (html: string) => void;
  onEditorReady?: (editor: any) => void;
}

export default function TipTapEditor({
  isPageScrolled = false,
  initialContent,
  onChange,
  onEditorReady,
}: TipTapEditorProps) {
  const [isEditable, setIsEditable] = useState(true);

  const liveblocks = useLiveblocksExtension({
    initialContent,
  });

  const editor = useEditor({
    extensions: [
      liveblocks,
      StarterKit.configure({
        undoRedo: false, // Liveblocks handles history/undo-redo
        heading: {
          levels: [1, 2, 3],
        },
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
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  const { isBold, isItalic, isUnderline, isStrikethrough, isCode } = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive('bold') ?? false,
      isItalic: ctx.editor?.isActive('italic') ?? false,
      isUnderline: ctx.editor?.isActive('underline') ?? false,
      isStrikethrough: ctx.editor?.isActive('strike') ?? false,
      isCode: ctx.editor?.isActive('code') ?? false,
    }),
  });

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
        </div>
        <div>
          Status:{' '}
          <span className="font-semibold text-foreground">
            {isEditable ? 'Editing' : 'Read-only'}
          </span>
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
              title="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
              size="icon-xs"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </Button>
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
        </div>
      )}

      {/* Bubble Menu for Inline text highlighting / editing */}
      {editor && isEditable && (
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

      {/* Editor Area */}
      <div className="prose max-w-none bg-background min-h-[450px] p-4 w-full rounded-b-lg">
        <EditorContent editor={editor} />
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
