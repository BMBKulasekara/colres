import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  captionLabel,
  EM_SPACE,
  numberFloats,
  referenceLabel,
  toRoman,
  toTitleCase,
  uncitedFloats,
} from './floatNumbering.ts';

const fig = (id) => ({ id, kind: 'figure' });
const tab = (id) => ({ id, kind: 'table' });

test('roman numerals cover the range a paper could reach', () => {
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(14), 'XIV');
  assert.equal(toRoman(40), 'XL');
  assert.equal(toRoman(99), 'XCIX');
});

test('a number below one has no numeral', () => {
  assert.equal(toRoman(0), '');
});

/**
 * The heart of the IEEE rule: the two sequences are independent, so
 * interleaving floats must not make either of them skip.
 */
test('figures and tables number independently and continuously', () => {
  const { captionLabels } = numberFloats([fig('f1'), tab('t1'), fig('f2'), tab('t2'), fig('f3')]);

  assert.equal(captionLabels.get('f1'), 'Fig. 1.');
  assert.equal(captionLabels.get('t1'), 'TABLE I');
  assert.equal(captionLabels.get('f2'), 'Fig. 2.');
  assert.equal(captionLabels.get('t2'), 'TABLE II');
  assert.equal(captionLabels.get('f3'), 'Fig. 3.');
});

test('numbering follows document order, so inserting renumbers what follows', () => {
  const before = numberFloats([fig('a'), fig('b')]);
  assert.equal(before.numbers.get('b'), 2);

  const after = numberFloats([fig('new'), fig('a'), fig('b')]);
  assert.equal(after.numbers.get('new'), 1);
  assert.equal(after.numbers.get('a'), 2);
  assert.equal(after.numbers.get('b'), 3);
});

/** Copying a figure copies its id, and two floats cannot share a number. */
test('a duplicated id does not consume a second number', () => {
  const { numbers, order } = numberFloats([fig('a'), fig('a'), fig('b')]);
  assert.equal(numbers.get('a'), 1);
  assert.equal(numbers.get('b'), 2);
  assert.deepEqual(order, ['a', 'b']);
});

test('a float with no id is skipped rather than numbered', () => {
  const { numbers } = numberFloats([fig(''), fig('b')]);
  assert.equal(numbers.get('b'), 1);
});

test('a figure caption abbreviates and takes a period; a table caption does not', () => {
  assert.equal(captionLabel('figure', 1), 'Fig. 1.');
  assert.equal(captionLabel('table', 2), 'TABLE II');
});

/**
 * The caption is all-caps but the prose is not: "as shown in TABLE I" is
 * shouting, and IEEE does not do it.
 */
test('the prose form of a table reference is title case, not all caps', () => {
  assert.equal(referenceLabel('table', 1), 'Table I');
  assert.equal(referenceLabel('figure', 1), 'Fig. 1');
});

test('the caption label is separated from its text by a real em space', () => {
  assert.equal(EM_SPACE, ' ');
  assert.equal(EM_SPACE.length, 1);
});

test('significant words are capitalised and short joining words are not', () => {
  assert.equal(
    toTitleCase('performance metrics across different datasets'),
    'Performance Metrics Across Different Datasets'
  );
  assert.equal(toTitleCase('a comparison of the results'), 'A Comparison of the Results');
});

test('a minor word that opens the title is still capitalised', () => {
  assert.equal(toTitleCase('the proposed method'), 'The Proposed Method');
});

/**
 * Lowercasing an acronym to re-capitalise its first letter destroys what the
 * author wrote, and nothing downstream can recover it.
 */
test('acronyms and camel-cased names survive title casing unchanged', () => {
  assert.equal(toTitleCase('mAP scores for ResNet and GPUs'), 'mAP Scores for ResNet and GPUs');
  assert.equal(toTitleCase('results on CIFAR-10'), 'Results on CIFAR-10');
});

test('spacing inside a title is preserved exactly', () => {
  assert.equal(toTitleCase('one  two'), 'One  Two');
});

test('floats the prose never mentions are reported', () => {
  const floats = [fig('f1'), tab('t1'), fig('f2')];
  const uncited = uncitedFloats(floats, new Set(['f1']));

  assert.deepEqual(
    uncited.map((float) => float.id),
    ['t1', 'f2']
  );
});

test('a paper that cites everything reports nothing', () => {
  const floats = [fig('f1'), tab('t1')];
  assert.deepEqual(uncitedFloats(floats, new Set(['f1', 't1'])), []);
});

test('apa: figures and tables are spelled out and numbered in Arabic', () => {
  const labels = numberFloats([fig('f1'), tab('t1'), tab('t2'), fig('f2')], 'apa');
  assert.equal(labels.captionLabels.get('t2'), 'Table 2');
  assert.equal(labels.captionLabels.get('f2'), 'Figure 2');
  assert.equal(labels.referenceLabels.get('t1'), 'Table 1');
  assert.equal(captionLabel('figure', 3, 'apa'), 'Figure 3');
  assert.equal(referenceLabel('table', 4, 'apa'), 'Table 4');
});
