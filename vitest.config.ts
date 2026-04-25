import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Integration tier (real Postgres + RLS via supabase start) lives in
    // tests/integration/ and runs through vitest.integration.config.ts.
    // Exclude it here so the unit suite stays fast and node-version-pure.
    exclude: ["tests/integration/**", "node_modules/**", ".next/**"],
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.d.ts",
        "src/**/__mocks__/**",
        "src/types/**",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/route.ts",
        "src/lib/supabase/**",
        "src/middleware.ts",
        "src/components/ui/**",
      ],
      thresholds: {
        perFile: false,
        "src/app/orat/lib/**": {
          lines: 40,
          branches: 25,
          functions: 75,
          statements: 40,
        },
        "src/app/orat/utils/**": {
          lines: 90,
          branches: 95,
          functions: 75,
          statements: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
