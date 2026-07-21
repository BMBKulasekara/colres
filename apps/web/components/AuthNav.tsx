'use client';

import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';

export function AuthNav() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
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
