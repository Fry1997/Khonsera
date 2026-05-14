import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate Vitest config for integration tests that hit a real Supabase
// instance. Run with `npm run test:integration`. Tests inside
// tests/integration/* skip themselves at runtime when the test env vars
// are missing (see hasTestEnv()).

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
