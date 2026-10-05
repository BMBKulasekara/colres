import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { test } from 'vitest';
import { importDocx, tidyImportedHtml, titleFromFileName } from './docxImport.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const para = (text, style) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

/** The smallest valid .docx: content types, the package relationship, and a body. */
function docx(body) {
  const zip = zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    ),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`
    ),
  });
  return {
    name: 'My_Thesis draft.docx',
    arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
  };
}

test('headings, paragraphs and bold text come across as editor HTML', async () => {
  const bold =
    '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Key</w:t></w:r><w:r><w:t xml:space="preserve"> finding.</w:t></w:r></w:p>';
  const result = await importDocx(
    docx(`${para('Introduction', 'Heading1')}${para('')}${para('We study 5% & more.')}${bold}`)
  );

  assert.equal(result.title, 'My Thesis draft');
  assert.equal(
    result.html,
    '<h1>Introduction</h1><p>We study 5% &amp; more.</p><p><strong>Key</strong> finding.</p>'
  );
});

test('Word title style becomes a heading', async () => {
  const result = await importDocx(docx(para('A Study of Things', 'Title')));
  assert.equal(result.html, '<h1>A Study of Things</h1>');
});

test('a file that is not a Word document is rejected', async () => {
  await assert.rejects(
    importDocx({
      name: 'notes.docx',
      arrayBuffer: async () => new TextEncoder().encode('hello').buffer,
    })
  );
});

test('title from file name and HTML tidying', () => {
  assert.equal(titleFromFileName('Final_Report.DOCX'), 'Final Report');
  assert.equal(titleFromFileName('.docx'), 'Untitled Document');
  assert.equal(
    tidyImportedHtml('<p>a</p><p> </p><p><br /></p><a id="_Toc1"></a><p>b</p>'),
    '<p>a</p><p>b</p>'
  );
});
