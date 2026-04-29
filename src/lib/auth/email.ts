/**
 * Email normalization for auth flows.
 *
 * Sign-up and log-in must treat addresses case-insensitively and tolerate
 * stray whitespace so that "Foo@Example.com " and "foo@example.com" land on
 * the same Supabase user. Keep this pure and dependency-free — it runs on
 * both client and server.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
