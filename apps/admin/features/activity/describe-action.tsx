import type { Doc } from '@repo/convex/_generated/dataModel';
import Link from 'next/link';

type Entry = Pick<Doc<'auditLog'>, 'action' | 'entityType' | 'entityId' | 'entityLabel' | 'meta'>;

type Meta = {
  from?: string;
  to?: string;
  fields?: string[];
  fromVersion?: number;
  toVersion?: number;
  sourceName?: string;
  templatesCreated?: number;
  templatesUpdated?: number;
  count?: number;
};

const DELETIONS = new Set([
  'document.delete',
  'template.delete',
  'user.delete',
  'document.bulk_delete',
]);

function entityHref(entry: Entry): string | null {
  if (!entry.entityId || DELETIONS.has(entry.action)) return null;
  switch (entry.entityType) {
    case 'document':
      return `/documents?open=${entry.entityId}`;
    case 'template':
      return `/templates/${entry.entityId}`;
    case 'user':
      return `/users?open=${entry.entityId}`;
    case 'organization':
      return `/organizations?open=${entry.entityId}`;
    default:
      return null;
  }
}

function EntityName({ entry }: { entry: Entry }) {
  const href = entityHref(entry);
  return href ? (
    <Link href={href} className="font-medium text-foreground underline-offset-2 hover:underline">
      {entry.entityLabel}
    </Link>
  ) : (
    <span className="font-medium text-foreground">{entry.entityLabel}</span>
  );
}

/** A sentence fragment after the actor's name: "published template IEEE Conference". */
export function describeAction(entry: Entry): React.ReactNode {
  const meta = (entry.meta ?? {}) as Meta;
  const name = <EntityName entry={entry} />;
  const fields = meta.fields?.length ? (
    <span className="text-muted-foreground"> · {meta.fields.join(', ')}</span>
  ) : null;

  switch (entry.action) {
    case 'document.update':
      return (
        <>
          edited document {name}
          {fields}
        </>
      );
    case 'document.activate':
      return <>set document {name} to active</>;
    case 'document.draft':
      return <>moved document {name} to draft</>;
    case 'document.delete':
      return <>deleted document {name}</>;
    case 'document.bulk_activate':
      return <>set {name} to active</>;
    case 'document.bulk_draft':
      return <>moved {name} to draft</>;
    case 'document.bulk_delete':
      return <>deleted {name}</>;
    case 'template.create':
      return <>created template {name}</>;
    case 'template.update':
      return (
        <>
          updated template {name}
          {meta.fromVersion !== undefined && (
            <span className="text-muted-foreground">
              {' '}
              · v{meta.fromVersion} → v{meta.toVersion}
            </span>
          )}
        </>
      );
    case 'template.publish':
      return <>published template {name}</>;
    case 'template.unpublish':
      return <>unpublished template {name}</>;
    case 'template.feature':
      return <>featured template {name}</>;
    case 'template.unfeature':
      return <>stopped featuring template {name}</>;
    case 'template.duplicate':
      return (
        <>
          duplicated {meta.sourceName ?? 'a template'} as {name}
        </>
      );
    case 'template.delete':
      return <>deleted template {name}</>;
    case 'user.role':
      return (
        <>
          changed {name}&apos;s role from {meta.from ?? '?'} to{' '}
          <span className="font-medium text-foreground">{meta.to ?? '?'}</span>
        </>
      );
    case 'user.delete':
      return <>deleted user {name}</>;
    case 'catalog.sync':
      return (
        <>
          synced the template catalog
          <span className="text-muted-foreground">
            {' '}
            · {meta.templatesCreated ?? 0} added, {meta.templatesUpdated ?? 0} updated
          </span>
        </>
      );
    default:
      return (
        <>
          {entry.action.replace('.', ' ')} {name}
        </>
      );
  }
}
