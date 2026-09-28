import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReference, formatReferenceText, toSentenceCase } from './citationFormat.ts';

/**
 * The reference entries in these tests are the worked examples from IEEE's own
 * style guidance, reproduced character for character. They are the point of
 * the file: a formatter that is "close enough" to a citation style is a
 * formatter that quietly puts wrong punctuation into every paper written with
 * it, and the only way to know is to compare against a known-correct entry.
 */

const ieee = (reference) => formatReferenceText({ citationKey: 'k', ...reference }, 'ieee');

test('book: imprint reads City, Country: Publisher', () => {
  assert.equal(
    ieee({
      type: 'book',
      authors: ['Jack P. Hailman'],
      title: 'Coding and Redundancy: Man-Made and Animal-Evolved Signals',
      address: 'Cambridge, MA, USA',
      publisher: 'Harvard University Press',
      year: 2008,
    }),
    'J. P. Hailman, Coding and Redundancy: Man-Made and Animal-Evolved Signals. Cambridge, MA, USA: Harvard Univ. Press, 2008.'
  );
});

test('book: the title is the italic element and carries no quotation marks', () => {
  const segments = formatReference(
    {
      citationKey: 'rieder2020',
      type: 'book',
      authors: ['Bernhard Rieder'],
      title: 'Engines of Order: A Mechanology of Algorithmic Techniques',
      address: 'Amsterdam, Netherlands',
      publisher: 'Amsterdam University Press',
      year: 2020,
    },
    'ieee'
  );

  const italics = segments.filter((segment) => segment.italic).map((segment) => segment.text);
  assert.deepEqual(italics, ['Engines of Order: A Mechanology of Algorithmic Techniques']);
});

test('journal article: volume, number, page range, month and DOI', () => {
  assert.equal(
    ieee({
      type: 'article',
      authors: ['Jiahua Kou'],
      title: 'Estimating the number of clusters via the GUD statistic',
      venue: 'J. Comput. Graph. Statist.',
      volume: '23',
      number: '2',
      pages: '403-417',
      month: 6,
      year: 2014,
      doi: '10.1080/10618600.2013.778778',
    }),
    'J. Kou, "Estimating the number of clusters via the GUD statistic," J. Comput. Graph. Statist., vol. 23, no. 2, pp. 403–417, Jun. 2014, doi: 10.1080/10618600.2013.778778.'
  );
});

test('journal article: two authors are joined by "and" with no comma', () => {
  assert.equal(
    ieee({
      type: 'article',
      authors: ['David V. Lindberg', 'Herbert K. H. Lee'],
      title: 'Optimization under constraints by applying an asymmetric entropy measure',
      venue: 'J. Comput. Graph. Statist.',
      volume: '24',
      number: '2',
      pages: '379-393',
      month: 6,
      year: 2015,
      doi: '10.1080/10618600.2014.901225',
    }),
    'D. V. Lindberg and H. K. H. Lee, "Optimization under constraints by applying an asymmetric entropy measure," J. Comput. Graph. Statist., vol. 24, no. 2, pp. 379–393, Jun. 2015, doi: 10.1080/10618600.2014.901225.'
  );
});

test('web page: periods between the parts, and an access date at the end', () => {
  assert.equal(
    ieee({
      type: 'misc',
      authors: ['Brian Fung'],
      title: 'Amazon offers concessions to resolve EU antitrust probes',
      venue: 'CNN.com',
      url: 'https://edition.cnn.com/2022/07/14/tech/amazon-concessions-eu-antitrust/index.html',
      accessed: Date.parse('2022-07-18'),
    }),
    'B. Fung. "Amazon offers concessions to resolve EU antitrust probes." CNN.com. https://edition.cnn.com/2022/07/14/tech/amazon-concessions-eu-antitrust/index.html (accessed Jul. 18, 2022).'
  );
});

test('web page: no access date recorded leaves the parenthetical off', () => {
  assert.equal(
    ieee({
      type: 'misc',
      authors: ['Matt McGrath'],
      title: 'Climate change: Sand battery could solve green energy problem',
      venue: 'BBC News',
      url: 'https://www.bbc.com/news/science-environment-61996520',
    }),
    'M. McGrath. "Climate change: Sand battery could solve green energy problem." BBC News. https://www.bbc.com/news/science-environment-61996520.'
  );
});

test('authors: three to six are separated by commas with a serial comma before "and"', () => {
  assert.match(
    ieee({
      authors: [
        'Andres Bleda',
        'Maria L. Reyna',
        'Jose Gabriel-Rodriguez',
        'Tomas Primula',
        'Yves Vivianus',
      ],
      title: 'A paper',
      year: 2020,
    }),
    /^A\. Bleda, M\. L\. Reyna, J\. Gabriel-Rodriguez, T\. Primula, and Y\. Vivianus, /
  );
});

test('authors: seven or more credit the first author alone, with et al. in italics', () => {
  const authors = ['Andres Bleda', 'B Two', 'C Three', 'D Four', 'E Five', 'F Six', 'G Seven'];

  const segments = formatReference(
    { citationKey: 'k', authors, title: 'A paper', year: 2020 },
    'ieee'
  );

  assert.equal(segments[0]?.text, 'A. Bleda ');
  assert.equal(segments[1]?.text, 'et al.');
  assert.equal(segments[1]?.italic, true);
});

test('container names are abbreviated, and an already-abbreviated one is unchanged', () => {
  const spelledOut = ieee({
    type: 'article',
    authors: ['Ada Lovelace'],
    title: 'A paper',
    venue: 'Journal of Computational Mathematics',
    year: 2020,
  });
  assert.match(spelledOut, /J\. of Comp\. Math\./);

  const alreadyShort = ieee({
    type: 'article',
    authors: ['Ada Lovelace'],
    title: 'A paper',
    venue: 'J. Comput. Math.',
    year: 2020,
  });
  assert.match(alreadyShort, /J\. Comput\. Math\./);
});

test('a title is never abbreviated, only the container it sits in', () => {
  assert.match(
    ieee({
      type: 'article',
      authors: ['Ada Lovelace'],
      title: 'Journal quality and university research',
      venue: 'Science',
      year: 2020,
    }),
    /"Journal quality and university research," Sci\./
  );
});

test('May takes no abbreviating period, unlike every other month', () => {
  assert.match(
    ieee({
      type: 'article',
      authors: ['Ada Lovelace'],
      title: 'A paper',
      venue: 'Science',
      month: 5,
      year: 2016,
    }),
    /, May 2016\.$/
  );
});

/**
 * With nothing between the title and the date there is no list to punctuate,
 * so the date follows the title's own comma directly. Getting this wrong is
 * what produces the doubled `,",` that a formatter built from string
 * concatenation tends to emit.
 */
test('a date with no fields before it follows the title without a second comma', () => {
  assert.equal(
    ieee({ type: 'article', authors: ['Ada Lovelace'], title: 'A paper', month: 5, year: 2016 }),
    'A. Lovelace, "A paper," May 2016.'
  );
});

test('a missing year is "n.d.", whose period is not doubled', () => {
  assert.equal(
    ieee({ authors: ['Ada Lovelace'], title: 'A paper' }),
    'A. Lovelace, "A paper," n.d.'
  );
});

/*
 * APA 7. The expected strings are the worked examples from APA's Student Paper
 * Setup Guide, reproduced character for character (less the edition statement
 * the reference records do not hold).
 */

const apa = (reference, context) =>
  formatReferenceText({ citationKey: 'k', ...reference }, 'apa', context);

test('apa: journal article with issue, page range and DOI', () => {
  assert.equal(
    apa({
      type: 'article',
      authors: ['Drew C. Appleby', 'Karen M. Appleby'],
      title: 'Kisses of death in the graduate school application process',
      venue: 'Teaching of Psychology',
      volume: '33',
      number: '1',
      pages: '19-24',
      year: 2006,
      doi: '10.1207/s15328023top3301_5',
    }),
    'Appleby, D. C., & Appleby, K. M. (2006). Kisses of death in the graduate school application process. Teaching of Psychology, 33(1), 19–24. https://doi.org/10.1207/s15328023top3301_5'
  );
});

test('apa: the journal and volume are italic, the issue and article title are not', () => {
  const segments = formatReference(
    {
      citationKey: 'appleby2006',
      type: 'article',
      authors: ['Drew C. Appleby', 'Karen M. Appleby'],
      title: 'Kisses of death in the graduate school application process',
      venue: 'Teaching of Psychology',
      volume: '33',
      number: '1',
      pages: '19-24',
      year: 2006,
    },
    'apa'
  );
  assert.deepEqual(
    segments.filter((segment) => segment.italic).map((segment) => segment.text),
    ['Teaching of Psychology', '33']
  );
});

test('apa: four authors, a question in the title, no issue number', () => {
  assert.equal(
    apa({
      type: 'article',
      authors: ['Maria Becerra', 'Eva Wong', 'Brian N. Jenkins', 'Sarah D. Pressman'],
      title:
        'Does a good advisor a day keep the doctor away? How advisor-advisee relationships are associated with psychological and physical well-being among graduate students',
      venue: 'International Journal of Community Well-Being',
      volume: '4',
      pages: '505–524',
      year: 2021,
      doi: 'https://doi.org/10.1007/s42413-020-00087-2',
    }),
    'Becerra, M., Wong, E., Jenkins, B. N., & Pressman, S. D. (2021). Does a good advisor a day keep the doctor away? How advisor-advisee relationships are associated with psychological and physical well-being among graduate students. International Journal of Community Well-Being, 4, 505–524. https://doi.org/10.1007/s42413-020-00087-2'
  );
});

test('apa: a book title is the italic element, followed by the publisher', () => {
  const reference = {
    type: 'book',
    authors: ['John W. Creswell', 'Cheryl N. Poth'],
    title: 'Qualitative inquiry and research design: Choosing among five approaches',
    publisher: 'Sage',
    year: 2024,
  };
  assert.equal(
    apa(reference),
    'Creswell, J. W., & Poth, C. N. (2024). Qualitative inquiry and research design: Choosing among five approaches. Sage.'
  );
  const italics = formatReference({ citationKey: 'k', ...reference }, 'apa').filter(
    (s) => s.italic
  );
  assert.deepEqual(
    italics.map((s) => s.text),
    ['Qualitative inquiry and research design: Choosing among five approaches']
  );
});

test('apa: a title ending in a question mark takes no extra period', () => {
  assert.equal(
    apa({ type: 'book', authors: ['Ada Lovelace'], title: 'Can machines think?', year: 1843 }),
    'Lovelace, A. (1843). Can machines think?'
  );
});

test('apa: with no author, the title moves ahead of the date', () => {
  assert.equal(
    apa({
      type: 'book',
      authors: [],
      title: 'Merriam-Webster’s dictionary',
      publisher: 'Merriam-Webster',
      year: 2020,
    }),
    'Merriam-Webster’s dictionary. (2020). Merriam-Webster.'
  );
});

test('apa: an undated source is n.d., and a year suffix is kept', () => {
  assert.equal(
    apa(
      { type: 'book', authors: ['Ada Lovelace'], title: 'Notes', year: 2020 },
      { yearSuffix: 'b' }
    ),
    'Lovelace, A. (2020b). Notes.'
  );
  assert.equal(
    apa({ type: 'book', authors: ['Ada Lovelace'], title: 'Notes' }),
    'Lovelace, A. (n.d.). Notes.'
  );
});

test('apa: more than 20 authors gives the first 19, an ellipsis, and the last', () => {
  const authors = Array.from({ length: 22 }, (_, i) => `Given ${String.fromCharCode(65 + i)}name`);
  const text = apa({ type: 'book', authors, title: 'Big science', year: 2020 });
  assert.match(text, /^Aname, G\., Bname, G\., /);
  assert.match(text, /Sname, G\., \. \. \. Vname, G\. \(2020\)/);
  assert.doesNotMatch(text, /&/);
});

test('apa: conference paper and book chapter sit "In" the italic container', () => {
  assert.equal(
    apa({
      type: 'inproceedings',
      authors: ['Ada Lovelace'],
      title: 'On engines',
      venue: 'Proceedings of the Analytical Society',
      pages: '10-20',
      publisher: 'Royal Society',
      year: 1843,
    }),
    'Lovelace, A. (1843). On engines. In Proceedings of the Analytical Society (pp. 10–20). Royal Society.'
  );
});

test('apa: a dissertation names its institution in brackets', () => {
  assert.equal(
    apa({
      type: 'phdthesis',
      authors: ['Ada Lovelace'],
      title: 'Engines of thought',
      venue: 'University of London',
      year: 1843,
    }),
    'Lovelace, A. (1843). Engines of thought [Doctoral dissertation, University of London].'
  );
});

test('apa: a web page carries its month and ends with the URL, no period', () => {
  assert.equal(
    apa({
      type: 'misc',
      authors: ['Ada Lovelace'],
      title: 'Why engines matter',
      venue: 'Engine Weekly',
      url: 'https://example.com/engines',
      year: 2019,
      month: 6,
    }),
    'Lovelace, A. (2019, June). Why engines matter. Engine Weekly. https://example.com/engines'
  );
});

test('apa: a Title Cased title is printed in sentence case', () => {
  assert.equal(
    apa({
      type: 'article',
      authors: ['Drew C. Appleby'],
      title: 'Kisses of Death in the Graduate School Application Process',
      year: 2006,
    }),
    'Appleby, D. C. (2006). Kisses of death in the graduate school application process.'
  );
});

test('apa: sentence case keeps acronyms, braced names, and the word after a colon', () => {
  assert.equal(
    toSentenceCase(
      'Training {BERT} on GPUs in {Denver}: A Practical Guide for Self-Report Studies'
    ),
    'Training BERT on GPUs in Denver: A practical guide for self-report studies'
  );
});

test('apa: a title already in sentence case keeps its proper nouns', () => {
  assert.equal(
    toSentenceCase('Kisses of death in the graduate schools of Denver'),
    'Kisses of death in the graduate schools of Denver'
  );
});

test('braces are never shown, in any style', () => {
  assert.equal(
    formatReferenceText(
      { citationKey: 'k', type: 'book', authors: ['Ann Lee'], title: 'On {Freud}', year: 2001 },
      'ieee'
    ),
    'A. Lee, On Freud, 2001.'
  );
});

test('apa: a book edition follows the title in parentheses', () => {
  assert.equal(
    apa({
      type: 'book',
      authors: ['John W. Creswell', 'Cheryl N. Poth'],
      title: 'Qualitative inquiry and research design: Choosing among five approaches',
      edition: '5',
      publisher: 'Sage',
      year: 2024,
    }),
    'Creswell, J. W., & Poth, C. N. (2024). Qualitative inquiry and research design: Choosing among five approaches (5th ed.). Sage.'
  );
});

test('apa: a chapter names its editors and puts edition and pages together', () => {
  assert.equal(
    apa({
      type: 'incollection',
      authors: ['Ada Lovelace'],
      title: 'On engines',
      venue: 'The Handbook of Engines',
      editors: ['Charles Babbage', 'Mary Somerville'],
      edition: '2',
      pages: '10-20',
      publisher: 'Royal Society',
      year: 1843,
    }),
    'Lovelace, A. (1843). On engines. In C. Babbage & M. Somerville (Eds.), The handbook of engines (2nd ed., pp. 10–20). Royal Society.'
  );
});

test('ieee: a book edition follows the title', () => {
  assert.equal(
    ieee({
      type: 'book',
      authors: ['Jack P. Hailman'],
      title: 'Coding and Redundancy',
      edition: '3',
      address: 'Cambridge, MA, USA',
      publisher: 'Harvard University Press',
      year: 2008,
    }),
    'J. P. Hailman, Coding and Redundancy, 3rd ed. Cambridge, MA, USA: Harvard Univ. Press, 2008.'
  );
});
