import { cn } from '@repo/ui/lib/utils';
import { IconCrown, IconStarFilled } from '@tabler/icons-react';

export type Status =
  | 'published'
  | 'draft'
  | 'active'
  | 'admin'
  | 'user'
  | 'featured'
  | 'owner'
  | 'org-admin';

const STYLES: Record<
  Status,
  { label: string; className: string; dot?: boolean; icon?: React.ReactNode }
> = {
  published: {
    label: 'Published',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dot: true,
  },
  active: {
    label: 'Active',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dot: true,
  },
  draft: {
    label: 'Draft',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dot: true,
  },
  admin: {
    label: 'Admin',
    className: 'border-primary/25 bg-primary/10 text-primary',
    icon: <IconCrown size={12} aria-hidden="true" />,
  },
  user: { label: 'User', className: 'border-border bg-muted text-muted-foreground' },
  featured: {
    label: 'Featured',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    icon: <IconStarFilled size={11} aria-hidden="true" />,
  },
  owner: { label: 'Owner', className: 'border-primary/25 bg-primary/10 text-primary' },
  'org-admin': { label: 'Org admin', className: 'border-border bg-muted text-foreground' },
};

/** Status as a pill with a dot or icon plus text, so it never relies on colour alone. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        style.className,
        className
      )}
    >
      {style.dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {style.icon}
      {label ?? style.label}
    </span>
  );
}
