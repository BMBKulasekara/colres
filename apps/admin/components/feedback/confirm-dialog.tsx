'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { IconAlertTriangle } from '@tabler/icons-react';
import { createContext, useCallback, useContext, useId, useRef, useState } from 'react';

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  /** What else goes with this action, e.g. "42 chat messages, 8 comments". */
  impact?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /** For irreversible actions: the exact text the admin must type to proceed. */
  requireTyping?: string;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * One confirmation dialog for the whole console, opened imperatively:
 *   if (await confirm({ title: 'Delete document?', destructive: true })) …
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const inputId = useId();

  const confirm = useCallback<Confirm>((next) => {
    setTyped('');
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const blocked = Boolean(options?.requireTyping) && typed.trim() !== options?.requireTyping;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent className="sm:max-w-md">
          {options && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!blocked) settle(true);
              }}
              className="flex flex-col gap-4"
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {options.destructive && (
                    <IconAlertTriangle size={20} className="text-destructive" aria-hidden="true" />
                  )}
                  {options.title}
                </DialogTitle>
                {options.description && (
                  <DialogDescription>{options.description}</DialogDescription>
                )}
              </DialogHeader>

              {options.impact && (
                <div
                  className={
                    options.destructive
                      ? 'rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm'
                      : 'rounded-lg border bg-muted/40 p-3 text-sm'
                  }
                >
                  {options.impact}
                </div>
              )}

              {options.requireTyping && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={inputId} className="text-sm font-normal text-muted-foreground">
                    Type{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {options.requireTyping}
                    </span>{' '}
                    to confirm
                  </Label>
                  <Input
                    id={inputId}
                    autoFocus
                    autoComplete="off"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => settle(false)}>
                  {options.cancelText ?? 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  variant={options.destructive ? 'destructive' : 'default'}
                  disabled={blocked}
                  autoFocus={!options.requireTyping}
                >
                  {options.confirmText ?? 'Confirm'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
