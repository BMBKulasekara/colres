import { Node } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { renderBibliographyHtml } from '../../lib/bibliographyHtml';
import {
  type CitationStyle,
  type DisplayReference,
  isAuthorDateStyle,
} from '../../lib/citationFormat';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bibliography: {
      /**
       * Puts a References section at the end of the document, or moves to the
       * one already there.
       */
      insertReferencesSection: () => ReturnType;
    };
  }
}

/**
 * The document's References section.
 *
 * The node is empty: it marks *where* the reference list belongs, and the list
 * itself is drawn from the bibliography at render time. This is the same
 * decision the citation markers make, for the same reason — an entry's text,
 * its number and its position in the list are all derived from data outside
 * the document, so writing them in would mean a stale copy in every document
 * whose bibliography has since been edited, and a burst of Yjs traffic every
 * time anyone adds a reference.
 *
 * Because it is empty, what the author actually owns is the section: the
 * heading above it, where it sits, whether it is there at all. Deleting the
 * node removes the section without touching a single reference, which is the
 * right relationship between the two.
 *
 * Serialised as `<div data-bibliography>`, which `printDocument` swaps for the
 * rendered list — so the list prints where the author put it rather than
 * wherever the exporter guessed.
 *
 * One known limit: being a single block, the paged preview cannot break the
 * list across a page — a long one is pushed whole onto the next page, and the
 * estimated page count is high by however much space that wastes. Print is not
 * affected, because there the list is real markup and CSS fragments it between
 * pages and columns an entry at a time. Fixing the preview would mean giving
 * the node real content, which is the trade this file exists to avoid.
 */

export interface BibliographyOptions {
  /**
   * The bibliography, read through a function rather than passed by value:
   * the editor is built once and the references keep changing underneath it,
   * so a plain option would freeze the list as it was on first render.
   */
  resolveReferences: () => readonly DisplayReference[];
  /** Citation keys in first-appearance order, which is the list's order. */
  resolveOrder: () => readonly string[];
  resolveStyle: () => CitationStyle;
}

interface BibliographyStorage {
  /** Re-render callbacks, one per live node view. */
  views: Set<() => void>;
}

/** Shown in place of the list while the bibliography is empty. */
function emptyHtml(style: CitationStyle): string {
  const order = isAuthorDateStyle(style)
    ? 'in alphabetical order by author'
    : 'numbered in the order the text first cites them';
  return `<p class="bib-empty">No references yet. Add them from the Refs panel and they will appear here, ${order}.</p>`;
}

/** The heading text that marks a References section an author typed by hand. */
const REFERENCES_HEADING = /^\s*references\s*$/i;

/** Position just after an existing References heading, if the document has one. */
function findReferencesHeading(doc: PMNode): number | null {
  let found: number | null = null;

  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === 'heading' && REFERENCES_HEADING.test(node.textContent)) {
      found = pos + node.nodeSize;
      return false;
    }
    return true;
  });

  return found;
}

/**
 * APA allows "Reference", singular, over a list of exactly one entry. The
 * heading is the author's own text, so it is never rewritten: the plural "s"
 * is hidden by a decoration instead, and comes straight back when a second
 * reference is added. Print makes the same change in its own copy.
 */
const singularLabelKey = new PluginKey<DecorationSet>('bibliographySingularLabel');

function singularLabelDecorations(doc: PMNode, singular: boolean): DecorationSet {
  if (!singular) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  let previous: { node: PMNode; pos: number } | null = null;

  doc.forEach((node, pos) => {
    if (
      node.type.name === 'bibliography' &&
      previous?.node.type.name === 'heading' &&
      previous.node.textContent === 'References'
    ) {
      const end = previous.pos + previous.node.nodeSize - 1;
      decorations.push(Decoration.inline(end - 1, end, { class: 'bib-heading-plural' }));
    }
    previous = { node, pos };
  });

  return DecorationSet.create(doc, decorations);
}

function findBibliography(doc: PMNode): number | null {
  let found: number | null = null;

  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === 'bibliography') {
      found = pos;
      return false;
    }
    return true;
  });

  return found;
}

export const Bibliography = Node.create<BibliographyOptions, BibliographyStorage>({
  name: 'bibliography',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      resolveReferences: () => [],
      resolveOrder: () => [],
      resolveStyle: () => 'numeric' as CitationStyle,
    };
  },

  addStorage() {
    return { views: new Set<() => void>() };
  },

  addProseMirrorPlugins() {
    const isSingular = () =>
      isAuthorDateStyle(this.options.resolveStyle()) &&
      this.options.resolveReferences().length === 1;

    return [
      new Plugin({
        key: singularLabelKey,
        state: {
          init: (_config, state) => singularLabelDecorations(state.doc, isSingular()),
          apply: (tr, current, _old, next) =>
            tr.docChanged || tr.getMeta(singularLabelKey)
              ? singularLabelDecorations(next.doc, isSingular())
              : current,
        },
        props: {
          decorations: (state) => singularLabelKey.getState(state) ?? DecorationSet.empty,
        },
      }),
    ];
  },

  parseHTML() {
    return [{ tag: 'div[data-bibliography]' }];
  },

  renderHTML() {
    // Rendered empty on purpose: the list is derived data and is filled in by
    // whoever is displaying the document. See `prepareDocumentForOutput`.
    return ['div', { 'data-bibliography': 'true' }];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.setAttribute('data-bibliography', 'true');
      dom.className = 'bib';
      // The list is generated, not typed: the caret has no business inside it.
      dom.contentEditable = 'false';

      const render = () => {
        const style = this.options.resolveStyle();
        dom.innerHTML =
          renderBibliographyHtml(
            this.options.resolveReferences(),
            this.options.resolveOrder(),
            style
          ) || emptyHtml(style);
      };

      render();
      this.storage.views.add(render);

      return {
        dom,
        // Nothing about the node can change — it has no attributes and no
        // content — so an update never needs the view rebuilt.
        update: () => true,
        // The rendered list is ours, not the author's typing; ProseMirror must
        // not try to read it back into the document.
        ignoreMutation: () => true,
        destroy: () => {
          this.storage.views.delete(render);
        },
      };
    };
  },

  addCommands() {
    return {
      insertReferencesSection:
        () =>
        ({ state, chain, commands }) => {
          const existing = findBibliography(state.doc);
          if (existing !== null) {
            // Already there: show the author where, rather than adding a second.
            return commands.setNodeSelection(existing) && commands.scrollIntoView();
          }

          // A References heading the author typed themselves is the section
          // they meant, so the list goes under it instead of starting a rival
          // section at the foot of the document.
          const afterHeading = findReferencesHeading(state.doc);
          if (afterHeading !== null) {
            return chain()
              .insertContentAt(afterHeading, { type: this.name })
              .scrollIntoView()
              .run();
          }

          // APA starts the reference list on a new page, under a centred bold
          // "References" — which is its Level 1 heading.
          if (isAuthorDateStyle(this.options.resolveStyle())) {
            return chain()
              .insertContentAt(state.doc.content.size, [
                { type: 'pageBreak' },
                {
                  type: 'heading',
                  attrs: { level: 1 },
                  content: [{ type: 'text', text: 'References' }],
                },
                { type: this.name },
              ])
              .scrollIntoView()
              .run();
          }

          return chain()
            .insertContentAt(state.doc.content.size, [
              {
                type: 'heading',
                // IEEE sets References as an unnumbered section, the same way
                // IEEEtran's \section* does — see SectionNumbering.
                attrs: { level: 2, unnumbered: true },
                content: [{ type: 'text', text: 'References' }],
              },
              { type: this.name },
            ])
            .scrollIntoView()
            .run();
        },
    };
  },
});

/**
 * Redraws every reference list in the editor.
 *
 * Needed because the list depends on things the document does not contain: a
 * reference being added, edited or deleted, or the citation order shifting,
 * changes what the list should say without changing the document at all, so
 * no transaction would otherwise arrive to prompt a redraw.
 */
export function refreshBibliography(editor: {
  storage: unknown;
  view?: Pick<EditorView, 'state' | 'dispatch'>;
}) {
  const storage = (editor.storage as Record<string, BibliographyStorage | undefined>).bibliography;
  for (const render of storage?.views ?? []) render();

  // The heading's singular/plural form depends on the entry count too.
  if (editor.view) {
    const tr = editor.view.state.tr;
    tr.setMeta(singularLabelKey, true);
    tr.setMeta('addToHistory', false);
    tr.setMeta('preventUpdate', true);
    editor.view.dispatch(tr);
  }
}

/** True when the document already has a References section. */
export function hasBibliography(editor: { state: { doc: PMNode } }): boolean {
  return findBibliography(editor.state.doc) !== null;
}
