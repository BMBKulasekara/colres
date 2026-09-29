import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The lib tests are pure functions; a component test can opt into a DOM
    // with a `// @vitest-environment jsdom` comment at the top of the file.
    environment: 'node',
    include: ['**/*.test.{ts,tsx,js}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
  },
});
