import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (citationKey: string) => ReturnType;
    };
  }
}

/**
 * An inline citation marker, e.g. `[vaswani2017]`.
 *
 * Stored in the document HTML as `<span data-citation="key">`, which means it
 * survives the Convex round-trip and, crucially, maps one-to-one onto
 * `\cite{key}` for the LaTeX export. The visible text is the citation key
 * rather than a number: numbering depends on the bibliography style and is
 * resolved by the reference list, whereas the key is stable and is what the
 * author actually manages.
 *
 * `atom: true` makes it a single indivisible unit, so a citation cannot be
 * half-deleted into an invalid state.
 */
export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      citationKey: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-citation') ?? '',
        renderHTML: (attributes) => ({ 'data-citation': attributes.citationKey }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-citation]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class:
          'citation-mark inline-flex items-center rounded bg-primary/10 text-primary px-1 py-0.5 text-[0.85em] font-medium align-baseline',
      }),
      `[${node.attrs.citationKey}]`,
    ];
  },

  renderText({ node }) {
    return `[${node.attrs.citationKey}]`;
  },

  addCommands() {
    return {
      insertCitation:
        (citationKey: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { citationKey } }),
    };
  },
});
