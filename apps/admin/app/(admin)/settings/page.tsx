import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SettingsView } from '../../../features/settings/settings-view';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
