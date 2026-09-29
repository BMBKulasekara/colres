'use client';

import { SignIn } from '@clerk/nextjs';
import styles from './guard.module.css';

export function SignInScreen() {
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
              headerTitle: { color: '#ffffff' },
              headerSubtitle: { color: '#a1a1aa' },
              socialButtonsBlockButtonText: { color: '#ffffff' },
              formButtonPrimary: {
                backgroundColor: '#ffffff',
                color: '#09090b',
                '&:hover': { backgroundColor: '#f4f4f5' },
              },
              footerActionText: { color: '#a1a1aa' },
              footerActionLink: { color: '#818cf8', '&:hover': { color: '#a5b4fc' } },
            },
          }}
        />
      </div>
    </div>
  );
}
