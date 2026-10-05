import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  budgetTone,
  buildOutline,
  countWords,
  mergeSectionTargets,
  normalizeTitle,
  runInSectionTitle,
  sectionAt,
} from './documentOutline.ts';

const h = (level, text, pos) => ({ kind: 'heading', level, text, pos });
const t = (words) => ({ kind: 'text', words });

test('countWords ignores surrounding and repeated whitespace', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords(' one  two\nthree '), 3);
});

test('normalizeTitle strips numbering, case and punctuation', () => {
  assert.equal(normalizeTitle('III. Methodology'), 'methodology');
  assert.equal(normalizeTitle('2.1 Data'), 'data');
  assert.equal(normalizeTitle('A. System Model'), 'system model');
  assert.equal(normalizeTitle('Related Work:'), 'related work');
});

test('a section counts its own words and its subsections', () => {
  const outline = buildOutline([
    h(2, 'Method', 0),
    t(10),
    h(3, 'Data', 20),
    t(5),
    h(2, 'Results', 40),
    t(7),
  ]);
  assert.deepEqual(
    outline.sections.map((s) => [s.title, s.depth, s.words]),
    [
      ['Method', 0, 15],
      ['Data', 1, 5],
      ['Results', 0, 7],
    ]
  );
  assert.equal(outline.totalWords, 22);
});

test('a lone level-1 heading above the sections is the title, not a section', () => {
  const outline = buildOutline([h(1, 'My Paper', 0), t(4), h(2, 'Introduction', 10), t(6)]);
  assert.deepEqual(
    outline.sections.map((s) => s.title),
    ['Introduction']
  );
  assert.equal(outline.sections[0].depth, 0);
  // The title and its byline still count towards the document's total.
  assert.equal(outline.totalWords, 2 + 4 + 6);
});

test('several level-1 headings are sections (APA)', () => {
  const outline = buildOutline([h(1, 'Method', 0), t(3), h(1, 'Results', 10), t(2)]);
  assert.deepEqual(
    outline.sections.map((s) => s.title),
    ['Method', 'Results']
  );
});

test('headings are matched to template sections, allowing numbering and synonyms', () => {
  const sections = [
    { key: 'method', title: 'Method', required: true, targetWords: 100 },
    { key: 'related', title: 'Related Work', required: true, targetWords: 10, maxWords: 12 },
    { key: 'conclusion', title: 'Conclusion', required: true, targetWords: 50 },
  ];
  const outline = buildOutline(
    [h(2, 'II. Related Work', 0), t(20), h(2, 'III. Methodology', 10), t(95)],
    sections
  );
  assert.equal(outline.sections[0].template?.key, 'related');
  assert.equal(outline.sections[0].tone, 'over');
  assert.equal(outline.sections[1].template?.key, 'method');
  assert.equal(outline.sections[1].tone, 'met');
  assert.deepEqual(
    outline.missing.map((s) => s.key),
    ['conclusion']
  );
  assert.equal(outline.totalTarget, 160);
});

test('the title page and introduction are never reported missing', () => {
  const outline = buildOutline(
    [h(1, 'Method', 0)],
    [
      { key: 'title', title: 'Title Page', required: true },
      { key: 'intro', title: 'Introduction', required: true },
    ]
  );
  assert.deepEqual(outline.missing, []);
});

test('a run-in Abstract paragraph becomes a section of its own', () => {
  assert.deepEqual(runInSectionTitle('Abstract—We study things.'), {
    title: 'Abstract',
    rest: 'We study things.',
  });
  assert.equal(runInSectionTitle('An abstract idea'), null);

  const outline = buildOutline([
    h(1, 'Paper', 0),
    { kind: 'runIn', title: 'Abstract', words: 3, pos: 5 },
    h(2, 'Introduction', 10),
    t(4),
  ]);
  assert.deepEqual(
    outline.sections.map((s) => [s.title, s.words]),
    [
      ['Abstract', 3],
      ['Introduction', 4],
    ]
  );
});

test('budgetTone', () => {
  assert.equal(budgetTone(10, undefined), 'none');
  assert.equal(budgetTone(10, { key: 'a', title: 'A', required: false }), 'none');
  const section = { key: 'a', title: 'A', required: false, targetWords: 100 };
  assert.equal(budgetTone(50, section), 'progress');
  assert.equal(budgetTone(95, section), 'met');
  assert.equal(budgetTone(101, section), 'over');
  assert.equal(budgetTone(110, { ...section, maxWords: 120 }), 'met');
});

test('sectionAt finds the section containing a position', () => {
  const sections = [{ pos: 0 }, { pos: 10 }, { pos: 20 }];
  assert.equal(sectionAt(sections, 15), sections[1]);
  assert.equal(sectionAt(sections, 20), sections[2]);
  assert.equal(sectionAt([{ pos: 5 }], 2), null);
});

test('own section targets override the template and add new sections', () => {
  const merged = mergeSectionTargets(
    [
      { key: 'intro', title: 'Introduction', required: true, targetWords: 500, maxWords: 600 },
      { key: 'method', title: 'Methods', required: true, targetWords: 900 },
    ],
    [
      { title: 'introduction', words: 800 },
      { title: 'Discussion', words: 1200 },
    ]
  );
  assert.deepEqual(merged, [
    { key: 'intro', title: 'Introduction', required: true, targetWords: 800, maxWords: undefined },
    { key: 'method', title: 'Methods', required: true, targetWords: 900 },
    { key: 'goal:discussion', title: 'Discussion', required: false, targetWords: 1200 },
  ]);
  assert.deepEqual(mergeSectionTargets(undefined, undefined), []);
});
