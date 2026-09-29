import { afterEach, describe, expect, test, vi } from 'vitest';
import { downloadCsv } from './csv';

/** Runs `downloadCsv` and returns the file name and text it tried to save. */
async function captureDownload(run: () => void) {
  let blob: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    blob = b as Blob;
    return 'blob:mock';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {});

  run();

  const link = click.mock.contexts[0] as HTMLAnchorElement;
  return { filename: link.download, href: link.href, text: await blob?.text() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downloadCsv', () => {
  test('writes a header row then one row per record', async () => {
    const rows = [
      { name: 'Ada', docs: 3 },
      { name: 'Grace', docs: 0 },
    ];

    const result = await captureDownload(() =>
      downloadCsv('users.csv', rows, [
        { header: 'Name', value: (r) => r.name },
        { header: 'Documents', value: (r) => r.docs },
      ])
    );

    expect(result.filename).toBe('users.csv');
    expect(result.href).toBe('blob:mock');
    expect(result.text).toBe('Name,Documents\nAda,3\nGrace,0');
  });

  test('quotes cells containing commas, quotes or newlines, and blanks missing values', async () => {
    const rows = [{ title: 'Hello, "world"', note: 'line one\nline two', owner: null }];

    const result = await captureDownload(() =>
      downloadCsv('docs.csv', rows, [
        { header: 'Title', value: (r) => r.title },
        { header: 'Note', value: (r) => r.note },
        { header: 'Owner', value: (r) => r.owner },
      ])
    );

    expect(result.text).toBe('Title,Note,Owner\n"Hello, ""world""","line one\nline two",');
  });
});
