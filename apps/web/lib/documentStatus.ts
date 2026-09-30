/**
 * What `documents.status` means, in one place.
 *
 * The field is a boolean: `true` is an active document and `false` a draft.
 * That is how the admin console and its bulk actions read it
 * (`bulkSetStatus`: true activates, false returns to draft). The dashboard
 * used to print it the other way round, and the editor hard-coded "Draft", so
 * the two screens disagreed. Both now read it through here.
 */
export type DocumentStatus = 'active' | 'draft';

export function documentStatus(status: boolean | undefined): DocumentStatus {
  return status === false ? 'draft' : 'active';
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  active: 'Active',
  draft: 'Draft',
};

/** The stored value for a status, for `updateDocument`. */
export function statusValue(status: DocumentStatus): boolean {
  return status === 'active';
}
