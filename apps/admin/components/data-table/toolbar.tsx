'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';
import { IconChevronDown, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Search box that keeps its own text and reports it 250 ms after typing stops,
 * so typing stays instant while the query (and the URL) update a beat later.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  // Follow external changes (Reset, the back button) without an effect.
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onInput = (next: string) => {
    setText(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(next), 250);
  };

  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <IconSearch
        size={15}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={text}
        onChange={(event) => onInput(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 pl-8"
      />
    </div>
  );
}

export type FacetOption = { value: string; label: string; count?: number };

/**
 * A single-choice filter shown as a chip: "+ Status" when unset,
 * "Status: Active ×" when set.
 */
export function FacetFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: FacetOption[];
  onChange: (value: string | undefined) => void;
}) {
  const selected = options.find((option) => option.value === value);

  if (selected) {
    return (
      <div className="inline-flex h-8 items-center rounded-md border bg-accent/40 text-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-full items-center gap-1 rounded-l-md px-2.5 hover:bg-accent"
            >
              <span className="text-muted-foreground">{label}:</span>
              <span className="font-medium">{selected.label}</span>
            </button>
          </DropdownMenuTrigger>
          <FacetMenu label={label} value={value} options={options} onChange={onChange} />
        </DropdownMenu>
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          onClick={() => onChange(undefined)}
          className="flex h-full items-center rounded-r-md border-l px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <IconX size={13} />
        </button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <IconPlus size={14} aria-hidden="true" />
          {label}
          <IconChevronDown size={13} aria-hidden="true" className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <FacetMenu label={label} value={value} options={options} onChange={onChange} />
    </DropdownMenu>
  );
}

function FacetMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: FacetOption[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {options.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">No options</p>
      ) : (
        <DropdownMenuRadioGroup
          value={value ?? ''}
          onValueChange={(next) => onChange(next || undefined)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span className="flex-1 truncate">{option.label}</span>
              {option.count !== undefined && (
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                  {option.count}
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      )}
    </DropdownMenuContent>
  );
}

export function ResetFiltersButton({ onReset }: { onReset: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onReset}>
      Reset
      <IconX size={14} aria-hidden="true" />
    </Button>
  );
}

/** Underlined tabs with counts, used as a primary filter (role, status). */
export function FilterTabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-1 border-b">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
