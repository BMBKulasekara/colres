import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (citationKey: string, locator?: string) => ReturnType;
      /** Sets or clears the page/section locator on the selected citation. */
      setCitationLocator: (locator: string) => ReturnType;
      /** Switches the selected citation between "(Smith, 2020)" and "Smith (2020)". */
      setCitationNarrative: (narrative: boolean) => ReturnType;
    };
  }
}

/**
 * An inline citation marker.
 *
 * Stored in the document HTML as `<span data-citation="key">`, which means it
 * survives the Convex round-trip and, crucially, maps one-to-one onto
 * `\cite{key}` for the LaTeX export. The *key* is what is stored, never the
 * number: IEEE numbers by order of first appearance, so the number changes
 * whenever an earlier citation is added or removed, while the key is stable
 * and is what the author actually manages.
 *
 * The visible "[1]" is therefore drawn at render time. It is supplied as
 * `data-citation-label` by the `CitationNumbering` extension and painted by
 * CSS, so the node carries no text of its own — see `globals.css`. Anything
 * rendering this HTML outside the editor has to resolve the label itself;
 * `printDocument` does.
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

      /**
       * A page, section, or equation reference for this mention — "p. 13",
       * "Sec. IV", "eq. (3)". IEEE sets it inside the brackets, after the
       * number: [1, p. 13]. It belongs to the mention rather than to the
       * source, which is why it lives on the node and not on the reference.
       */
      locator: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-locator') ?? '',
        renderHTML: (attributes) =>
          attributes.locator ? { 'data-locator': attributes.locator } : {},
      },

      /**
       * A narrative citation names the author as part of the sentence —
       * "Smith (2020) found" — instead of in parentheses. It changes only how
       * an author–date style draws the marker; a numbered style prints "[1]"
       * either way. Serialised only when set, so older documents round-trip
       * unchanged.
       */
      narrative: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-narrative') === 'true',
        renderHTML: (attributes) => (attributes.narrative ? { 'data-narrative': 'true' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-citation]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'citation-mark' })];
  },

  /** Copy and paste get the key, which is the durable identifier. */
  renderText({ node }) {
    const { citationKey, locator } = node.attrs;
    return locator ? `[${citationKey}, ${locator}]` : `[${citationKey}]`;
  },

  addCommands() {
    return {
      insertCitation:
        (citationKey: string, locator = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { citationKey, locator } }),

      setCitationLocator:
        (locator: string) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { locator: locator.trim() }),

      setCitationNarrative:
        (narrative: boolean) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { narrative }),
    };
  },
});
