import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    crossReference: {
      /** Inserts a reference to the figure or table with this id. */
      insertCrossReference: (floatId: string) => ReturnType;
    };
  }
}

/**
 * An in-text reference to a figure or a table — "as illustrated in Fig. 1".
 *
 * IEEE requires every figure and table to be mentioned in the prose, which
 * means these are not a convenience: they are how the paper meets the rule.
 * Typing "Fig. 1" by hand meets it only until somebody inserts a figure above
 * it, at which point the prose points at the wrong picture and nothing in the
 * document knows.
 *
 * So, exactly like a citation marker, the node stores the float's *id* and
 * carries no text of its own. The visible "Fig. 1" is supplied as
 * `data-xref-label` by `FloatNumbering` and drawn by CSS, which means it is
 * recomputed from the document on every change and cannot fall out of step
 * with the caption. A reference whose target has been deleted renders as a
 * visible marker rather than vanishing — a dangling reference the author can
 * see is a problem they can fix.
 */
export const CrossReference = Node.create({
  name: 'crossReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      floatId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-xref') ?? '',
        renderHTML: (attributes) => ({ 'data-xref': attributes.floatId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-xref]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'xref-mark' })];
  },

  /** Copy and paste get the label's stable half, which is the id. */
  renderText({ node }) {
    return `[${node.attrs.floatId}]`;
  },

  addCommands() {
    return {
      insertCrossReference:
        (floatId: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { floatId } }),
    };
  },
});
