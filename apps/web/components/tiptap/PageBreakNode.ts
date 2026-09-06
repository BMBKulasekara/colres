import { Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

/**
 * An author-inserted hard page break.
 *
 * Unlike the automatic breaks computed by the pagination extension, this one
 * is a real node in the document. That is deliberate: automatic breaks are a
 * measurement of the current viewport and must stay local to each client,
 * whereas a hard break is authorial intent and has to be identical for every
 * collaborator and survive the Convex round-trip. Being a node, it syncs
 * through Yjs like any other content.
 *
 * It is stored as `<div data-page-break>`, which the print stylesheet turns
 * into a `break-after: page`.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML() {
    return ['div', { 'data-page-break': '', class: 'page-break' }];
  },

  renderText() {
    return '\n';
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name })
            // Without a trailing paragraph a break inserted at the end of the
            // document leaves the author with nowhere to type on the new page.
            .command(({ tr, state, dispatch }) => {
              const paragraph = state.schema.nodes.paragraph;
              const { $to } = tr.selection;
              if (!paragraph || $to.nodeAfter || $to.parent.type.name !== 'doc') return true;
              if (dispatch) tr.insert(tr.selection.to, paragraph.create());
              return true;
            })
            .run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    };
  },
});
