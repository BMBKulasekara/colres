import { cn } from '@repo/ui/lib/utils';
import type { Icon } from '@tabler/icons-react';

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  className,
}: {
  icon: Icon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center',
        className
      )}
    >
      <div className="relative mb-2 grid size-14 place-items-center rounded-2xl bg-linear-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
        <IconComponent size={26} stroke={1.6} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
