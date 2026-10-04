import assert from 'node:assert/strict';
import { test } from 'vitest';
import { MAX_PDF_BYTES, validatePdfFile } from './pdfExtract.ts';
import {
  analyzePdf,
  findArxivId,
  findDoi,
  mergeRecord,
  pickMatchingRecord,
  plausibleMetadataTitle,
  reviewFields,
  sourceFromLine,
  splitAuthorField,
  titleSimilarity,
} from './pdfReference.ts';

/**
 * Reading a reference out of a PDF. The snapshots here stand in for what the
 * browser loader produces from a real file: lines of text with their font
 * size and position, plus the metadata dictionaries.
 */

const line = (text, fontSize, top, page = 1) => ({ text, fontSize, top, page });

/** The first page of a typical journal article. */
const articleSnapshot = (overrides = {}) => ({
  fileName: 'grady2019.pdf',
  pageCount: 11,
  info: { title: 'Microsoft Word - storybooks_final.docx', creationDate: 'D:20180301120000' },
  xmp: {},
  lines: [
    line('Psychology of Popular Media Culture, Vol. 8, No. 3, 207–217', 8, 0.04),
    line('© 2019 American Psychological Association', 8, 0.06),
    line('http://dx.doi.org/10.1037/ppm0000185.', 8, 0.08),
    line('Emotions in Storybooks: A Comparison of Storybooks That', 16, 0.15),
    line('Represent Ethnic and Racial Groups in the United States', 16, 0.18),
    line(
      'Jessica S. Grady1, Malena Her2, Geena Moreno*, Catherine Perez, and Jelinne Yelinek',
      11,
      0.23
    ),
    line('1 Department of Psychology, University of California', 9, 0.26),
    line('Published online: 12 March 2019', 9, 0.28),
    line('Emotions shape how children learn about the social world and this study', 10, 0.4),
    line('examines storybooks read to children across many different settings.', 10, 0.42),
    line('Children spend a great deal of time with picture books in the early years.', 10, 0.44),
  ],
  ...overrides,
});

test('findDoi: strips trailing punctuation and unbalanced parentheses', () => {
  assert.equal(findDoi('see https://doi.org/10.1037/ppm0000185.'), '10.1037/ppm0000185');
  assert.equal(findDoi('(doi: 10.1016/S0140-6736(10)60175-4)'), '10.1016/S0140-6736(10)60175-4');
  assert.equal(findDoi('no identifier here'), undefined);
});

test('findArxivId: new-style identifiers without the version', () => {
  assert.equal(findArxivId('arXiv:2101.00001v3 [cs.CL] 4 Jan 2021'), '2101.00001');
});

test('metadata titles written by a program are ignored', () => {
  assert.equal(plausibleMetadataTitle('Microsoft Word - draft3.docx'), undefined);
  assert.equal(plausibleMetadataTitle('untitled'), undefined);
  assert.equal(plausibleMetadataTitle('paper.pdf'), undefined);
  assert.equal(
    plausibleMetadataTitle('Ageing consumers and e-commerce activities'),
    'Ageing consumers and e-commerce activities'
  );
});

test('author fields split on semicolons, "and", and surname–initials pairs', () => {
  assert.deepEqual(splitAuthorField('Jane Smith; Tom Jones'), ['Jane Smith', 'Tom Jones']);
  assert.deepEqual(splitAuthorField('Jane Smith and Tom Jones'), ['Jane Smith', 'Tom Jones']);
  assert.deepEqual(splitAuthorField('Smith, J. K., Jones, T.'), ['Smith, J. K.', 'Jones, T.']);
  assert.deepEqual(splitAuthorField('Owner'), []);
});

test('the issue line is read in its common shapes', () => {
  assert.deepEqual(sourceFromLine('Psychology of Popular Media Culture, Vol. 8, No. 3, 207–217'), {
    venue: 'Psychology of Popular Media Culture',
    volume: '8',
    number: '3',
    year: undefined,
    pages: '207–217',
  });
  assert.deepEqual(sourceFromLine('Ageing & Society 42(8), 1879–1898'), {
    venue: 'Ageing & Society',
    volume: '42',
    number: '8',
    pages: '1879–1898',
  });
  assert.deepEqual(sourceFromLine('Psychol Pop Media Cult. 2019;8(3):207-17'), {
    venue: 'Psychol Pop Media Cult',
    year: 2019,
    volume: '8',
    number: '3',
    pages: '207–17',
  });
});

test('a journal article: every field read from the first page', () => {
  const { fields, doi, warnings } = analyzePdf(articleSnapshot());
  assert.equal(doi, '10.1037/ppm0000185');
  assert.equal(
    fields.title.value,
    'Emotions in Storybooks: A Comparison of Storybooks That Represent Ethnic and Racial Groups in the United States'
  );
  assert.equal(fields.title.confidence, 'uncertain');
  assert.deepEqual(fields.authors.value, [
    'Jessica S. Grady',
    'Malena Her',
    'Geena Moreno',
    'Catherine Perez',
    'Jelinne Yelinek',
  ]);
  assert.equal(fields.year.value, 2019);
  assert.equal(fields.month.value, 3);
  assert.equal(fields.venue.value, 'Psychology of Popular Media Culture');
  assert.equal(fields.volume.value, '8');
  assert.equal(fields.number.value, '3');
  assert.equal(fields.pages.value, '207–217');
  assert.equal(fields.publisher.value, 'American Psychological Association');
  assert.equal(fields.type.value, 'article');
  assert.deepEqual(warnings, []);
});

test('metadata that agrees with the page makes the title likely', () => {
  const { fields } = analyzePdf(
    articleSnapshot({
      info: {
        title:
          'Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the United States',
      },
    })
  );
  assert.equal(fields.title.confidence, 'likely');
  assert.equal(fields.title.source, 'pdf-metadata');
});

test('with nothing better, the year is the creation date, and the author is warned', () => {
  const { fields, warnings } = analyzePdf({
    fileName: 'notes.pdf',
    pageCount: 1,
    info: { creationDate: 'D:20210405' },
    xmp: {},
    lines: [line('Some plain notes without a clear heading', 10, 0.1)],
  });
  assert.equal(fields.year.value, 2021);
  assert.equal(fields.year.confidence, 'uncertain');
  assert.equal(warnings.length, 1);
  assert.equal(fields.title.source, 'file-name');
});

test('XMP fields are read whatever their case', () => {
  const { fields, doi } = analyzePdf({
    fileName: 'x.pdf',
    pageCount: 1,
    info: {},
    xmp: {
      'prism:doi': '10.1000/xyz123',
      'prism:publicationname': 'Journal of Tests',
      'dc:creator': ['Ada Lovelace'],
    },
    lines: [],
  });
  assert.equal(doi, '10.1000/xyz123');
  assert.equal(fields.venue.value, 'Journal of Tests');
  assert.deepEqual(fields.authors.value, ['Ada Lovelace']);
});

test('the published record wins and is verified; unsupplied fields keep the PDF value', () => {
  const analysis = analyzePdf(articleSnapshot());
  const merged = mergeRecord(analysis, {
    type: 'article',
    title:
      'Emotions in storybooks: A comparison of storybooks that represent ethnic and racial groups in the United States',
    authors: [
      'Jessica S. Grady',
      'Malena Her',
      'Geena Moreno',
      'Catherine Perez',
      'Jelinne Yelinek',
    ],
    year: 2019,
    venue: 'Psychology of Popular Media Culture',
    volume: '8',
    number: '3',
    pages: '207-217',
    doi: '10.1037/ppm0000185',
  });
  assert.equal(merged.fields.title.confidence, 'verified');
  assert.equal(merged.fields.pages.value, '207-217');
  assert.equal(merged.fields.month.source, 'pdf-text');
  assert.deepEqual(merged.warnings, []);
  assert.deepEqual(reviewFields(merged.fields), { missing: [], uncertain: ['month', 'publisher'] });
});

test('a DOI that resolves to a different paper is flagged', () => {
  const merged = mergeRecord(analyzePdf(articleSnapshot()), {
    type: 'article',
    title: 'A completely unrelated study of soil bacteria',
    authors: ['Someone Else'],
  });
  assert.equal(merged.warnings.length, 1);
  assert.match(merged.warnings[0], /does not match the title/);
});

test('a title search result is only taken when it is plainly the same work', () => {
  const candidates = [
    { type: 'article', title: 'Emotions in children', authors: [], year: 2019 },
    {
      type: 'article',
      title: 'Ageing consumers and e-commerce activities',
      authors: [],
      year: 2022,
    },
  ];
  assert.equal(
    pickMatchingRecord(candidates, 'Ageing Consumers and E-Commerce Activities', 2021)?.year,
    2022
  );
  assert.equal(
    pickMatchingRecord(candidates, 'Ageing Consumers and E-Commerce Activities', 2015),
    undefined
  );
  assert.equal(pickMatchingRecord(candidates, 'Something else entirely'), undefined);
  assert.ok(titleSimilarity('A study: with subtitle here now', 'A study') < 0.85);
});

test('missing fields are reported for the type of work', () => {
  const { missing } = reviewFields({
    type: { value: 'book', source: 'pdf-text', confidence: 'uncertain' },
    title: { value: 'Behave', source: 'pdf-text', confidence: 'uncertain' },
  });
  assert.deepEqual(missing, ['authors', 'year', 'publisher']);
});

test('uploads are checked for type and size before they are read', () => {
  assert.equal(validatePdfFile({ name: 'a.pdf', type: 'application/pdf', size: 1000 }), null);
  assert.match(
    validatePdfFile({ name: 'a.docx', type: 'application/msword', size: 1000 }),
    /not a PDF/
  );
  assert.match(validatePdfFile({ name: 'a.pdf', type: '', size: 0 }), /empty/);
  assert.match(
    validatePdfFile({ name: 'a.pdf', type: 'application/pdf', size: MAX_PDF_BYTES + 1 }),
    /limit/
  );
});
