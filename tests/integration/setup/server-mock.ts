import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Drop-in replacement for `@/lib/supabase/server` used by integration tests.
 *
 * Production's `createClient` reads cookies via `next/headers` and returns a
 * `@supabase/ssr` server client tied to the current request. We can't run
 * that outside a Next request, so the integration suite installs this module
 * via `vi.mock("@/lib/supabase/server", () => import("./setup/server-mock"))`
 * and swaps the active client per test using `setActiveClient(...)`.
 *
 * The "active client" is just a real `@supabase/supabase-js` client signed in
 * as the user under test, so production code paths exercise the same RLS
 * surface they would in a live request.
 */

let activeClient: SupabaseClient | null = null;

export function setActiveClient(client: SupabaseClient): void {
  activeClient = client;
}

export function clearActiveClient(): void {
  activeClient = null;
}

export async function createClient(): Promise<SupabaseClient> {
  if (!activeClient) {
    throw new Error(
      "[integration] No active Supabase client. Call setActiveClient(...) " +
        "before invoking production code that imports `@/lib/supabase/server`.",
    );
  }
  return activeClient;
}
