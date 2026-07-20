'use client';
import { SignIn, useClerk, useUser } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import styles from './AdminGuard.module.css';
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const upsertUser = useMutation(api.users.upsert);
  const syncedRef = useRef<string | null>(null);

  // Track sync state
  const [isSyncing, setIsSyncing] = useState(false);
  // Sync user metadata to Convex on login
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return;
    }
    const userKey = `${user.id}:${user.primaryEmailAddress?.emailAddress ?? ''}`;
    if (syncedRef.current === userKey) {
      return;
    }
    const syncUser = async () => {
      try {
        setIsSyncing(true);
        syncedRef.current = userKey;
        const computedName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

        await upsertUser({
          clerkId: user.id,
          name: user.fullName ?? (computedName || 'Anonymous'),
          email: user.primaryEmailAddress?.emailAddress ?? '',
          imageUrl: user.imageUrl ?? '',
        });
      } catch (err) {
        console.error('Failed to sync user to Convex:', err);
      } finally {
        setIsSyncing(false);
      }
    };
    void syncUser();
  }, [isLoaded, isSignedIn, user, upsertUser]);
  // Query database user to inspect role
  const convexUser = useQuery(
    api.users.getByClerkId,
    isSignedIn && user ? { clerkId: user.id } : 'skip'
  );
  // 1. Loading state (Clerk loading, sync in progress, or Convex query loading)
  const isLoading = !isLoaded || isSyncing || (isSignedIn && convexUser === undefined);
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.backgroundGlow} />
        <div className={styles.spinnerWrapper}>
          <div className={styles.spinner} />
          <div className={styles.loadingText}>Verifying Credentials...</div>
        </div>
      </div>
    );
  }
  // 2. Not Signed In -> Show Clerk Sign In form
  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.backgroundGlow} />
        <div className={styles.clerkWrapper}>
          <SignIn
            routing="hash"
            appearance={{
              elements: {
                card: {
                  background: 'rgba(20, 20, 25, 0.7)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                },
                headerTitle: {
                  color: '#ffffff',
                },
                headerSubtitle: {
                  color: '#a1a1aa',
                },
                socialButtonsBlockButtonText: {
                  color: '#ffffff',
                },
                formButtonPrimary: {
                  backgroundColor: '#ffffff',
                  color: '#09090b',
                  '&:hover': {
                    backgroundColor: '#f4f4f5',
                  },
                },
                footerActionText: {
                  color: '#a1a1aa',
                },
                footerActionLink: {
                  color: '#6366f1',
                  '&:hover': {
                    color: '#818cf8',
                  },
                },
              },
            }}
          />
        </div>
      </div>
    );
  }
  // 3. Convex User Role Check
  const isAdmin = convexUser && convexUser.role === 'admin';
  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.backgroundGlow} />
        <div className={styles.card}>
          <div className={styles.deniedIcon}>
            {/* <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg> */}
          </div>
          <h2 className={styles.title}>Access Denied</h2>
          <p className={styles.description}>
            You do not have administrative privileges to access this area.
          </p>
          <div className={styles.userBadge}>
            <span className={styles.userDot} />
            {user.primaryEmailAddress?.emailAddress}
          </div>
          <button type="submit" className={styles.button} onClick={() => signOut()}>
            {/* <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg> */}
            Sign Out
          </button>
        </div>
      </div>
    );
  }
  // 4. Authenticated & Admin Role verified -> Show dashboard
  return <>{children}</>;
}
