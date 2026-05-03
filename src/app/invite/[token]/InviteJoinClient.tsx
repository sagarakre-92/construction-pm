"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { acceptInvitation } from "@/app/orat/actions";
import type { OrganizationInvitationPreview } from "@/app/orat/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

type Props = {
  token: string;
  preview: OrganizationInvitationPreview | { error: string };
  isAuthenticated: boolean;
  sessionEmail: string | null;
};

export function InviteJoinClient({
  token,
  preview,
  isAuthenticated,
  sessionEmail,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const invitePath = `/invite/${encodeURIComponent(token)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(invitePath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(invitePath)}`;

  const handleAccept = useCallback(() => {
    setAcceptError(null);
    startTransition(async () => {
      const result = await acceptInvitation(token);
      if ("error" in result) {
        setAcceptError(result.error);
        return;
      }
      setOpen(false);
      if (result.data.projectId) {
        router.push(`/orat?project=${result.data.projectId}&welcome=1`);
        return;
      }
      router.push("/orat");
    });
  }, [router, token]);

  if ("error" in preview) {
    const err = preview.error;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-red-600 dark:text-red-400 max-w-md" role="alert">
          {err === "Invitation not found"
            ? "This invitation link is no longer valid."
            : err}
        </p>
        <Button asChild variant="outline">
          <Link href="/orat">Go to app</Link>
        </Button>
        {!isAuthenticated ? (
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const p = preview;
  const invitedNorm = normalizeEmail(p.invitedEmail);
  const sessionNorm = normalizeEmail(sessionEmail);
  const emailMatches = isAuthenticated && sessionNorm !== "" && sessionNorm === invitedNorm;
  const emailMismatch = isAuthenticated && sessionNorm !== "" && sessionNorm !== invitedNorm;
  const missingSessionEmail = isAuthenticated && sessionNorm === "";

  const scopeLabel =
    p.projectId && p.projectName
      ? `the project “${p.projectName}” in ${p.organizationName}`
      : p.organizationName;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Organization invitation
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {p.projectId && p.projectName ? (
            <>
              You have been invited to <strong>{p.projectName}</strong> in{" "}
              <strong>{p.organizationName}</strong>.
            </>
          ) : (
            <>
              You have been invited to join <strong>{p.organizationName}</strong>.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Invitation sent to {p.invitedEmail}
        </p>

        {!isAuthenticated ? (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href={loginHref}>Sign in to continue</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={signupHref}>Create an account</Link>
            </Button>
          </div>
        ) : null}

        {emailMismatch ? (
          <div
            className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            <p>
              This invitation was sent to <strong>{p.invitedEmail}</strong>. You are signed in
              as <strong>{sessionEmail}</strong>.
            </p>
            <p className="mt-2">
              Sign out and sign in with the invited email, or ask an admin to send a new invitation
              to your current address.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={loginHref}>Use a different account</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/orat">Go to app</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {missingSessionEmail ? (
          <p className="mt-6 text-sm text-amber-800 dark:text-amber-200" role="status">
            Your session does not include an email address, so this invitation cannot be verified.
            Try signing out and signing in again, or contact support.
          </p>
        ) : null}

        {emailMatches ? (
          <div className="mt-6 flex flex-col gap-3">
            <Button type="button" onClick={() => setOpen(true)}>
              Review and join
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orat">Not now</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {p.organizationName}?</DialogTitle>
            <DialogDescription>
              {p.projectId && p.projectName
                ? `You will be added to ${scopeLabel} with the access granted by this invitation.`
                : `You will be added to ${p.organizationName} as a ${p.invitedRole}.`}
            </DialogDescription>
          </DialogHeader>
          {acceptError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {acceptError}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAccept} disabled={isPending}>
              {isPending ? "Joining…" : "Accept invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
