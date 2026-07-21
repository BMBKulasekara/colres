'use client';
import { Button } from '@repo/ui/button';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Button
        variant={'destructive'}
        appName="Marketing"
        onClick={() => alert('Hello from Marketing!')}
      >
        Hello World
      </Button>
    </div>
  );
}
