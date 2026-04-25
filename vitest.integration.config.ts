import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration tier config — runs against a real Postgres + RLS booted by the
 * Supabase local CLI (`supabase start`). Kept separate from `vitest.config.ts`
 * so the unit suite stays fast (no jsdom, no DB, no coverage) and so this
 * suite never accidentally runs in the default `npm run test:run` path.
 *
 * Coverage block is intentionally omitted: this tier exists to prove RLS is
 * doing its job, not to push line counts.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    globals: false,
    // Auth + DB roundtrips are slower than a unit-test stub.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
