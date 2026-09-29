import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar';
import { cn } from '@repo/ui/lib/utils';
import { initials } from '../lib/format';

export function UserAvatar({
  name,
  imageUrl,
  className,
  square,
}: {
  name: string | undefined | null;
  imageUrl?: string | null;
  className?: string;
  /** Organizations read as squares, people as circles. */
  square?: boolean;
}) {
  return (
    <Avatar className={cn('size-8', square && 'rounded-md', className)}>
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback className={cn('text-xs font-medium', square && 'rounded-md')}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Avatar, name and a secondary line, as used in tables and sheets. */
export function UserCell({
  name,
  secondary,
  imageUrl,
  badge,
  square,
}: {
  name: string;
  secondary?: React.ReactNode;
  imageUrl?: string | null;
  badge?: React.ReactNode;
  square?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar name={name} imageUrl={imageUrl} square={square} />
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{name}</span>
          {badge}
        </span>
        {secondary && <span className="truncate text-xs text-muted-foreground">{secondary}</span>}
      </div>
    </div>
  );
}
