'use client';

import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { useEffect, useMemo, useState } from 'react';
import {
  buildOutline,
  countWords,
  type Outline,
  type OutlineBlock,
  runInSectionTitle,
  sectionAt,
  type TemplateSection,
} from '../../lib/documentOutline';

/** Recounting walks the whole document, so it waits for a pause in typing. */
const RECOUNT_DELAY_MS = 250;

const EMPTY_OUTLINE: Outline = { sections: [], totalWords: 0, totalTarget: 0, missing: [] };

/** Flattens the document into the blocks the outline is built from. */
function readBlocks(doc: PMNode): OutlineBlock[] {
  const blocks: OutlineBlock[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === 'heading') {
      blocks.push({
        kind: 'heading',
        level: Number(node.attrs.level) || 1,
        text: node.textContent.trim(),
        pos: offset,
      });
      return;
    }

    const text = node.textContent;
    if (node.type.name === 'paragraph') {
      const runIn = runInSectionTitle(text);
      if (runIn) {
        blocks.push({
          kind: 'runIn',
          title: runIn.title,
          words: countWords(runIn.rest),
          pos: offset,
        });
        return;
      }
    }
    blocks.push({ kind: 'text', words: countWords(text) });
  });
  return blocks;
}

/**
 * The live outline of the document in the editor, and the section the caret
 * is in. Shared by the outline sidebar and the status bar.
 */
export function useDocumentOutline(
  editor: Editor | null,
  templateSections: readonly TemplateSection[] | undefined
) {
  const [blocks, setBlocks] = useState<OutlineBlock[]>([]);
  const [caretPos, setCaretPos] = useState(0);

  useEffect(() => {
    if (!editor) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const recount = () => setBlocks(readBlocks(editor.state.doc));
    const scheduleRecount = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recount, RECOUNT_DELAY_MS);
    };
    const trackCaret = () => setCaretPos(editor.state.selection.from);

    recount();
    trackCaret();
    editor.on('update', scheduleRecount);
    editor.on('selectionUpdate', trackCaret);
    return () => {
      if (timer) clearTimeout(timer);
      editor.off('update', scheduleRecount);
      editor.off('selectionUpdate', trackCaret);
    };
  }, [editor]);

  const outline = useMemo(
    () => (blocks.length === 0 ? EMPTY_OUTLINE : buildOutline(blocks, templateSections ?? [])),
    [blocks, templateSections]
  );

  const currentSection = sectionAt(outline.sections, caretPos);

  return { outline, currentSection };
}
