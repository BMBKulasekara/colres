import { Extension } from '@tiptap/core';

/**
 * Lets an individual heading opt out of automatic section numbering.
 *
 * IEEE numbers its sections in Roman numerals and its subsections in letters,
 * but not all of them: Acknowledgment and References are set as unnumbered
 * sections, exactly as `\section*` does in IEEEtran. The numbers themselves
 * are drawn by CSS counters rather than written into the text, so that moving
 * or inserting a section renumbers the rest without anyone retyping anything
 * — which means the exception has to live on the heading as an attribute the
 * stylesheet can see.
 *
 * It is added as a global attribute rather than by replacing StarterKit's
 * heading, so the heading node keeps every behaviour it already had and old
 * documents load unchanged: a heading with no attribute is simply numbered.
 */
export const SectionNumbering = Extension.create({
  name: 'sectionNumbering',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          unnumbered: {
            default: false,
            parseHTML: (element) => element.getAttribute('data-unnumbered') === 'true',
            // Only serialised when true, so the common case adds no markup and
            // documents written before this existed round-trip untouched.
            renderHTML: (attributes) =>
              attributes.unnumbered ? { 'data-unnumbered': 'true' } : {},
          },
        },
      },
    ];
  },
});
