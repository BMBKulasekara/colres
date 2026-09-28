'use client';

import { formatBytes, formatDuration } from '@repo/convex/chat/attachments';
import { Download, FileText, Loader2, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** One attachment as `listMessages` returns it: the record plus a signed URL. */
export interface ChatAttachment {
  storageId: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'file' | 'image' | 'voice';
  durationSec?: number;
  url: string | null;
}

/**
 * Downloads through a blob rather than by pointing an anchor at the storage
 * URL, because Convex serves files inline: a plain `download` link on a
 * cross-origin URL is ignored by the browser, which opens the PDF in a tab
 * instead of saving it under the name the sender gave it.
 */
async function downloadAttachment(attachment: ChatAttachment) {
  if (!attachment.url) return;

  const response = await fetch(attachment.url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = attachment.name;
  link.click();

  URL.revokeObjectURL(objectUrl);
}

function FileCard({ attachment, isMe }: { attachment: ChatAttachment; isMe: boolean }) {
  const [saving, setSaving] = useState(false);

  const handleDownload = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await downloadAttachment(attachment);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
        isMe
          ? 'border-primary-foreground/25 bg-primary-foreground/10'
          : 'border-border bg-background'
      }`}
    >
      <FileText className="h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold leading-tight">{attachment.name}</p>
        <p className="text-[10px] opacity-70">{formatBytes(attachment.size)}</p>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        title={`Download ${attachment.name}`}
        aria-label={`Download ${attachment.name}`}
        className="shrink-0 rounded p-1 transition-opacity hover:opacity-100 opacity-70 disabled:opacity-40"
        disabled={saving || !attachment.url}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

/**
 * An image attachment, which falls back to a file card when the browser cannot
 * decode it.
 *
 * That fallback is the whole reason this is not a bare `<img>`: HEIC is a
 * format people really do send from an iPhone, Safari renders it and Chrome
 * and Firefox do not, and the same stored file has to serve all three. Trying
 * to display it and reacting to the failure is the only way to tell — there is
 * no capability query for "can this browser decode HEIC".
 */
function ImageAttachment({ attachment, isMe }: { attachment: ChatAttachment; isMe: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed || !attachment.url) {
    return <FileCard attachment={attachment} isMe={isMe} />;
  }

  return (
    <div className="space-y-1">
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-border/50"
        title={`Open ${attachment.name}`}
      >
        {/* Not next/image: these are user uploads on a per-deployment Convex
            subdomain, and the optimiser would need every one of them declared
            as a remote pattern. */}
        {/** biome-ignore lint/performance/noImgElement: user upload, arbitrary host */}
        <img
          src={attachment.url}
          alt={attachment.name}
          onError={() => setFailed(true)}
          className="max-h-56 w-auto max-w-full object-contain"
        />
      </a>
      <button
        type="button"
        onClick={() => downloadAttachment(attachment)}
        className="flex items-center gap-1 text-[10px] opacity-70 hover:opacity-100"
      >
        <Download className="h-2.5 w-2.5" />
        {attachment.name}
      </button>
    </div>
  );
}

/**
 * A voice message.
 *
 * Deliberately a custom transport rather than `<audio controls>`: the native
 * player is a different size and colour in every browser, which inside a chat
 * bubble looks like a bug. The clip length comes from the record, so the
 * duration shows before the audio has loaded far enough to know it — and for a
 * WebM recording whose duration metadata is unreliable, it is the only
 * trustworthy source.
 */
function VoiceMessage({ attachment, isMe }: { attachment: ChatAttachment; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const total = attachment.durationSec ?? 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setElapsed(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setElapsed(0);
    };

    // Pause is listened for rather than assumed, because playback can stop
    // without the button being pressed — another tab taking the audio focus,
    // or the phone's own media controls.
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${
        isMe
          ? 'border-primary-foreground/25 bg-primary-foreground/10'
          : 'border-border bg-background'
      }`}
    >
      {attachment.url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- a voice note has no transcript
        <audio ref={audioRef} src={attachment.url} preload="none">
          <track kind="captions" />
        </audio>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={!attachment.url}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isMe ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'
        }`}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-px" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={`h-1 w-full overflow-hidden rounded-full ${
            isMe ? 'bg-primary-foreground/25' : 'bg-muted-foreground/20'
          }`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${
              isMe ? 'bg-primary-foreground' : 'bg-primary'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="shrink-0 text-[10px] tabular-nums opacity-70">
        {formatDuration(playing || elapsed > 0 ? total - elapsed : total)}
      </span>
    </div>
  );
}

export function AttachmentList({
  attachments,
  isMe,
}: {
  attachments: readonly ChatAttachment[];
  isMe: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {attachments.map((attachment) => {
        const key = attachment.storageId;
        if (attachment.kind === 'voice') {
          return <VoiceMessage key={key} attachment={attachment} isMe={isMe} />;
        }
        if (attachment.kind === 'image') {
          return <ImageAttachment key={key} attachment={attachment} isMe={isMe} />;
        }
        return <FileCard key={key} attachment={attachment} isMe={isMe} />;
      })}
    </div>
  );
}
