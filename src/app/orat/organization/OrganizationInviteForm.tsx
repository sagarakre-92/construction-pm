"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvitation } from "@/app/orat/actions";

type Props = { organizationId: string };

export function OrganizationInviteForm({ organizationId }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter an email address");
      return;
    }
    setLoading(true);
    try {
      const result = await createInvitation(organizationId, email.trim());
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const sentTo = email.trim();
      const { inviteLink, emailDelivered } = result.data;
      if (emailDelivered) {
        toast.success(`Invitation emailed to ${sentTo}`);
      } else {
        toast.success(`Invitation created for ${sentTo}`);
      }
      setEmail("");
      router.refresh();
      const fullLink =
        inviteLink.startsWith("http")
          ? inviteLink
          : `${typeof window !== "undefined" ? window.location.origin : ""}${inviteLink}`;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(fullLink);
          if (emailDelivered) {
            toast.info("Invite link also copied to clipboard.");
          } else {
            toast.info(
              "Invite link copied—share it manually; inbox email needs RESEND_API_KEY on the server.",
            );
          }
        } catch {
          if (!emailDelivered) {
            toast.warning(
              "Could not copy the link. Configure RESEND_API_KEY for email delivery, or copy the link from server logs.",
            );
          }
        }
      } else if (!emailDelivered) {
        toast.info(
          "Inbox email is not configured (RESEND_API_KEY). Share the invite link from server logs or your hosting dashboard.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 md:flex-nowrap"
    >
      <div className="grid w-full min-w-[200px] flex-1 gap-1.5 md:min-w-0 md:flex-[1.5]">
        <Label htmlFor="org-invite-email">Email</Label>
        <Input
          id="org-invite-email"
          type="email"
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="bg-white dark:bg-slate-800"
          autoComplete="off"
        />
      </div>
      <Button type="submit" disabled={loading} className="shrink-0">
        {loading ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}
