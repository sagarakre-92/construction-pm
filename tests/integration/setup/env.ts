/**
 * Read Supabase env vars with fallback names.
 *
 * `supabase status -o env` historically printed bare names (`API_URL`,
 * `ANON_KEY`, `SERVICE_ROLE_KEY`); CI may renormalize them to `SUPABASE_*`
 * via override flags. We accept either, plus the `NEXT_PUBLIC_*` form for
 * convenience when running locally with the same vars Next.js uses.
 */

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export function getSupabaseUrl(): string {
  return (
    readEnv("SUPABASE_URL", "API_URL", "NEXT_PUBLIC_SUPABASE_URL") ??
    "http://127.0.0.1:54321"
  );
}

export function getServiceRoleKey(): string {
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY");
  if (!key) {
    throw new Error(
      "Integration tests require SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY). " +
        "Run `supabase start` then export keys via `supabase status -o env`.",
    );
  }
  return key;
}

export function getAnonKey(): string {
  const key = readEnv(
    "SUPABASE_ANON_KEY",
    "ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  if (!key) {
    throw new Error(
      "Integration tests require SUPABASE_ANON_KEY (or ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY). " +
        "Run `supabase start` then export keys via `supabase status -o env`.",
    );
  }
  return key;
}
