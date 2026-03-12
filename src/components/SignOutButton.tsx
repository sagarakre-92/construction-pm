"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  function handleSignOut() {
    const supabase = createClient();
    supabase.auth.signOut().then(
      () => { window.location.href = "/"; },
      () => { window.location.href = "/"; }
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium"
    >
      Sign out
    </button>
  );
}
