import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inTextName,
  labelAuthorDateCitations,
  sortAuthorDate,
  yearSuffixes,
} from './authorDate.ts';
import { orderBibliography } from './citationNumbering.ts';

/**
 * APA 7 in-text citations and reference-list order. The rules under test are
 * the ones a reader relies on to get from "(Smith, 2020a)" in the text to the
 * right entry in the list, so the list and the text are checked together.
 */

const ref = (citationKey, authors, year, title = citationKey, type = 'article') => ({
  citationKey,
  authors,
  year,
  title,
  type,
});

const cite = (citationKey, adjacentToPrevious, locator) => ({
  citationKey,
  adjacentToPrevious: adjacentToPrevious === true,
  locator,
});

const labels = (occurrences, references) =>
  labelAuthorDateCitations(occurrences, references).labels.map((label) => label.text);

test('one, two, and three or more authors', () => {
  assert.equal(inTextName(ref('a', ['Jane Smith'], 2020)), 'Smith');
  assert.equal(inTextName(ref('b', ['Jane Smith', 'Tom Jones'], 2020)), 'Smith & Jones');
  assert.equal(inTextName(ref('c', ['Jane Smith', 'Tom Jones', 'Ann Lee'], 2020)), 'Smith et al.');
});

test('no author: the title in title case, quoted for an article, bare for a book', () => {
  assert.equal(inTextName(ref('a', [], 2020, 'Study finds', 'article')), '"Study Finds"');
  assert.equal(inTextName(ref('b', [], 2020, 'Big Book', 'book')), 'Big Book');
});

test('no author: a quoted title takes the comma inside the quotation marks', () => {
  // APA's Wikipedia example: listed as "Oil painting", cited ("Oil Painting," 2019).
  const references = [ref('oil', [], 2019, 'Oil painting', 'incollection')];
  assert.deepEqual(labels([cite('oil')], references), ['("Oil Painting," 2019)']);
  assert.deepEqual(labels([{ ...cite('oil'), narrative: true }], references), [
    '"Oil Painting" (2019)',
  ]);
  assert.equal(
    inTextName(
      ref('d', [], 2015, 'Diagram of the tibia–basitarsis joint in {Apis melifera}', 'incollection')
    ),
    '"Diagram of the Tibia–Basitarsis Joint in Apis melifera"'
  );
});

test('a group author is cited by its full name, never split into initials', () => {
  const references = [
    ref('nimh', ['{National Institute of Mental Health}'], 2019),
    ref('stanford', ['{Stanford University}'], 2020),
  ];
  assert.deepEqual(labels([cite('nimh'), cite('stanford', true)], references), [
    '(National Institute of Mental Health, 2019; Stanford University, 2020)',
    '',
  ]);
});

test('works that shorten to the same "et al." form write out enough names', () => {
  const references = [
    ref('k1', ['A Kapoor', 'B Bloom', 'C Montez', 'D Warfield', 'E Wu'], 2017, 'One'),
    ref('k2', ['A Kapoor', 'B Bloom', 'F Zucker', 'D Warfield', 'E Wu'], 2017, 'Two'),
  ];
  assert.deepEqual(labels([cite('k1')], references), ['(Kapoor, Bloom, Montez, et al., 2017)']);
  assert.deepEqual(labels([{ ...cite('k2'), narrative: true }], references), [
    'Kapoor, Bloom, Zucker, et al. (2017)',
  ]);
});

test('"et al." never stands for one name: when only the last differs, all are written', () => {
  const references = [
    ref('h1', ['A Hasan', 'B Liang', 'C Kahn', 'D Jones-Miller'], 2015, 'One'),
    ref('h2', ['A Hasan', 'B Liang', 'C Kahn', 'E Weintraub'], 2015, 'Two'),
  ];
  assert.deepEqual(labels([{ ...cite('h1'), narrative: true }], references), [
    'Hasan, Liang, Kahn, and Jones-Miller (2015)',
  ]);
  assert.deepEqual(labels([cite('h2')], references), ['(Hasan, Liang, Kahn, & Weintraub, 2015)']);
});

test('the same "et al." form in different years needs no extra names', () => {
  const references = [
    ref('k1', ['A Kapoor', 'B Bloom', 'C Montez'], 2017),
    ref('k2', ['A Kapoor', 'B Bloom', 'F Zucker'], 2019),
  ];
  assert.deepEqual(labels([cite('k1')], references), ['(Kapoor et al., 2017)']);
});

test('first authors who share a surname but not initials are cited with initials', () => {
  const references = [
    ref('jt', ['John M. Taylor', 'Helen Neville'], 2020),
    ref('at', ['Amy Taylor'], 2018),
    ref('other', ['Ruth Neville'], 2021),
  ];
  assert.deepEqual(labels([cite('jt'), cite('at', true)], references), [
    '(A. Taylor, 2018; J. M. Taylor & Neville, 2020)',
    '',
  ]);
  // Sharing a surname within one reference needs nothing extra: (Chen & Chen, 2019).
  assert.deepEqual(labels([cite('cc')], [ref('cc', ['Li Chen', 'Wei Chen'], 2019)]), [
    '(Chen & Chen, 2019)',
  ]);
});

test('a single citation, with and without a page number', () => {
  const references = [ref('smith', ['Jane Smith'], 2020)];
  assert.deepEqual(labels([cite('smith')], references), ['(Smith, 2020)']);
  assert.deepEqual(labels([cite('smith', false, 'p. 4')], references), ['(Smith, 2020, p. 4)']);
});

test('adjacent citations share one parenthetical, alphabetised, separated by semicolons', () => {
  const references = [ref('smith', ['Jane Smith'], 2020), ref('jones', ['Tom Jones'], 2019)];
  const result = labelAuthorDateCitations([cite('smith'), cite('jones', true)], references);
  assert.equal(result.labels[0].text, '(Jones, 2019; Smith, 2020)');
  assert.equal(result.labels[1].hidden, true);
});

test('a page number stays with its own source inside a shared parenthetical', () => {
  const references = [ref('smith', ['Jane Smith'], 2020), ref('jones', ['Tom Jones'], 2019)];
  assert.deepEqual(labels([cite('smith', false, 'p. 4'), cite('jones', true)], references), [
    '(Jones, 2019; Smith, 2020, p. 4)',
    '',
  ]);
});

test('works by the same author are listed under one name, oldest first', () => {
  const references = [ref('s20', ['Jane Smith'], 2020), ref('s19', ['Jane Smith'], 2019)];
  assert.deepEqual(labels([cite('s20'), cite('s19', true)], references), [
    '(Smith, 2019, 2020)',
    '',
  ]);
});

test('same authors and year are told apart by a letter that follows title order', () => {
  const references = [
    ref('late', ['Jane Smith'], 2020, 'Zebras'),
    ref('early', ['Jane Smith'], 2020, 'Apples'),
    ref('other', ['Tom Jones'], 2020, 'Apples'),
  ];
  const suffixes = yearSuffixes(references);
  assert.equal(suffixes.get('early'), 'a');
  assert.equal(suffixes.get('late'), 'b');
  assert.equal(suffixes.has('other'), false);
  assert.deepEqual(labels([cite('late')], references), ['(Smith, 2020b)']);
});

test('citations separated by text are separate parentheticals', () => {
  const references = [ref('smith', ['Jane Smith'], 2020), ref('jones', ['Tom Jones'], 2019)];
  assert.deepEqual(labels([cite('smith'), cite('jones', false)], references), [
    '(Smith, 2020)',
    '(Jones, 2019)',
  ]);
});

test('a citation of a source not in the list is shown and flagged', () => {
  const result = labelAuthorDateCitations([cite('ghost')], []);
  assert.equal(result.labels[0].text, '(?)');
  assert.equal(result.labels[0].unresolved, true);
  assert.deepEqual(result.order, []);
});

test('reference list: nothing precedes something, then by year, undated first', () => {
  const sorted = sortAuthorDate([
    ref('browning', ['Ann Browning'], 2001),
    ref('brown-two', ['Jane Brown', 'Tom Jones'], 1999),
    ref('brown-2010', ['Jane Brown'], 2010),
    ref('brown-nd', ['Jane Brown'], undefined),
    ref('brown-2005', ['Jane Brown'], 2005),
  ]).map((reference) => reference.citationKey);
  assert.deepEqual(sorted, ['brown-nd', 'brown-2005', 'brown-2010', 'brown-two', 'browning']);
});

test('reference list: an authorless work files under its title, ignoring "The"', () => {
  const sorted = sortAuthorDate([
    ref('smith', ['Jane Smith'], 2020),
    ref('handbook', [], 2020, 'The Handbook of Engines'),
  ]).map((reference) => reference.citationKey);
  assert.deepEqual(sorted, ['handbook', 'smith']);
});

test('APA orders the list alphabetically and flags what the text never cites', () => {
  const references = [ref('smith', ['Jane Smith'], 2020), ref('adams', ['Amy Adams'], 2018)];
  const ordered = orderBibliography(references, ['smith'], 'apa');
  assert.deepEqual(
    ordered.map(({ reference, number, cited }) => [reference.citationKey, number, cited]),
    [
      ['adams', undefined, false],
      ['smith', undefined, true],
    ]
  );
});

test('numbered styles keep first-citation order', () => {
  const references = [ref('smith', ['Jane Smith'], 2020), ref('adams', ['Amy Adams'], 2018)];
  const ordered = orderBibliography(references, ['smith'], 'ieee');
  assert.deepEqual(
    ordered.map(({ reference, number, cited }) => [reference.citationKey, number, cited]),
    [
      ['smith', 1, true],
      ['adams', undefined, false],
    ]
  );
});

test('a narrative citation names the author in the sentence, with "and"', () => {
  const references = [ref('sj', ['Jane Smith', 'Tom Jones'], 2020)];
  assert.deepEqual(labels([{ ...cite('sj'), narrative: true }], references), [
    'Smith and Jones (2020)',
  ]);
  assert.deepEqual(labels([{ ...cite('sj', false, 'p. 4'), narrative: true }], references), [
    'Smith and Jones (2020, p. 4)',
  ]);
});

test('a narrative citation never merges with its neighbours', () => {
  const references = [ref('smith', ['Jane Smith'], 2020), ref('jones', ['Tom Jones'], 2019)];
  assert.deepEqual(
    labels([{ ...cite('smith'), narrative: true }, cite('jones', true)], references),
    ['Smith (2020)', '(Jones, 2019)']
  );
});

test('a group author abbreviation is defined at the first citation, then used alone', () => {
  const nimh = {
    ...ref('nimh', ['{National Institute of Mental Health}'], 2020),
    authorAbbreviation: 'NIMH',
  };
  const references = [nimh];
  assert.deepEqual(
    labels([cite('nimh'), cite('nimh', false), { ...cite('nimh'), narrative: true }], references),
    ['(National Institute of Mental Health [NIMH], 2020)', '(NIMH, 2020)', 'NIMH (2020)']
  );
  // Defined in a narrative citation instead.
  assert.deepEqual(
    labels([{ ...cite('nimh'), narrative: true }, cite('nimh', false)], references),
    ['National Institute of Mental Health (NIMH, 2020)', '(NIMH, 2020)']
  );
});

test('two works by an abbreviated group author share one definition', () => {
  const references = [
    { ...ref('n19', ['{National Institute of Mental Health}'], 2019), authorAbbreviation: 'NIMH' },
    { ...ref('n20', ['{National Institute of Mental Health}'], 2020), authorAbbreviation: 'NIMH' },
  ];
  assert.deepEqual(labels([cite('n20'), cite('n19', true), cite('n20', false)], references), [
    '(National Institute of Mental Health [NIMH], 2019, 2020)',
    '',
    '(NIMH, 2020)',
  ]);
});

test('an authorless work that stands alone is cited by its italic title', () => {
  const references = [
    ref('design', [], 2016, 'Design for eternity: Architectural models', 'misc'),
    ref('smith', ['Jane Smith'], 2020),
  ];
  const result = labelAuthorDateCitations([cite('design'), cite('smith', true)], references);
  assert.equal(
    result.labels[0].text,
    '(Design for Eternity: Architectural Models, 2016; Smith, 2020)'
  );
  assert.deepEqual(result.labels[0].segments, [
    { text: '(' },
    { text: 'Design for Eternity: Architectural Models', italic: true },
    { text: ', 2016; Smith, 2020)' },
  ]);
  assert.deepEqual(
    labelAuthorDateCitations([{ ...cite('design'), narrative: true }], references).labels[0]
      .segments,
    [{ text: 'Design for Eternity: Architectural Models', italic: true }, { text: ' (2016)' }]
  );
  // A label with nothing italic carries no segments.
  assert.equal(labelAuthorDateCitations([cite('smith')], references).labels[0].segments, undefined);
});

test('a name suffix such as "Jr." is left out of the citation', () => {
  const references = [
    ref('evans', ['Alexander C. Evans Jr.', 'James Garbarino', 'Ellen Bocanegra'], 2019),
  ];
  assert.deepEqual(labels([cite('evans')], references), ['(Evans et al., 2019)']);
  assert.equal(inTextName(ref('e', ['Evans, Alexander C., Jr.'], 2019)), 'Evans');
});
