'use client';

import { useAuth } from '@clerk/nextjs';
import Docs from './docs/page';

export default function Home() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  return (
    <div>
      <Docs />
    </div>
  );
}
