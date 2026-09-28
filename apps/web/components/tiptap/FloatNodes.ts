import { mergeAttributes, Node } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { FloatKind } from '../../lib/floatNumbering';

/**
 * Figures and tables — the two things IEEE calls floats.
 *
 * Both are a caption bound to a body, and the binding is what these nodes
 * exist for: a caption that is merely a paragraph next to an image drifts away
 * from it the moment anybody edits around it, and a figure whose caption has
 * drifted is worse than one with no caption at all.
 *
 * What they deliberately do *not* hold is their number. "Fig. 3" is a fact
 * about where the figure sits relative to the other figures, so inserting one
 * above it changes the number without changing the figure — the same reason
 * citation markers store a key rather than "[7]". The number is computed at
 * render time by `FloatNumbering` and painted from CSS. See `CitationExtension`
 * for the same decision written out at length.
 *
 * The structural difference between them is where the caption sits, and it is
 * not cosmetic: IEEE puts a figure's caption below the figure and a table's
 * above the table. Encoding that in the node's content expression rather than
 * in CSS means a document that round-trips through plain HTML still carries it.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    floats: {
      /** Inserts a figure, with an image if one is supplied. */
      insertFigure: (attributes?: { src?: string; alt?: string }) => ReturnType;
      /** Inserts a table with a caption block above it. */
      insertTableFigure: (options?: { rows?: number; cols?: number }) => ReturnType;
      /** Switches the float containing the selection between widths. */
      setFloatSpan: (span: FloatSpan) => ReturnType;
      /** Adds a note under the float containing the selection, or removes it. */
      toggleFloatNote: () => ReturnType;
    };
  }
}

/**
 * How wide the float is set.
 *
 * `column` is the default and fits inside one text column. `page` spans the
 * whole measure, which in a two-column format is what LaTeX's starred
 * environments (`figure*`, `table*`) do, and IEEE asks for those to sit at the
 * top or bottom of a page.
 */
export type FloatSpan = 'column' | 'page';

/**
 * A new float's identity.
 *
 * Stored on the node because it is identity rather than derived data: the
 * number changes whenever the paper is reordered, and a cross-reference has to
 * survive that. `crypto.randomUUID` is available in every browser this app
 * runs in; the fallback is for the server render, where no float is created.
 */
function newFloatId(kind: FloatKind): string {
  const random =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${kind === 'figure' ? 'fig' : 'tab'}-${random}`;
}

/** Attributes both floats share: their identity and how wide they are set. */
function floatAttributes(kind: FloatKind) {
  return {
    floatId: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.getAttribute('data-float-id'),
      // Generated on first render when absent, so a figure pasted in as plain
      // HTML joins the numbering instead of being skipped.
      renderHTML: (attributes: Record<string, unknown>) => ({
        'data-float-id': (attributes.floatId as string) ?? newFloatId(kind),
      }),
    },
    span: {
      default: 'column' as FloatSpan,
      parseHTML: (element: HTMLElement) =>
        element.getAttribute('data-span') === 'page' ? 'page' : 'column',
      renderHTML: (attributes: Record<string, unknown>) => ({
        'data-span': (attributes.span as string) ?? 'column',
      }),
    },
  };
}

/**
 * The caption text of a figure or a table.
 *
 * A node of its own rather than a paragraph, so that it cannot be turned into
 * a heading or a list item, and so the stylesheet can address "the caption"
 * without guessing from position. The "Fig. 1." or "TABLE I" that precedes it
 * is not part of the content — it is drawn by CSS from the number the
 * numbering pass works out.
 */
export const FloatCaption = Node.create({
  name: 'floatCaption',
  content: 'inline*',
  // Kept out of the ordinary block group so it can only exist inside a float.
  group: 'floatCaption',
  defining: true,

  parseHTML() {
    return [{ tag: 'figcaption' }, { tag: 'caption' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figcaption', mergeAttributes(HTMLAttributes, { class: 'float-caption' }), 0];
  },
});

/**
 * The note under a table or figure — APA's "Note. The survey item read as
 * follows…". Optional, and only ever the last thing in a float.
 *
 * The leading "Note." is not typed: the editor draws it from CSS and print
 * writes it into the markup, the same arrangement as the float's number. So
 * the note holds only what the author wrote, and cannot lose or duplicate its
 * label.
 */
export const FloatNote = Node.create({
  name: 'floatNote',
  content: 'inline*',
  group: 'floatNote',
  defining: true,

  parseHTML() {
    // Above the paragraph rule, which would otherwise claim the <p>.
    return [{ tag: 'p[data-float-note]', priority: 60 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'p',
      mergeAttributes(HTMLAttributes, { 'data-float-note': '', class: 'float-note' }),
      0,
    ];
  },
});

/**
 * A figure: an image with its caption underneath.
 *
 * The image is a child node rather than an attribute so that an empty figure
 * is a valid, visible thing — an author can place the figure, write its
 * caption, and drop the artwork in afterwards, which is the order people
 * actually work in.
 */
export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  // Caption last: IEEE sets a figure caption below the figure. APA moves it
  // above in the stylesheet. An optional note always comes last.
  content: 'image floatCaption floatNote?',
  draggable: true,
  isolating: true,

  addAttributes() {
    return floatAttributes('figure');
  },

  parseHTML() {
    return [{ tag: 'figure[data-float="figure"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { 'data-float': 'figure', class: 'float float-figure' }),
      0,
    ];
  },

  addCommands() {
    return {
      insertFigure:
        (attributes = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { floatId: newFloatId('figure'), span: 'column' },
            content: [
              { type: 'image', attrs: { src: attributes.src ?? '', alt: attributes.alt ?? '' } },
              // Sentence case, as IEEE sets figure captions.
              { type: 'floatCaption', content: [{ type: 'text', text: 'Caption' }] },
            ],
          }),

      setFloatSpan:
        (span: FloatSpan) =>
        ({ commands, state }) => {
          const name = floatNameAt(state.selection.$from);
          return name ? commands.updateAttributes(name, { span }) : false;
        },

      toggleFloatNote:
        () =>
        ({ state, tr, dispatch }) => {
          const float = floatAt(state.selection.$from);
          if (!float) return false;

          const noteType = state.schema.nodes.floatNote;
          if (!noteType) return false;

          const last = float.node.lastChild;
          const end = float.pos + float.node.nodeSize - 1;

          if (dispatch) {
            if (last?.type === noteType) {
              tr.delete(end - last.nodeSize, end);
            } else {
              tr.insert(end, noteType.create());
              // Straight into the new note, so the author can start typing.
              tr.setSelection(TextSelection.create(tr.doc, end + 1));
            }
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
    };
  },
});

/**
 * A table with its caption above it.
 *
 * A wrapper around the ordinary table node rather than a replacement for it,
 * so every editing command the table extension provides — add a row, merge
 * cells, delete a column — keeps working untouched. All this adds is the
 * caption and the identity to number it by.
 */
export const TableFigure = Node.create({
  name: 'tableFigure',
  group: 'block',
  // Caption first: IEEE sets a table caption above the table. An optional
  // note sits under the table.
  content: 'floatCaption table floatNote?',
  draggable: true,
  isolating: true,

  addAttributes() {
    return floatAttributes('table');
  },

  parseHTML() {
    return [{ tag: 'figure[data-float="table"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { 'data-float': 'table', class: 'float float-table' }),
      0,
    ];
  },

  addCommands() {
    return {
      insertTableFigure:
        ({ rows = 3, cols = 3 } = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { floatId: newFloatId('table'), span: 'column' },
            content: [
              {
                type: 'floatCaption',
                // Significant words capitalised, as IEEE sets table titles.
                content: [{ type: 'text', text: 'Table Title' }],
              },
              buildTable(rows, cols),
            ],
          }),
    };
  },
});

/** A blank table: a header row of `cols` cells, then `rows - 1` body rows. */
function buildTable(rows: number, cols: number) {
  const row = (cellType: 'tableHeader' | 'tableCell') => ({
    type: 'tableRow',
    content: Array.from({ length: cols }, () => ({
      type: cellType,
      content: [{ type: 'paragraph' }],
    })),
  });

  return {
    type: 'table',
    content: [
      row('tableHeader'),
      ...Array.from({ length: Math.max(0, rows - 1) }, () => row('tableCell')),
    ],
  };
}

/** The name of the float node the given position sits inside, if any. */
export function floatNameAt(position: {
  depth: number;
  node: (depth: number) => PMNode;
}): 'figure' | 'tableFigure' | null {
  for (let depth = position.depth; depth > 0; depth--) {
    const name = position.node(depth).type.name;
    if (name === 'figure' || name === 'tableFigure') return name;
  }
  return null;
}

/** The float the given position sits inside, with its position. */
export function floatAt(position: {
  depth: number;
  node: (depth: number) => PMNode;
  before: (depth: number) => number;
}): { node: PMNode; pos: number } | null {
  for (let depth = position.depth; depth > 0; depth--) {
    const node = position.node(depth);
    if (node.type.name === 'figure' || node.type.name === 'tableFigure') {
      return { node, pos: position.before(depth) };
    }
  }
  return null;
}

/** The float kind a node name denotes, for the numbering pass. */
export function floatKindOf(nodeName: string): FloatKind | null {
  if (nodeName === 'figure') return 'figure';
  if (nodeName === 'tableFigure') return 'table';
  return null;
}
