'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  IconBlockquote,
  IconBold,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconItalic,
  IconLineDashed,
  IconList,
  IconListNumbers,
  IconTypography,
  IconUnderline,
} from '@tabler/icons-react';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

interface TemplateContentEditorProps {
  value: string;
  onChange: (html: string) => void;
}

/**
 * Non-collaborative rich text editor for authoring template skeletons.
 *
 * Deliberately loads the same node set as the reader-facing editor
 * (StarterKit + Underline + Link). Anything outside that schema — a table, for
 * instance — is silently dropped when a document seeded from this template is
 * opened, so authoring against a wider schema would produce templates that
 * quietly lose content.
 *
 * This does not reuse the web app's editor component: that one is built around
 * the Liveblocks extension, threads, and floating composers, none of which
 * apply here.
 */
export function TemplateContentEditor({ value, onChange }: TemplateContentEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    content: value,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Placeholder.configure({
        placeholder: 'Author the template body here. Use {{TOKENS}} for wizard fields.',
      }),
    ],
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Re-seed when the loaded template changes underneath us (for example after
  // switching records), but not on every keystroke. Depending on `editor` here
  // would re-run this on every editor state change, resetting the document
  // mid-edit and moving the caret.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on `value` alone; see above
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value]);

  if (!editor) {
    return <div className="min-h-[400px] rounded-lg border border-border bg-muted/20" />;
  }

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1.5">
        <ToolButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <IconBold size={15} />
        </ToolButton>
        <ToolButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <IconItalic size={15} />
        </ToolButton>
        <ToolButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <IconUnderline size={15} />
        </ToolButton>
        <ToolButton
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >
          <IconCode size={15} />
        </ToolButton>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolButton
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Title (H1)"
        >
          <IconH1 size={15} />
        </ToolButton>
        <ToolButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Section (H2)"
        >
          <IconH2 size={15} />
        </ToolButton>
        <ToolButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Subsection (H3)"
        >
          <IconH3 size={15} />
        </ToolButton>
        <ToolButton
          active={editor.isActive('paragraph') && !editor.isActive('heading')}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Paragraph"
        >
          <IconTypography size={15} />
        </ToolButton>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <IconList size={15} />
        </ToolButton>
        <ToolButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <IconListNumbers size={15} />
        </ToolButton>
        <ToolButton
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Guidance callout (blockquote)"
        >
          <IconBlockquote size={15} />
        </ToolButton>
        <ToolButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider"
        >
          <IconLineDashed size={15} />
        </ToolButton>
      </div>

      <div className="prose prose-sm max-w-none p-4 min-h-[400px] [&_.ProseMirror]:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="h-7 w-7"
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}
