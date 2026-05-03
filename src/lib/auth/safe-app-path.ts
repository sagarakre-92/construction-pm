/**
 * Validates a post-auth in-app path (e.g. `next` / `redirect` query values).
 * Rejects protocol-relative URLs and other values that must not be used as redirects.
 */
export function safeAppInternalPath(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("\0")) return null;
  return t;
}
