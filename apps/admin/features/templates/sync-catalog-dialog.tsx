'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';
import { IconLoader2 } from '@tabler/icons-react';
import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useId, useState } from 'react';
import { Callout } from '../../components/form-field';
import { useAsyncAction } from '../../hooks/use-async-action';

type SyncResult = FunctionReturnType<typeof api.seedTemplates.adminReseedCatalog>;

/**
 * Adds any built-in templates missing from this deployment. With "overwrite",
 * existing built-ins are reset to the catalog version (status and usage kept).
 */
export function SyncCatalogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const reseed = useMutation(api.seedTemplates.adminReseedCatalog);
  const { run, pending } = useAsyncAction(() => reseed({ overwrite }), {
    error: "Couldn't sync the catalog",
  });

  const close = (next: boolean) => {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setResult(null);
      setOverwrite(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync built-in templates</DialogTitle>
          <DialogDescription>
            Brings this deployment in line with the template catalog that ships with Colres.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <dl className="grid grid-cols-2 gap-2 text-sm" aria-live="polite">
            {[
              ['Templates added', result.templatesCreated],
              ['Templates updated', result.templatesUpdated],
              ['Already present', result.templatesSkipped],
              ['Categories added', result.categoriesCreated],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={`${id}-overwrite`}
                checked={overwrite}
                onCheckedChange={(value) => setOverwrite(Boolean(value))}
              />
              <div className="grid gap-0.5">
                <Label htmlFor={`${id}-overwrite`}>Overwrite existing built-ins</Label>
                <p className="text-xs text-muted-foreground">
                  Resets their content and settings to the catalog version.
                </p>
              </div>
            </div>
            {overwrite && (
              <Callout tone="warn">
                Edits made here to built-in templates are replaced. Published status and usage
                counts are kept, and each updated template gets a new version.
              </Callout>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" disabled={pending} onClick={() => close(false)}>
                Cancel
              </Button>
              <Button
                disabled={pending}
                onClick={async () => {
                  const next = await run();
                  if (next) setResult(next);
                }}
              >
                {pending && <IconLoader2 size={15} className="animate-spin" aria-hidden="true" />}
                {overwrite ? 'Sync and overwrite' : 'Sync'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
