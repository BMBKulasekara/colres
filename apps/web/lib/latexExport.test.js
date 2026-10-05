import assert from 'node:assert/strict';
import { test } from 'vitest';
import { collectImageSources, escapeLatex, toLatex } from './latexExport.ts';

const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const p = (...content) => ({ type: 'paragraph', content });
const h = (level, value, attrs = {}) => ({
  type: 'heading',
  attrs: { level, ...attrs },
  content: [text(value)],
});
const doc = (...content) => ({ type: 'doc', content });
const cite = (citationKey, attrs = {}) => ({ type: 'citation', attrs: { citationKey, ...attrs } });

const ieee = {
  documentClass: 'IEEEtran',
  classOptions: ['conference'],
  engine: 'pdflatex',
  bibTool: 'bibtex',
  citationStyle: 'ieee',
};

const vaswani = {
  citationKey: 'vaswani2017',
  type: 'inproceedings',
  title: 'Attention Is All You Need',
  authors: ['Ashish Vaswani', 'Noam Shazeer'],
  year: 2017,
  venue: 'NeurIPS',
};

const exportOf = (body, overrides = {}) =>
  toLatex({
    title: 'My Paper',
    doc: body,
    citationStyle: 'ieee',
    references: [vaswani],
    template: ieee,
    ...overrides,
  });

const tex = (body, overrides) => exportOf(body, overrides).files['main.tex'];

test('escapes every LaTeX special character', () => {
  assert.equal(
    escapeLatex('50% of R&D costs $5 #1 a_b {x} ~ ^ \\'),
    '50\\% of R\\&D costs \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}'
  );
});

test('special characters in body text and the title are escaped', () => {
  const out = tex(doc(p(text('Costs rose 5% & more'))), { title: 'R&D_Report' });
  assert.match(out, /Costs rose 5\\% \\& more/);
  assert.match(out, /\\title\{R\\&D\\_Report\}/);
});

test('uses the template class, options, and its own bibliography style', () => {
  const out = tex(doc(p(text('As shown '), cite('vaswani2017'))));
  assert.match(out, /\\documentclass\[conference\]\{IEEEtran\}/);
  assert.match(out, /\\cite\{vaswani2017\}/);
  assert.match(out, /\\bibliographystyle\{IEEEtran\}\n\\bibliography\{references\}/);
});

test('a blank document exports as a plain article with biblatex', () => {
  const out = tex(doc(p(text('Hi '), cite('vaswani2017'))), {
    template: undefined,
    citationStyle: 'apa',
  });
  assert.match(out, /\\documentclass\{article\}/);
  assert.match(out, /\\usepackage\[backend=biber,style=apa\]\{biblatex\}/);
  assert.match(out, /\\printbibliography/);
});

test('headings map to sectioning commands, and unnumbered ones are starred', () => {
  const out = tex(
    doc(h(1, 'Intro'), h(2, 'Background'), h(3, 'Detail'), h(1, 'Ack', { unnumbered: true }))
  );
  assert.match(out, /\\section\{Intro\}/);
  assert.match(out, /\\subsection\{Background\}/);
  assert.match(out, /\\subsubsection\{Detail\}/);
  assert.match(out, /\\section\*\{Ack\}/);
});

test('marks wrap text, and links keep their URL', () => {
  const out = tex(
    doc(
      p(
        text('bold', [{ type: 'bold' }]),
        text(' '),
        text('both', [{ type: 'bold' }, { type: 'italic' }]),
        text(' '),
        text('site', [{ type: 'link', attrs: { href: 'https://x.org/a%20b#top' } }])
      )
    )
  );
  assert.match(out, /\\textbf\{bold\}/);
  assert.match(out, /\\textit\{\\textbf\{both\}\}/);
  assert.match(out, /\\href\{https:\/\/x\.org\/a\\%20b\\#top\}\{site\}/);
});

test('lists become itemize and enumerate', () => {
  const item = (value) => ({ type: 'listItem', content: [p(text(value))] });
  const out = tex(
    doc(
      { type: 'bulletList', content: [item('one'), item('two')] },
      { type: 'orderedList', content: [item('first')] }
    )
  );
  assert.match(out, /\\begin\{itemize\}\n {2}\\item one\n {2}\\item two\n\\end\{itemize\}/);
  assert.match(out, /\\begin\{enumerate\}\n {2}\\item first\n\\end\{enumerate\}/);
});

test('citation locators and narrative citations', () => {
  const body = doc(
    p(cite('vaswani2017', { locator: 'p. 13' }), cite('vaswani2017', { narrative: true }))
  );
  assert.match(tex(body), /\\cite\[p\. 13\]\{vaswani2017\}\\cite\{vaswani2017\}/);

  const biblatex = tex(body, { template: { ...ieee, bibTool: 'biber' } });
  assert.match(biblatex, /\\textcite\{vaswani2017\}/);
});

test('an unknown citation key is reported', () => {
  const { warnings } = exportOf(doc(p(cite('ghost2020'))));
  assert.ok(warnings.some((w) => w.includes('ghost2020')));
});

test('a References heading on the bibliography is dropped, since it prints its own', () => {
  const out = tex(
    doc(p(cite('vaswani2017')), h(1, 'References', { unnumbered: true }), { type: 'bibliography' })
  );
  assert.doesNotMatch(out, /\\section\*?\{References\}/);
  assert.equal(out.match(/\\bibliography\{references\}/g)?.length, 1);
});

test('the bibliography is added at the end when the document cites but has none', () => {
  const out = tex(doc(p(cite('vaswani2017'))));
  assert.ok(out.indexOf('\\bibliography{references}') < out.indexOf('\\end{document}'));
});

test('no bibliography is set up for a document that never cites', () => {
  const result = exportOf(doc(p(text('plain'))), { references: [] });
  assert.doesNotMatch(result.files['main.tex'], /bibliography/);
  assert.equal(result.files['references.bib'], undefined);
});

test('references.bib is written from the references', () => {
  const bib = exportOf(doc(p(cite('vaswani2017')))).files['references.bib'];
  assert.match(bib, /@inproceedings\{vaswani2017,/);
  assert.match(bib, /booktitle = \{NeurIPS\}/);
});

test('the abstract section becomes an abstract environment after the title', () => {
  const out = tex(
    doc(h(1, 'Abstract'), p(text('We study things.')), h(1, 'Introduction'), p(text('Body.')))
  );
  assert.match(out, /\\maketitle\n\n\\begin\{abstract\}\nWe study things\.\n\\end\{abstract\}/);
  assert.doesNotMatch(out, /\\section\{Abstract\}/);
  assert.match(out, /\\section\{Introduction\}/);
});

test('acmart puts the abstract before \\maketitle; elsarticle inside frontmatter', () => {
  const body = doc(h(1, 'Abstract'), p(text('Summary.')));
  assert.match(
    tex(body, { template: { ...ieee, documentClass: 'acmart' } }),
    /\\begin\{abstract\}\nSummary\.\n\\end\{abstract\}\n\n\\maketitle/
  );
  assert.match(
    tex(body, { template: { ...ieee, documentClass: 'elsarticle' } }),
    /\\begin\{frontmatter\}\n\\begin\{abstract\}/
  );
});

test('apa7 takes the abstract and running head in the preamble', () => {
  const out = tex(
    doc(
      { type: 'runningHead', content: [text('SHORT TITLE')] },
      h(1, 'Abstract', { apaRole: 'abstract' }),
      p(text('Sum.'))
    ),
    {
      template: { ...ieee, documentClass: 'apa7', bibTool: 'biber', citationStyle: 'apa' },
      citationStyle: 'apa',
    }
  );
  assert.match(out, /\\shorttitle\{SHORT TITLE\}/);
  assert.match(out, /\\abstract\{Sum\.\}/);
  assert.doesNotMatch(out, /\\begin\{abstract\}/);
});

test('figures get the downloaded image, caption and label; cross-references use \\ref', () => {
  const figure = {
    type: 'figure',
    attrs: { floatId: 'abc-1', span: 'column' },
    content: [
      { type: 'image', attrs: { src: 'https://cdn/img1' } },
      { type: 'floatCaption', content: [text('Results')] },
    ],
  };
  const body = doc(
    p(text('See '), { type: 'crossReference', attrs: { floatId: 'abc-1' } }),
    figure
  );
  const out = tex(body, { images: new Map([['https://cdn/img1', 'figures/figure-1.png']]) });

  assert.match(out, /See Fig\.~\\ref\{fig:abc-1\}/);
  assert.match(out, /\\begin\{figure\}\[htbp\]/);
  assert.match(out, /\\includegraphics\[width=\\linewidth\]\{figures\/figure-1\.png\}/);
  assert.match(out, /\\caption\{Results\}\n {2}\\label\{fig:abc-1\}/);
});

test('a figure whose image was not downloaded gets a placeholder and a warning', () => {
  const figure = {
    type: 'figure',
    attrs: { floatId: 'f', span: 'page' },
    content: [
      { type: 'image', attrs: { src: 'https://cdn/missing' } },
      { type: 'floatCaption', content: [] },
    ],
  };
  const { files, warnings } = exportOf(doc(figure));
  assert.match(files['main.tex'], /\\begin\{figure\*\}/);
  assert.match(files['main.tex'], /Image not exported/);
  assert.ok(warnings.some((w) => w.includes('image')));
});

test('tables become tabular with a rule under the header row', () => {
  const cell = (type, value, attrs = {}) => ({ type, attrs, content: [p(text(value))] });
  const table = {
    type: 'tableFigure',
    attrs: { floatId: 't1' },
    content: [
      { type: 'floatCaption', content: [text('Scores')] },
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell('tableHeader', 'Model'), cell('tableHeader', 'F1')] },
          { type: 'tableRow', content: [cell('tableCell', 'Ours'), cell('tableCell', '0.9')] },
        ],
      },
    ],
  };
  const out = tex(doc(table));
  assert.match(out, /\\caption\{Scores\}\n {2}\\label\{tab:t1\}/);
  assert.match(out, /\\begin\{tabular\}\{ll\}/);
  assert.match(out, /\\textbf\{Model\} & \\textbf\{F1\} \\\\\n {4}\\midrule\n {4}Ours & 0\.9 \\\\/);
});

test('row and column spans fill the positions they cover', () => {
  const cell = (value, attrs = {}) => ({ type: 'tableCell', attrs, content: [p(text(value))] });
  const out = tex(
    doc({
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('A', { rowspan: 2 }), cell('B'), cell('C')] },
        { type: 'tableRow', content: [cell('D', { colspan: 2 })] },
      ],
    })
  );
  assert.match(out, /\\usepackage\{multirow\}/);
  assert.match(out, /\\multirow\{2\}\{\*\}\{A\} & B & C \\\\/);
  assert.match(out, / & \\multicolumn\{2\}\{l\}\{D\} \\\\/);
});

test('the engine is recorded for latexmk and Overleaf', () => {
  assert.match(exportOf(doc()).files.latexmkrc, /\$pdf_mode = 1;/);
  assert.match(
    exportOf(doc(), { template: { ...ieee, engine: 'xelatex' } }).files.latexmkrc,
    /\$pdf_mode = 5;/
  );
  assert.match(
    tex(doc(), { template: { ...ieee, engine: 'xelatex' } }),
    /\\usepackage\{fontspec\}/
  );
});

test('collects image sources once each, in document order', () => {
  const img = (src) => ({ type: 'figure', content: [{ type: 'image', attrs: { src } }] });
  assert.deepEqual(collectImageSources(doc(img('a'), img('b'), img('a'))), ['a', 'b']);
});
