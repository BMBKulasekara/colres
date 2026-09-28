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

test('no author: the title, quoted for an article, bare for a book', () => {
  assert.equal(inTextName(ref('a', [], 2020, 'Study finds', 'article')), '"Study finds"');
  assert.equal(inTextName(ref('b', [], 2020, 'Big Book', 'book')), 'Big Book');
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
