'use client';

import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { Component, type ReactNode } from 'react';
import { errorMessage } from '../../lib/convex-error';

export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this",
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className
      )}
    >
      <div className="mb-1 grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
        <IconAlertTriangle size={22} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <IconRefresh size={15} aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Catches a failing widget or list so one broken query doesn't blank the page.
 * Convex surfaces query errors by throwing during render, so a boundary is how
 * they are caught. "Try again" re-mounts the children, which re-subscribes.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; title?: string; className?: string },
  { error: unknown; attempt: number }
> {
  state = { error: null as unknown, attempt: 0 };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  reset = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          error={this.state.error}
          title={this.props.title}
          className={this.props.className}
          onRetry={this.reset}
        />
      );
    }
    return (
      <div key={this.state.attempt} className="contents">
        {this.props.children}
      </div>
    );
  }
}
