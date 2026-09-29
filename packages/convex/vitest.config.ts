import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Convex functions run in a V8 isolate, not Node; the edge runtime is the
    // closest match and is what convex-test is built against.
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts"],
  },
});
