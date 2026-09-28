'use client';

import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Stagger index; each step adds 60 ms of delay. */
  index?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Fades content up as it enters the viewport (500 ms, ease-out). Styling lives
 * in globals.css under `[data-reveal]`, which also disables it for reduced motion.
 */
export function Reveal({ as: Tag = 'div', index = 0, className, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      {...rest}
      ref={ref}
      data-reveal={visible ? 'visible' : 'hidden'}
      style={{ '--reveal-delay': `${index * 60}ms` } as CSSProperties}
      className={className}
    >
      {children}
    </Tag>
  );
}
