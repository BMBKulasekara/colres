'use client';

import { useClerk } from '@clerk/nextjs';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { IconExternalLink, IconRefresh, IconUserCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { CopyButton } from '../../components/feedback/copy-button';
import { PageBody, PageHeader } from '../../components/page-header';
import { type Theme, useTheme } from '../../components/shell/theme-provider';
import { THEME_OPTIONS } from '../../components/shell/theme-toggle';
import { useCurrentAdmin } from '../../hooks/use-current-admin';
import { WEB_APP_URL } from '../../lib/constants';
import { SyncCatalogDialog } from '../templates/sync-catalog-dialog';

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id ?? title}-heading`}
      className="grid gap-4 border-b pb-8 last:border-0 md:grid-cols-[16rem_1fr]"
    >
      <div>
        <h2 id={`${id ?? title}-heading`} className="font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { openUserProfile } = useClerk();
  const admin = useCurrentAdmin();
  const [syncOpen, setSyncOpen] = useState(false);

  // Deep link from the command palette: /settings#catalog opens the sync dialog.
  useEffect(() => {
    if (window.location.hash === '#catalog') setSyncOpen(true);
  }, []);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'Not configured';

  return (
    <PageBody>
      <PageHeader title="Settings" description="Console preferences and maintenance tools." />

      <div className="flex max-w-4xl flex-col gap-8">
        <Section title="Appearance" description="Applies to this browser only.">
          <fieldset className="grid max-w-md grid-cols-3 gap-2">
            <legend className="sr-only">Theme</legend>
            {THEME_OPTIONS.map(({ value, label, icon: OptionIcon }) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                  theme === value ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-muted/50'
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  className="sr-only"
                  checked={theme === value}
                  onChange={() => setTheme(value as Theme)}
                />
                <OptionIcon size={20} aria-hidden="true" />
                {label}
              </label>
            ))}
          </fieldset>
        </Section>

        <Section
          id="catalog"
          title="Template catalog"
          description="The built-in templates that ship with Colres."
        >
          <p className="text-sm text-muted-foreground">
            Add any built-in templates missing from this deployment, or reset them to the catalog
            version.
          </p>
          <Button variant="outline" className="w-fit" onClick={() => setSyncOpen(true)}>
            <IconRefresh size={16} aria-hidden="true" />
            Sync built-in templates…
          </Button>
        </Section>

        <Section title="Account" description="Your sign-in profile and security.">
          <p className="text-sm">
            Signed in as <span className="font-medium">{admin.email}</span>
          </p>
          <Button variant="outline" className="w-fit" onClick={() => openUserProfile()}>
            <IconUserCircle size={16} aria-hidden="true" />
            Manage account
          </Button>
        </Section>

        <Section title="Environment" description="Read-only details for support and debugging.">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Convex</dt>
            <dd className="flex min-w-0 items-center font-mono text-xs">
              <span className="truncate">{convexUrl}</span>
              {process.env.NEXT_PUBLIC_CONVEX_URL && (
                <CopyButton value={convexUrl} label="Copy Convex URL" />
              )}
            </dd>
            <dt className="text-muted-foreground">Web app</dt>
            <dd>
              <a
                href={WEB_APP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
              >
                {WEB_APP_URL}
                <IconExternalLink size={12} aria-hidden="true" />
              </a>
            </dd>
            <dt className="text-muted-foreground">Environment</dt>
            <dd className="font-mono text-xs">
              {process.env.NEXT_PUBLIC_ENV_LABEL ?? 'Not labelled (set NEXT_PUBLIC_ENV_LABEL)'}
            </dd>
          </dl>
        </Section>
      </div>

      <SyncCatalogDialog
        open={syncOpen}
        onOpenChange={(open) => {
          setSyncOpen(open);
          if (!open && window.location.hash === '#catalog') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
      />
    </PageBody>
  );
}
