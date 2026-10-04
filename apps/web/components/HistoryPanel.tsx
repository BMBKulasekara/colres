'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/ui/alert-dialog';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { useMutation, useQuery } from 'convex/react';
import { Bookmark, Clock, History, Loader2, RotateCcw, Undo2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { formatRelativeTime } from '../lib/relativeTime';

type VersionId = Id<'documentVersions'>;

const KIND_LABEL = {
  auto: 'Automatic save',
  named: 'Named version',
  restore: 'Before a restore',
} as const;

const KIND_ICON = { auto: Clock, named: Bookmark, restore: Undo2 } as const;

const fullDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Earlier versions of the document: name the current one, preview any of
 * them, and restore one. Restoring goes through `onRestore`, which applies the
 * text in the editor so collaborators see it live.
 */
export function HistoryPanel({
  documentId,
  flushSave,
  onRestore,
  readOnly = false,
}: {
  documentId: Id<'documents'>;
  /** Writes any unsaved typing, so a version taken now includes it. */
  flushSave: () => Promise<void>;
  onRestore: (version: { title: string; content: string }) => void;
  /** Viewers and commenters can browse history but not name or restore. */
  readOnly?: boolean;
}) {
  const versions = useQuery(api.versions.list, { documentId });
  const saveNamed = useMutation(api.versions.saveNamed);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<VersionId | null>(null);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await flushSave();
      await saveNamed({ documentId, name });
      setName('');
    } catch {
      setError('Could not save this version. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      {!readOnly && (
        <form onSubmit={handleSave} className="flex flex-col gap-2">
          <label htmlFor="version-name" className="font-semibold text-muted-foreground">
            Name the current version
          </label>
          <div className="flex gap-2">
            <Input
              id="version-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Submitted to journal"
              maxLength={100}
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>
          {error && <p className="text-destructive">{error}</p>}
        </form>
      )}

      {versions === undefined ? (
        <Loader2 className="mx-auto mt-6 size-4 animate-spin text-muted-foreground" />
      ) : versions.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <History className="size-5" />
          <p>
            No versions yet. While you write, a version is saved automatically every few minutes,
            and you can name one above at any time.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {versions.map((version) => {
            const Icon = KIND_ICON[version.kind];
            return (
              <li key={version._id}>
                <button
                  type="button"
                  onClick={() => setPreviewId(version._id)}
                  className="flex w-full items-start gap-2.5 rounded-lg border border-border/60 p-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon
                    aria-hidden
                    className={`mt-0.5 size-3.5 shrink-0 ${version.kind === 'named' ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {version.name ?? KIND_LABEL[version.kind]}
                    </span>
                    <span
                      className="block text-muted-foreground"
                      title={fullDate(version.createdAt)}
                    >
                      {formatRelativeTime(version.createdAt)}
                      {version.createdByName && ` · ${version.createdByName}`}
                      {` · ${version.words.toLocaleString()} words`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Automatic versions are kept for two days, then one a day for 90 days. Named versions are
        kept until the document is deleted.
      </p>

      <VersionPreview
        versionId={previewId}
        onClose={() => setPreviewId(null)}
        flushSave={flushSave}
        readOnly={readOnly}
        onRestore={(version) => {
          setPreviewId(null);
          onRestore(version);
        }}
      />
    </div>
  );
}

/** Styles for the preview frame, which has none of the app's CSS. */
const PREVIEW_CSS = `
  body { font: 15px/1.6 Georgia, 'Times New Roman', serif; color: #1e293b; margin: 24px 32px; }
  h1, h2, h3, h4, h5 { font-family: system-ui, sans-serif; line-height: 1.3; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; margin: 12px 0; }
  td, th { border: 1px solid #cbd5e1; padding: 4px 8px; }
  figure { margin: 16px 0; text-align: center; }
  figcaption, caption { font-size: 13px; color: #475569; }
  span[data-citation]::before { content: '[' attr(data-citation) ']'; color: #4f46e5; }
  span[data-xref]::before { content: '[ref]'; color: #4f46e5; }
  div[data-bibliography]::before { content: 'Reference list'; display: block; font-style: italic; color: #64748b; }
  div[data-page-break] { border-top: 1px dashed #cbd5e1; margin: 16px 0; }
`;

function VersionPreview({
  versionId,
  onClose,
  flushSave,
  onRestore,
  readOnly,
}: {
  versionId: VersionId | null;
  onClose: () => void;
  flushSave: () => Promise<void>;
  onRestore: (version: { title: string; content: string }) => void;
  readOnly: boolean;
}) {
  const version = useQuery(api.versions.get, versionId ? { versionId } : 'skip');
  const prepareRestore = useMutation(api.versions.prepareRestore);
  const rename = useMutation(api.versions.rename);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  const restore = async () => {
    if (!versionId) return;
    setBusy(true);
    try {
      // The text being replaced is kept as a version first, so it has to be
      // the latest text: write whatever is still waiting in the autosave.
      await flushSave();
      onRestore(await prepareRestore({ versionId }));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!versionId || !newName.trim()) return;
    await rename({ versionId, name: newName });
    setNewName('');
  };

  return (
    <>
      <Dialog open={versionId !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {version ? (version.name ?? KIND_LABEL[version.kind]) : 'Loading version…'}
            </DialogTitle>
            <DialogDescription>
              {version
                ? `${version.title || 'Untitled Document'} · ${fullDate(version.createdAt)}${version.createdByName ? ` · ${version.createdByName}` : ''}`
                : ' '}
            </DialogDescription>
          </DialogHeader>

          {version ? (
            // `sandbox` with no permissions: stored HTML is shown, never run.
            <iframe
              title="Version preview"
              sandbox=""
              srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_CSS}</style></head><body>${version.content}</body></html>`}
              className="h-[60dvh] w-full rounded-md border border-border bg-white"
            />
          ) : (
            <Loader2 className="mx-auto my-12 size-5 animate-spin text-muted-foreground" />
          )}

          {!readOnly && (
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <form onSubmit={handleRename} className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={version?.name ? 'Rename' : 'Name this version'}
                  maxLength={100}
                  aria-label="Version name"
                  className="h-9 w-56"
                />
                <Button type="submit" variant="outline" disabled={!newName.trim()}>
                  {version?.name ? 'Rename' : 'Keep'}
                </Button>
              </form>
              <Button onClick={() => setConfirming(true)} disabled={!version}>
                <RotateCcw className="size-4" />
                Restore this version
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              The document will change for everyone editing it. The current text is saved to History
              first, so you can switch back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void restore();
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
