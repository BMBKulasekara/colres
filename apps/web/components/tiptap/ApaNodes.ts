import { Extension, Node } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    runningHead: {
      /**
       * Adds a running head at the top of the paper, or selects the one there.
       * `placeholder` is the text a new one starts with, selected for typing over.
       */
      insertRunningHead: (placeholder?: string) => ReturnType;
    };
  }
}

/**
 * APA allows 50 characters in a running head, counting spaces and
 * punctuation.
 */
export const RUNNING_HEAD_MAX = 50;

/**
 * The running head: an abbreviated title, in capitals, at the top left of
 * every page. It is required for professional papers and optional for student
 * papers.
 *
 * It lives in the document, not in metadata, because it is part of the paper
 * that collaborators edit like any other text. It is stored as it was typed
 * and shown in capitals by the stylesheet, so fixing a typo never means
 * retyping in capitals. The editor draws it in the page header of page one and
 * repeats it on every later page; print moves it into each page's header.
 * Wherever it is placed in the document, it prints in the header and nowhere
 * else, so there is only ever one.
 *
 * An MLA paper uses the same node for its page header, the author's last name,
 * drawn at the top right beside the page number and never in capitals.
 */
export const RunningHead = Node.create({
  name: 'runningHead',
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,

  parseHTML() {
    // Above the paragraph rule, which would otherwise claim the <p>.
    return [{ tag: 'p[data-running-head]', priority: 60 }];
  },

  renderHTML() {
    return ['p', { 'data-running-head': '', class: 'running-head' }, 0];
  },

  addCommands() {
    return {
      insertRunningHead:
        (placeholder = 'Shortened Title') =>
        ({ state, chain, commands }) => {
          const existing = findRunningHead(state.doc);
          if (existing) return commands.setTextSelection(existing.pos + 1);

          return chain()
            .insertContentAt(0, {
              type: this.name,
              content: [{ type: 'text', text: placeholder }],
            })
            .setTextSelection({ from: 1, to: 1 + placeholder.length })
            .run();
        },
    };
  },
});

/** The running head and its position, if the document has one. */
export function findRunningHead(doc: PMNode): { node: PMNode; pos: number } | null {
  let found: { node: PMNode; pos: number } | null = null;
  doc.forEach((node, pos) => {
    if (!found && node.type.name === 'runningHead') found = { node, pos };
  });
  return found;
}

/**
 * The job a heading does on an APA page, where it differs from an ordinary
 * section heading:
 *
 *  - `author-note`: the "Author Note" label on a professional title page. It
 *    is set in the bottom half of the page, and the paragraphs after it are
 *    left-aligned and indented rather than centred like the rest of the page.
 *  - `abstract`: the "Abstract" label. The paragraph under it starts flush
 *    left instead of indented.
 *
 * A global attribute rather than new node types, so these stay ordinary
 * headings for navigation, and a document without them loads unchanged.
 */
export const ApaRoles = Extension.create({
  name: 'apaRoles',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          apaRole: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-apa-role'),
            renderHTML: (attributes) =>
              attributes.apaRole ? { 'data-apa-role': attributes.apaRole } : {},
          },
        },
      },
    ];
  },
});
