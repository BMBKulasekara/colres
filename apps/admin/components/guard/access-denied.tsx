'use client';

import { useClerk } from '@clerk/nextjs';
import { IconExternalLink, IconLock, IconSwitchHorizontal } from '@tabler/icons-react';
import { WEB_APP_URL } from '../../lib/constants';
import styles from './guard.module.css';

export function AccessDenied({ email }: { email?: string }) {
  const { signOut } = useClerk();

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGlow} />
      <div className={styles.card}>
        <div className={styles.deniedIcon}>
          <IconLock size={30} aria-hidden="true" />
        </div>
        <h1 className={styles.title}>Access denied</h1>
        <p className={styles.description}>
          This account doesn&apos;t have admin access. Ask an existing admin to grant it, or switch
          to an admin account.
        </p>
        {email && (
          <div className={styles.userBadge}>
            <span className={styles.userDot} />
            {email}
          </div>
        )}
        <button type="button" className={styles.button} onClick={() => signOut()}>
          <IconSwitchHorizontal size={18} aria-hidden="true" />
          Switch account
        </button>
        <a className={styles.secondaryLink} href={WEB_APP_URL}>
          Go to the Colres app
          <IconExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
