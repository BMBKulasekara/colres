'use client';

import { useEffect, useState } from 'react';
import Tiptap from '../../components/TipTap';

export default function Editor() {
  const [title, setTitle] = useState('Untitled Document');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    // Initialize
    setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`min-h-screen bg-muted/10 pb-20 ${isScrolled ? 'mb-24' : 'mb-0'}`}>
      {/* Document Header Wrapper */}
      <div
        className={`sticky top-0 z-30 transition-all duration-300 w-full ${
          isScrolled
            ? 'bg-background backdrop-blur-md border-b border-border/80 shadow-xs'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`flex flex-col justify-center px-1 transition-all duration-300 ${
              isScrolled ? 'h-14 gap-0' : 'h-24 gap-1'
            }`}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`font-extrabold bg-transparent border-none outline-none focus:ring-0 placeholder-muted-foreground w-full p-0 text-foreground tracking-tight transition-all duration-300 ${
                isScrolled ? 'text-lg' : 'text-3xl'
              }`}
              placeholder="Document Title"
            />
            <p
              className={`text-muted-foreground font-medium transition-all duration-300 ${
                isScrolled ? 'text-[10px]' : 'text-xs'
              }`}
            >
              Rich text document editor • Draft
            </p>
          </div>
        </div>
      </div>

      {/* Document Canvas Wrapper */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-background rounded-xl border border-border/80 shadow-md hover:shadow-lg transition-all duration-300">
          <Tiptap isPageScrolled={isScrolled} />
        </div>
      </div>
    </div>
  );
}
