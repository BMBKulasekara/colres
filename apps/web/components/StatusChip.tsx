import { CircleCheck, PencilLine } from 'lucide-react';
import { DOCUMENT_STATUS_LABELS, type DocumentStatus } from '../lib/documentStatus';

const STATUS_STYLES: Record<DocumentStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  active: 'bg-success/12 text-success',
};

const STATUS_ICONS = {
  draft: PencilLine,
  active: CircleCheck,
} as const;

/** A document's status, shown with an icon as well as a colour. */
export function StatusChip({
  status,
  className = '',
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]} ${className}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}
