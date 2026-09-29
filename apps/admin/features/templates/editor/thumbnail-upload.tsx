'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import { IconLoader2, IconPhotoUp, IconX } from '@tabler/icons-react';
import { useMutation } from 'convex/react';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../../lib/convex-error';

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Uploads a gallery thumbnail to Convex storage and hands back its id; the
 * template only points at it once the editor is saved.
 */
export function ThumbnailUpload({
  currentUrl,
  value,
  onChange,
}: {
  currentUrl: string | null;
  value: Id<'_storage'> | undefined;
  onChange: (id: Id<'_storage'> | undefined) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.templates.adminGenerateThumbnailUploadUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Images must be 2 MB or smaller');
      return;
    }
    setUploading(true);
    try {
      const url = await generateUploadUrl();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
      setPreview(URL.createObjectURL(file));
      onChange(storageId);
    } catch (error) {
      toast.error(errorMessage(error, 'Upload failed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const shown = preview ?? (value ? currentUrl : null);

  return (
    <div className="flex items-center gap-4">
      <div className="relative grid aspect-[3/4] w-20 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
        {shown ? (
          // `unoptimized`: a local blob: preview or a Convex storage URL, shown as-is.
          <Image
            src={shown}
            alt="Template thumbnail"
            fill
            unoptimized
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <IconPhotoUp size={20} className="text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <IconLoader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <IconPhotoUp size={14} aria-hidden="true" />
            )}
            {shown ? 'Replace' : 'Upload'}
          </Button>
          {shown && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPreview(null);
                onChange(undefined);
              }}
            >
              <IconX size={14} aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG or WebP, up to 2 MB. Portrait (3:4) looks best.
        </p>
      </div>
    </div>
  );
}
