import assert from 'node:assert/strict';
import { test } from 'vitest';
import { mlaLocator, repeatedAuthors } from './authorPage.ts';
import { renderBibliographyHtml } from './bibliographyHtml.ts';
import { bibliographyHeading, formatReferenceText, mlaPageRange } from './citationFormat.ts';
import { labelCitations } from './citationLabels.ts';

/**
 * Harvard (Cite Them Right), MLA 9 and Vancouver (NLM). The same references
 * are set in each, to show that switching style applies each style's own
 * rules — author lists, what is italic or quoted, dates, page ranges — and not
 * just different punctuation.
 */

const grady = {
  citationKey: 'grady2019',
  type: 'article',
  authors: ['Jessica S. Grady', 'Malena Her', 'Geena Moreno', 'Catherine Perez', 'Jelinne Yelinek'],
  title:
    'Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the {United States}',
  venue: 'Psychology of Popular Media Culture',
  volume: '8',
  number: '3',
  pages: '207-217',
  doi: '10.1037/ppm0000185',
  year: 2019,
};

const sapolsky = {
  citationKey: 'sapolsky2017',
  type: 'book',
  authors: ['Robert M. Sapolsky'],
  title: 'Behave: The biology of humans at our best and worst',
  publisher: 'Penguin Books',
  address: 'New York',
  year: 2017,
};

const rybaczewska = {
  citationKey: 'ryb2022',
  type: 'article',
  authors: ['Magdalena Rybaczewska', 'Leigh Sparks'],
  title: 'Ageing consumers and e-commerce activities',
  venue: 'Ageing and Society',
  volume: '42',
  number: '8',
  pages: '1879-1898',
  doi: '10.1017/S0144686X20001932',
  year: 2022,
};

const cite = (citationKey, extra = {}) => ({ citationKey, adjacentToPrevious: false, ...extra });
const labels = (occurrences, references, style) =>
  labelCitations(occurrences, references, style).labels.map((label) => label.text);

/* Harvard ------------------------------------------------------------------ */

test('harvard: journal article — year without a full stop, quoted title, italic journal', () => {
  assert.equal(
    formatReferenceText(grady, 'harvard'),
    "Grady, J.S., Her, M., Moreno, G., Perez, C. and Yelinek, J. (2019) 'Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the United States', Psychology of Popular Media Culture, 8(3), pp. 207–217. Available at: https://doi.org/10.1037/ppm0000185"
  );
});

test('harvard: book — place and publisher', () => {
  assert.equal(
    formatReferenceText(sapolsky, 'harvard'),
    'Sapolsky, R.M. (2017) Behave: The biology of humans at our best and worst. New York: Penguin Books.'
  );
});

test('harvard: web page — available at, with the date accessed', () => {
  assert.equal(
    formatReferenceText(
      {
        citationKey: 'w',
        type: 'misc',
        authors: ['{World Health Organization}'],
        title: 'The top 10 causes of death',
        url: 'https://www.who.int/news-room/fact-sheets/detail/the-top-10-causes-of-death',
        accessed: Date.parse('2022-07-18'),
      },
      'harvard'
    ),
    'World Health Organization (no date) The top 10 causes of death. Available at: https://www.who.int/news-room/fact-sheets/detail/the-top-10-causes-of-death (Accessed: 18 July 2022).'
  );
});

test('harvard: in-text — "and" not "&", up to three names, then et al.', () => {
  const three = { ...sapolsky, citationKey: 'three', authors: ['A Smith', 'B Jones', 'C Brown'] };
  assert.deepEqual(labels([cite('ryb2022')], [rybaczewska], 'harvard'), [
    '(Rybaczewska and Sparks, 2022)',
  ]);
  assert.deepEqual(labels([cite('three')], [three], 'harvard'), ['(Smith, Jones and Brown, 2017)']);
  assert.deepEqual(labels([cite('grady2019', { locator: 'p. 210' })], [grady], 'harvard'), [
    '(Grady et al., 2019, p. 210)',
  ]);
  assert.deepEqual(labels([cite('ryb2022', { narrative: true })], [rybaczewska], 'harvard'), [
    'Rybaczewska and Sparks (2022)',
  ]);
  const undated = { ...sapolsky, citationKey: 'nd', year: undefined };
  assert.deepEqual(labels([cite('nd')], [undated], 'harvard'), ['(Sapolsky, no date)']);
});

/* MLA ---------------------------------------------------------------------- */

test('mla: page ranges keep only the digits that change', () => {
  assert.equal(mlaPageRange('207-217'), '207–17');
  assert.equal(mlaPageRange('1879-1898'), '1879–98');
  assert.equal(mlaPageRange('98-110'), '98–110');
  assert.equal(mlaPageRange('1296-1301'), '1296–301');
});

test('mla: journal article — three or more authors become "et al.", title in title case', () => {
  assert.equal(
    formatReferenceText(grady, 'mla'),
    'Grady, Jessica S., et al. "Emotions in Storybooks: A Comparison of Storybooks That Represent Ethnic and Racial Groups in the United States." Psychology of Popular Media Culture, vol. 8, no. 3, 2019, pp. 207–17, https://doi.org/10.1037/ppm0000185.'
  );
});

test('mla: two authors — the second in normal order', () => {
  assert.equal(
    formatReferenceText(rybaczewska, 'mla'),
    'Rybaczewska, Magdalena, and Leigh Sparks. "Ageing Consumers and E-Commerce Activities." Ageing and Society, vol. 42, no. 8, 2022, pp. 1879–98, https://doi.org/10.1017/S0144686X20001932.'
  );
});

test('mla: book — publisher then year, no place', () => {
  assert.equal(
    formatReferenceText(sapolsky, 'mla'),
    'Sapolsky, Robert M. Behave: The Biology of Humans at Our Best and Worst. Penguin Books, 2017.'
  );
});

test('mla: in-text — author and page, no comma and no "p."', () => {
  assert.equal(mlaLocator('pp. 45-47'), '45–47');
  assert.equal(mlaLocator('para. 3'), 'par. 3');
  assert.deepEqual(labels([cite('grady2019', { locator: 'p. 210' })], [grady], 'mla'), [
    '(Grady et al. 210)',
  ]);
  assert.deepEqual(labels([cite('ryb2022')], [rybaczewska], 'mla'), ['(Rybaczewska and Sparks)']);
  assert.deepEqual(
    labels([cite('ryb2022', { narrative: true, locator: 'p. 1880' })], [rybaczewska], 'mla'),
    ['Rybaczewska and Sparks (1880)']
  );
  assert.deepEqual(
    labels(
      [
        cite('sapolsky2017', { locator: 'p. 4' }),
        cite('ryb2022', { adjacentToPrevious: true, locator: 'p. 1880' }),
      ],
      [sapolsky, rybaczewska],
      'mla'
    ),
    ['(Rybaczewska and Sparks 1880; Sapolsky 4)', '']
  );
});

test('mla: two works by one author are told apart by a short title', () => {
  const second = {
    ...sapolsky,
    citationKey: 'sapolsky2004',
    title: 'Why zebras do not get ulcers',
    year: 2004,
  };
  const result = labelCitations(
    [cite('sapolsky2017', { locator: 'p. 4' })],
    [sapolsky, second],
    'mla'
  );
  assert.equal(result.labels[0].text, '(Sapolsky, Behave 4)');
  assert.deepEqual(result.labels[0].segments, [
    { text: '(Sapolsky, ' },
    { text: 'Behave', italic: true },
    { text: ' 4)' },
  ]);
  // Works Cited: by title, and the repeated name becomes three hyphens.
  assert.deepEqual([...repeatedAuthors([sapolsky, second])], ['sapolsky2004']);
  assert.match(
    renderBibliographyHtml([second, sapolsky], ['sapolsky2017'], 'mla'),
    /Sapolsky, Robert M\. <i>Behave.*---\. <i>Why Zebras Do Not Get Ulcers/
  );
});

/* Vancouver ---------------------------------------------------------------- */

test('vancouver: journal article — NLM names, sentence case, no italics, shortened pages', () => {
  assert.equal(
    formatReferenceText(grady, 'vancouver'),
    'Grady JS, Her M, Moreno G, Perez C, Yelinek J. Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the United States. Psychology of Popular Media Culture. 2019;8(3):207-17. doi: 10.1037/ppm0000185'
  );
});

test('vancouver: more than six authors — six, then et al.', () => {
  const many = { ...grady, authors: ['A Aa', 'B Bb', 'C Cc', 'D Dd', 'E Ee', 'F Ff', 'G Gg'] };
  assert.match(
    formatReferenceText(many, 'vancouver'),
    /^Aa A, Bb B, Cc C, Dd D, Ee E, Ff F, et al\. /
  );
});

test('vancouver: in-text numbers in one set of parentheses', () => {
  const refs = [grady, sapolsky, rybaczewska, { ...sapolsky, citationKey: 'four' }];
  const occurrences = [
    cite('grady2019'),
    cite('sapolsky2017', { adjacentToPrevious: true }),
    cite('ryb2022', { adjacentToPrevious: true }),
    cite('four', { adjacentToPrevious: false, locator: 'p. 4' }),
  ];
  assert.deepEqual(labels(occurrences, refs, 'vancouver'), ['(1–3)', '', '', '(4, p. 4)']);
  // IEEE is unchanged.
  assert.deepEqual(labels(occurrences, refs, 'ieee'), ['[1]–[3]', '', '', '[4, p. 4]']);
});

/* Switching style ---------------------------------------------------------- */

test('the same citation in each style', () => {
  const occurrence = [cite('grady2019', { locator: 'p. 210' })];
  assert.deepEqual(
    ['apa', 'harvard', 'mla', 'ieee', 'vancouver'].map(
      (style) => labels(occurrence, [grady], style)[0]
    ),
    [
      '(Grady et al., 2019, p. 210)',
      '(Grady et al., 2019, p. 210)',
      '(Grady et al. 210)',
      '[1, p. 210]',
      '(1, p. 210)',
    ]
  );
  assert.deepEqual(['apa', 'harvard', 'mla', 'ieee'].map(bibliographyHeading), [
    'References',
    'Reference list',
    'Works Cited',
    'References',
  ]);
});

test('mla: a book read from a PDF — one source gives both the entry and the citation', () => {
  const book = {
    citationKey: 'wallacewells2019',
    type: 'book',
    authors: ['David Wallace-Wells'],
    title: 'The uninhabitable earth',
    publisher: 'Crown',
    year: 2019,
  };
  assert.equal(
    formatReferenceText(book, 'mla'),
    'Wallace-Wells, David. The Uninhabitable Earth. Crown, 2019.'
  );
  assert.deepEqual(labels([cite('wallacewells2019', { locator: '11' })], [book], 'mla'), [
    '(Wallace-Wells 11)',
  ]);
  // The same source, switched to APA, is set again from its fields — not
  // converted from the MLA text.
  assert.deepEqual(labels([cite('wallacewells2019', { locator: 'p. 11' })], [book], 'apa'), [
    '(Wallace-Wells, 2019, p. 11)',
  ]);
});

test('mla: in-text — page ranges in full, several pages with commas, no author by title', () => {
  const one = { ...sapolsky, citationKey: 'moore', authors: ['John Moore'] };
  assert.deepEqual(labels([cite('moore', { locator: '37-42' })], [one], 'mla'), ['(Moore 37–42)']);
  assert.deepEqual(labels([cite('moore', { locator: '37, 42' })], [one], 'mla'), [
    '(Moore 37, 42)',
  ]);
  const anonymous = {
    citationKey: 'climate',
    type: 'article',
    authors: [],
    title: 'Climate change',
    venue: 'The Economist',
    year: 2020,
  };
  assert.deepEqual(labels([cite('climate', { locator: '12' })], [anonymous], 'mla'), [
    '("Climate Change" 12)',
  ]);
});
