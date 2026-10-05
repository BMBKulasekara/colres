'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { useMutation } from 'convex/react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

/** Word files larger than this are refused before reading. */
const MAX_DOCX_BYTES = 25 * 1024 * 1024;

const placeholder = (i: number) => `colres-import-image-${i}`;

type Step =
  | { kind: 'idle' }
  | { kind: 'working'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'done'; slug: string; warnings: string[] };

export interface DocxImportHandle {
  /** Opens the file picker. */
  open: () => void;
}

/**
 * "Import Word document": picks a .docx, converts it, and creates a new
 * document from it in the current workspace. The file is converted before
 * anything is created, so a file that cannot be read leaves nothing behind.
 */
export const DocxImport = forwardRef<DocxImportHandle, { orgId: string | undefined }>(
  function DocxImport({ orgId }, ref) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<Step>({ kind: 'idle' });

    const createDoc = useMutation(api.documents.createDocument);
    const updateDoc = useMutation(api.documents.updateDocument);
    const generateUploadUrl = useMutation(api.chats.generateUploadUrl);
    const resolveUpload = useMutation(api.documents.resolveUploadUrl);

    useImperativeHandle(ref, () => ({ open: () => inputRef.current?.click() }));

    const uploadImage = async (documentId: Id<'documents'>, image: Blob) => {
      const uploadUrl = await generateUploadUrl({ documentId });
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: image.type ? { 'Content-Type': image.type } : undefined,
        body: image,
      });
      if (!response.ok) throw new Error('upload failed');
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
      const url = await resolveUpload({ documentId, storageId });
      if (!url) throw new Error('upload failed');
      return url;
    };

    const run = async (file: File) => {
      if (!/\.docx$/i.test(file.name)) {
        setStep({
          kind: 'error',
          message: 'Choose a Word document (.docx). Older .doc files need saving as .docx first.',
        });
        return;
      }
      if (file.size > MAX_DOCX_BYTES) {
        setStep({ kind: 'error', message: 'That file is larger than 25 MB.' });
        return;
      }

      try {
        setStep({ kind: 'working', message: `Reading ${file.name}…` });
        // Loaded on demand: the converter is only needed here.
        const { importDocx } = await import('../lib/docxImport');

        // Images are held back and given placeholder addresses, because they
        // can only be uploaded once the document exists.
        const images: Blob[] = [];
        const converted = await importDocx(file, async (image) => {
          images.push(image);
          return placeholder(images.length - 1);
        });

        setStep({ kind: 'working', message: 'Creating the document…' });
        const { id, slug } = await createDoc({ title: converted.title, orgId });

        let html = converted.html;
        const warnings = [...converted.warnings];
        if (images.length > 0) {
          setStep({
            kind: 'working',
            message: `Uploading ${images.length} image${images.length === 1 ? '' : 's'}…`,
          });
          let failed = 0;
          for (const [i, image] of images.entries()) {
            try {
              html = html.replaceAll(
                `src="${placeholder(i)}"`,
                `src="${await uploadImage(id, image)}"`
              );
            } catch {
              failed += 1;
              html = html.replace(new RegExp(`<img[^>]*src="${placeholder(i)}"[^>]*/?>`, 'g'), '');
            }
          }
          if (failed > 0)
            warnings.push(`${failed} image${failed === 1 ? '' : 's'} could not be uploaded.`);
        }

        await updateDoc({ id, content: html });

        if (warnings.length === 0) {
          router.push(`/docs/${slug}`);
          return;
        }
        setStep({ kind: 'done', slug, warnings });
      } catch {
        setStep({
          kind: 'error',
          message:
            'This file could not be read as a Word document. Check it opens in Word and try again.',
        });
      }
    };

    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void run(file);
          }}
        />
        <Dialog
          open={step.kind !== 'idle'}
          onOpenChange={(open) => !open && step.kind !== 'working' && setStep({ kind: 'idle' })}
        >
          <DialogContent showCloseButton={step.kind !== 'working'} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {step.kind === 'error'
                  ? 'Import failed'
                  : step.kind === 'done'
                    ? 'Imported, with notes'
                    : 'Importing Word document'}
              </DialogTitle>
              <DialogDescription>
                {step.kind === 'working' && step.message}
                {step.kind === 'error' && step.message}
                {step.kind === 'done' &&
                  'The document was created. A few things did not come across from Word:'}
              </DialogDescription>
            </DialogHeader>

            {step.kind === 'working' && (
              <Loader2 className="mx-auto my-4 size-5 animate-spin text-muted-foreground" />
            )}
            {step.kind === 'done' && (
              <ul className="flex flex-col gap-1.5 text-sm">
                {step.warnings.map((warning) => (
                  <li key={warning} className="flex gap-2">
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    {warning}
                  </li>
                ))}
              </ul>
            )}

            {step.kind !== 'working' && (
              <DialogFooter>
                {step.kind === 'done' ? (
                  <Button onClick={() => router.push(`/docs/${step.slug}`)}>Open document</Button>
                ) : (
                  <Button variant="outline" onClick={() => setStep({ kind: 'idle' })}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }
);
