import { createClient } from "@/lib/supabase/server";
import { previewOrganizationInvitation } from "@/app/orat/actions";
import { InviteJoinClient } from "./InviteJoinClient";

type Props = { params: Promise<{ token: string }> };

export default async function InviteAcceptPage({ params }: Props) {
  const { token } = await params;
  if (!token?.trim()) {
    return (
      <InviteJoinClient
        token=""
        preview={{ error: "Invalid invitation link" }}
        isAuthenticated={false}
        sessionEmail={null}
      />
    );
  }

  const trimmed = token.trim();

  try {
    const previewRes = await previewOrganizationInvitation(trimmed);
    const preview =
      "error" in previewRes ? { error: previewRes.error } : previewRes.data;

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return (
      <InviteJoinClient
        token={trimmed}
        preview={preview}
        isAuthenticated={Boolean(session?.user)}
        sessionEmail={session?.user?.email ?? null}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const missingEnv =
      message.includes("Missing Supabase env") || message.includes("Supabase env vars");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          {missingEnv ? "Supabase is not configured" : "Could not load this page"}
        </h1>
        {missingEnv ? (
          <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
            Add <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code> (see{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local.example</code>
            ), then restart <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run dev</code>.
          </p>
        ) : (
          <p className="max-w-md text-sm text-red-600 dark:text-red-400" role="alert">
            {process.env.NODE_ENV === "development" ? message : "Check the server terminal for details."}
          </p>
        )}
      </div>
    );
  }
}
