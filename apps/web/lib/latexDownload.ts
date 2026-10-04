/**
 * Browser half of the LaTeX export: fetches the figures, runs the converter,
 * and downloads the result as a zip ready to upload to Overleaf.
 */

import { strToU8, zipSync } from 'fflate';
import { collectImageSources, type LatexExportInput, toLatex } from './latexExport';

/** Image types every LaTeX engine can include directly. */
const NATIVE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};

/**
 * Re-encodes an image LaTeX cannot include (WebP, GIF, …) as PNG. Decoding a
 * blob does not taint the canvas, so this works for cross-origin images too.
 */
async function toPng(blob: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  }
}

/** Fetches one figure image, as bytes and the extension it should be saved with. */
async function fetchImage(src: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    let blob = await response.blob();
    let ext = NATIVE_TYPES[blob.type];
    if (!ext) {
      const png = await toPng(blob);
      if (!png) return null;
      blob = png;
      ext = 'png';
    }
    return { bytes: new Uint8Array(await blob.arrayBuffer()), ext };
  } catch {
    return null;
  }
}

function readme(title: string, engine: string, warnings: string[]): string {
  return [
    `${title}: LaTeX export from Colres`,
    '',
    'To compile in Overleaf: New Project > Upload Project, and choose this zip.',
    `To compile locally: latexmk main.tex (the engine, ${engine}, is set in latexmkrc).`,
    '',
    ...(warnings.length
      ? ['Check before submitting:', ...warnings.map((w) => `  - ${w}`)]
      : ['No problems were found during export.']),
    '',
  ].join('\n');
}

/**
 * Builds the LaTeX project for a document and downloads it as `<slug>.zip`.
 * Returns the warnings, so the caller can tell the author what to check.
 */
export async function downloadLatexZip(
  input: Omit<LatexExportInput, 'images'>,
  fileName: string
): Promise<string[]> {
  const images = new Map<string, string>();
  const zipFiles: Record<string, Uint8Array> = {};

  const sources = collectImageSources(input.doc);
  const fetched = await Promise.all(sources.map(fetchImage));
  fetched.forEach((image, i) => {
    const src = sources[i];
    if (!image || !src) return;
    const path = `figures/figure-${i + 1}.${image.ext}`;
    images.set(src, path);
    zipFiles[path] = image.bytes;
  });

  const { files, warnings } = toLatex({ ...input, images });
  for (const [path, contents] of Object.entries(files)) zipFiles[path] = strToU8(contents);
  zipFiles['README.txt'] = strToU8(
    readme(
      input.title.trim() || 'Untitled Document',
      input.template?.engine ?? 'pdflatex',
      warnings
    )
  );

  const zip = zipSync(zipFiles, { level: 6 });
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.zip`;
  link.click();
  URL.revokeObjectURL(url);

  return warnings;
}
