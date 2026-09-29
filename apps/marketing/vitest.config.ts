import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // This app pins a different React patch than @repo/ui resolves, and two
    // copies of React break hooks. Next bundles one copy; tests must too.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Radix is otherwise loaded by Node directly, bypassing `dedupe`.
    server: { deps: { inline: [/radix-ui/] } },
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
  },
});
