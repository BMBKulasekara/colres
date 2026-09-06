'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
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
      {/* Forwards the Clerk JWT to Convex so backend functions can verify the caller. */}
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '1rem 1.5rem',
            gap: '0.75rem',
            borderBottom: '1px solid #e5e7eb',
            height: '64px',
          }}
          className="bg-lime-300"
        >
          <AuthNav />
        </header>
        <ClerkConvexSync convex={convex} />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
