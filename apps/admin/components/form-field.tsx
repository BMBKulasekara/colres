import { Label } from '@repo/ui/components/ui/label';
import { cn } from '@repo/ui/lib/utils';
import { IconInfoCircle } from '@tabler/icons-react';

/**
 * A labelled control with optional helper text and an inline error. The error
 * is announced and tied to the control through `aria-describedby`, which the
 * caller passes on as `${id}-hint`.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-hint`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function NativeSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  className,
  ...rest
}: {
  id?: string;
  value: T;
  options: readonly (T | { value: T; label: string })[];
  onChange: (value: T) => void;
  className?: string;
} & Omit<React.ComponentProps<'select'>, 'value' | 'onChange'>) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30',
        className
      )}
      {...rest}
    >
      {options.map((option) => {
        const { value: v, label } =
          typeof option === 'string' ? { value: option, label: option } : option;
        return (
          <option key={v} value={v}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

export function Callout({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed',
        tone === 'info' && 'border-border/70 bg-muted/40 text-muted-foreground',
        tone === 'warn' && 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
      )}
    >
      <IconInfoCircle size={15} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
