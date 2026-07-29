'use client';

import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';
import { Skeleton } from '@repo/ui/components/ui/skeleton';

export function AuthNav() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center">
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      {!isSignedIn ? (
        <>
          <SignInButton />
          <SignUpButton />
        </>
      ) : (
        <UserButton />
      )}
    </div>
  );
}
