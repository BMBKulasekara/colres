'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useMemo } from 'react';
import { AuthNav } from './AuthNav';
import { ClerkConvexSync } from './ClerkConvexSync';

export function AppShell({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      if (typeof window !== 'undefined') {
        throw new Error(
          'NEXT_PUBLIC_CONVEX_URL environment variable is missing. ' +
            'Please check your .env.local file in the application directory.'
        );
      }
      return new ConvexReactClient('https://unknown-convex-url.convex.cloud');
    }
    return new ConvexReactClient(url);
  }, []);

  return (
    <ClerkProvider>
      <ConvexProvider client={convex}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '1rem 1.5rem',
            gap: '0.75rem',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <AuthNav />
        </header>
        <ClerkConvexSync convex={convex} />
        {children}
      </ConvexProvider>
    </ClerkProvider>
  );
}
