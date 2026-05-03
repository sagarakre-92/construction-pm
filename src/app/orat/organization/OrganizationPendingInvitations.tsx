"use client";

import { useCallback, useState } from "react";
import { Mail, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendInvitationEmail, revokeInvitation } from "@/app/orat/actions";

/** Matches `OrgInvitationRow` from org-data (kept local to avoid client imports of server modules). */
export type OrganizationPendingInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  first_name: string;
  last_name: string;
  title: string;
};

type Props = {
  initialInvitations: OrganizationPendingInvitation[];
};

export function OrganizationPendingInvitations({ initialInvitations }: Props) {
  const [rows, setRows] = useState(initialInvitations);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleResend = useCallback(async (inv: OrganizationPendingInvitation) => {
    setBusyId(inv.id);
    try {
      const res = await resendInvitationEmail(inv.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invitation re-sent to ${inv.email}`);
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleRevoke = useCallback(async (inv: OrganizationPendingInvitation) => {
    const ok = window.confirm(
      `Revoke the invitation for ${inv.email}? The link will stop working.`,
    );
    if (!ok) return;
    setBusyId(inv.id);
    try {
      const res = await revokeInvitation(inv.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invitation for ${inv.email} revoked`);
      setRows((prev) => prev.filter((p) => p.id !== inv.id));
    } finally {
      setBusyId(null);
    }
  }, []);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">No pending invitations.</p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
      {rows.map((inv) => {
        const busy = busyId === inv.id;
        const display =
          [inv.first_name, inv.last_name].filter(Boolean).join(" ").trim() || inv.email;
        return (
          <li
            key={inv.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium text-slate-900 dark:text-white">{display}</span>
              {inv.email && (inv.first_name || inv.last_name) ? (
                <span className="ml-1 text-slate-500 dark:text-slate-400">({inv.email})</span>
              ) : null}
              {inv.title ? (
                <span className="ml-1 text-slate-500 dark:text-slate-400">· {inv.title}</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {inv.role}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={busy}
                onClick={() => handleResend(inv)}
                aria-label={`Re-send invitation to ${inv.email}`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={busy}
                onClick={() => handleRevoke(inv)}
                aria-label={`Revoke invitation for ${inv.email}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
