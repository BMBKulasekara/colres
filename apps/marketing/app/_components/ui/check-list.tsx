import { cn } from '@repo/ui/lib/utils';
import { Check } from 'lucide-react';

interface CheckListProps {
  items: readonly string[];
  className?: string;
  /** Icon colour; defaults to the teal "success" accent. */
  iconClassName?: string;
}

export function CheckList({ items, className, iconClassName }: CheckListProps) {
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15px] text-slate-700 leading-6">
          <Check
            aria-hidden
            strokeWidth={2.25}
            className={cn('mt-0.5 size-4.5 shrink-0 text-teal-600', iconClassName)}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}
