/**
 * What team chat accepts as an attachment.
 *
 * Shared by the browser and the server on purpose. The browser copy is there
 * so someone is told "we don't take .zip" before they wait through an upload;
 * the server copy is there because the browser copy proves nothing — the
 * Convex deployment URL ships in the page bundle, so a mutation can be called
 * directly with whatever arguments the caller likes. Two checks, one list.
 *
 * The list is keyed on the *file extension*, with the MIME type as corroboration
 * rather than as the decision. Browsers are unreliable about the types this
 * team actually exchanges: Chrome reports an empty type for `.tex` and for
 * `.heic` on most systems, and a `.tex` file picked up from some editors
 * arrives as `text/plain`. An extension-first rule accepts the files
 * researchers really send; a MIME-first one would reject a LaTeX source.
 */

export interface AttachmentType {
  /** Lowercase, without the dot. */
  extension: string;
  /** Types a browser may report for this extension. Empty is always tolerated. */
  mimeTypes: string[];
  /** How a message bubble presents it: inline, or as a card to download. */
  kind: "image" | "file";
  /** Shown on the file card, e.g. "Word document". */
  label: string;
}

export const ATTACHMENT_TYPES: AttachmentType[] = [
  { extension: "pdf", mimeTypes: ["application/pdf"], kind: "file", label: "PDF" },
  {
    extension: "docx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    kind: "file",
    label: "Word document",
  },
  { extension: "txt", mimeTypes: ["text/plain"], kind: "file", label: "Text file" },
  {
    extension: "tex",
    // Chrome reports "" and some editors hand over text/plain.
    mimeTypes: ["text/x-tex", "application/x-tex", "text/plain"],
    kind: "file",
    label: "LaTeX source",
  },
  {
    extension: "xlsx",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    kind: "file",
    label: "Excel spreadsheet",
  },
  {
    extension: "pptx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    kind: "file",
    label: "PowerPoint deck",
  },
  { extension: "jpg", mimeTypes: ["image/jpeg"], kind: "image", label: "Image" },
  { extension: "jpeg", mimeTypes: ["image/jpeg"], kind: "image", label: "Image" },
  {
    extension: "heic",
    mimeTypes: ["image/heic", "image/heif"],
    // Classed as an image although most browsers cannot decode one: the bubble
    // tries to show it and falls back to a file card when the decode fails,
    // which is the only way to serve Safari and Chrome from one record.
    kind: "image",
    label: "HEIC image",
  },
];

/** The `accept` attribute for the file picker, so the dialog pre-filters. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_TYPES.map((type) => `.${type.extension}`).join(
  ","
);

/**
 * 25 MB. Chosen to clear a figure-heavy PDF draft comfortably while staying
 * well inside what a browser will hold in memory to hash and upload.
 */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Enough to send a paper and its figures at once, few enough to stay readable. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/** 5 minutes. Past this a voice note wants to be a call. */
export const MAX_VOICE_SECONDS = 300;

/**
 * Containers MediaRecorder produces across browsers: Chrome and Firefox give
 * WebM/Opus, Safari gives MP4/AAC. Both are stored as recorded rather than
 * transcoded, because every browser can play back what some browser recorded.
 */
export const VOICE_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
];

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export type AttachmentCheck =
  | { ok: true; type: AttachmentType }
  | { ok: false; reason: string };

/**
 * Decides whether one file may be attached, and as what.
 *
 * `size` is optional so the same function can vet a record the server was
 * handed as well as a File the picker produced.
 */
export function checkAttachment(
  fileName: string,
  mimeType: string,
  size?: number
): AttachmentCheck {
  const extension = fileExtension(fileName);
  const type = ATTACHMENT_TYPES.find((candidate) => candidate.extension === extension);

  if (!type) {
    return {
      ok: false,
      reason: extension
        ? `.${extension} files cannot be attached.`
        : "That file has no extension, so its type cannot be established.",
    };
  }

  // An empty type is normal for .tex and .heic and says nothing either way; a
  // populated type that contradicts the extension is worth refusing, since it
  // means the file is not what it is named.
  if (mimeType && !type.mimeTypes.includes(mimeType)) {
    return {
      ok: false,
      reason: `That file is named .${extension} but reports itself as ${mimeType}.`,
    };
  }

  if (size !== undefined && size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      reason: `Attachments are limited to ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
    };
  }

  if (size === 0) {
    return { ok: false, reason: "That file is empty." };
  }

  return { ok: true, type };
}

/** True when the recording is in a container a browser could have produced. */
export function isVoiceMimeType(mimeType: string): boolean {
  // MediaRecorder appends codec parameters: "audio/webm;codecs=opus".
  const base = mimeType.split(";")[0]?.trim() ?? "";
  return VOICE_MIME_TYPES.includes(base);
}

/** "1.4 MB" — sized for a file card, so one decimal is plenty. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** "1:07" — a clip length, which is never long enough to need hours. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}
