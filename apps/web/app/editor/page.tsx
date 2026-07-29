'use client';

import { useState } from 'react';
import Tiptap from '../../components/TipTap';

export default function Editor() {
  const [title, setTitle] = useState('Untitled Document');

  return (
    <div className="min-h-screen bg-muted/10 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Document Header */}
        <div className="flex flex-col gap-1 px-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl font-extrabold bg-transparent border-none outline-none focus:ring-0 placeholder-muted-foreground w-full p-0 text-foreground tracking-tight"
            placeholder="Document Title"
          />
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Rich text document editor • Draft
          </p>
        </div>

        {/* Document Canvas */}
        <div className="bg-background rounded-xl border border-border/80 shadow-md hover:shadow-lg transition-all duration-300">
          <Tiptap />
        </div>
      </div>
    </div>
  );
}
