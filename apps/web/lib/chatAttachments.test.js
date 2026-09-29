import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  checkAttachment,
  formatBytes,
  formatDuration,
  isVoiceMimeType,
  MAX_ATTACHMENT_BYTES,
} from '../../../packages/convex/convex/lib/chatAttachments.ts';

const KB = 1024;

test('every type the team was promised is accepted', () => {
  const cases = [
    ['draft.pdf', 'application/pdf'],
    ['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['readme.txt', 'text/plain'],
    ['paper.tex', 'text/x-tex'],
    ['data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['figure.jpg', 'image/jpeg'],
    ['figure.jpeg', 'image/jpeg'],
    ['photo.heic', 'image/heic'],
  ];

  for (const [name, mimeType] of cases) {
    const verdict = checkAttachment(name, mimeType, KB);
    assert.equal(verdict.ok, true, `${name} should be accepted`);
  }
});

/**
 * The two formats this team actually exchanges that browsers refuse to type.
 * A MIME-first allowlist would reject a LaTeX source and an iPhone photo,
 * which are the least surprising things a research team could send.
 */
test('an empty MIME type is judged on the extension alone', () => {
  assert.equal(checkAttachment('paper.tex', '', KB).ok, true);
  assert.equal(checkAttachment('photo.heic', '', KB).ok, true);
});

test('a .tex file that arrives as text/plain is still a .tex file', () => {
  assert.equal(checkAttachment('paper.tex', 'text/plain', KB).ok, true);
});

test('images are classed for inline display and documents for download', () => {
  assert.equal(checkAttachment('figure.jpg', 'image/jpeg', KB).type.kind, 'image');
  assert.equal(checkAttachment('photo.heic', '', KB).type.kind, 'image');
  assert.equal(checkAttachment('draft.pdf', 'application/pdf', KB).type.kind, 'file');
});

test('an extension that is not on the list is refused by name', () => {
  const verdict = checkAttachment('archive.zip', 'application/zip', KB);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /\.zip/);
});

test('a file with no extension is refused', () => {
  assert.equal(checkAttachment('Makefile', '', KB).ok, false);
});

/** A .pdf that reports itself as a script is not a .pdf. */
test('a MIME type that contradicts the extension is refused', () => {
  const verdict = checkAttachment('draft.pdf', 'application/javascript', KB);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /application\/javascript/);
});

test('an oversized file is refused, and one at the limit is not', () => {
  assert.equal(checkAttachment('draft.pdf', 'application/pdf', MAX_ATTACHMENT_BYTES + 1).ok, false);
  assert.equal(checkAttachment('draft.pdf', 'application/pdf', MAX_ATTACHMENT_BYTES).ok, true);
});

test('an empty file is refused', () => {
  assert.equal(checkAttachment('draft.pdf', 'application/pdf', 0).ok, false);
});

test('a size that was not supplied is simply not checked', () => {
  assert.equal(checkAttachment('draft.pdf', 'application/pdf').ok, true);
});

/** MediaRecorder appends codec parameters to the type it reports. */
test('a recording type is recognised with its codec parameters attached', () => {
  assert.equal(isVoiceMimeType('audio/webm;codecs=opus'), true);
  assert.equal(isVoiceMimeType('audio/mp4'), true);
  assert.equal(isVoiceMimeType('video/webm'), false);
  assert.equal(isVoiceMimeType(''), false);
});

test('sizes read the way a file card needs them', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(25 * 1024 * 1024), '25 MB');
});

test('clip lengths are padded to a clock reading', () => {
  assert.equal(formatDuration(7), '0:07');
  assert.equal(formatDuration(67), '1:07');
  assert.equal(formatDuration(0), '0:00');
});
