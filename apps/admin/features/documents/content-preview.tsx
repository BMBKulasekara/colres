'use client';

import { useTheme } from '../../components/shell/theme-provider';

/**
 * Renders document HTML read-only. The iframe is fully sandboxed (no scripts,
 * no same-origin), so stored content can never run code in the console, which
 * is safer than sanitizing it ourselves. Editing happens in the web app.
 */
export function ContentPreview({ html, title }: { html: string; title: string }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { color-scheme: ${dark ? 'dark' : 'light'}; }
    body { margin: 0; padding: 20px 24px; font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, sans-serif;
      color: ${dark ? '#e2e8f0' : '#0f172a'}; background: ${dark ? '#0b1120' : '#ffffff'}; }
    h1, h2, h3 { line-height: 1.25; margin: 1.4em 0 .5em; } h1 { font-size: 1.6em; margin-top: 0; }
    img { max-width: 100%; height: auto; } table { border-collapse: collapse; }
    td, th { border: 1px solid ${dark ? '#334155' : '#e2e8f0'}; padding: 4px 8px; }
    blockquote { margin: 1em 0; padding: .5em 1em; border-left: 3px solid #6366f1; color: ${dark ? '#94a3b8' : '#475569'}; }
    pre, code { font-family: ui-monospace, monospace; font-size: .9em; }
    a { color: #6366f1; }
  </style></head><body>${html || '<p style="opacity:.6">This document is empty.</p>'}</body></html>`;

  return (
    <iframe
      title={`Preview of ${title}`}
      sandbox=""
      srcDoc={srcDoc}
      className="h-[60vh] w-full rounded-lg border bg-background"
    />
  );
}
