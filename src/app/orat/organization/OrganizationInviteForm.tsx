"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvitation } from "@/app/orat/actions";

type Props = { organizationId: string };

export function OrganizationInviteForm({ organizationId }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter an email address");
      return;
    }
    setLoading(true);
    try {
      const result = await createInvitation(organizationId, email.trim(), role);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation created");
      setEmail("");
      router.refresh();
      const link = result.data.inviteLink;
      const fullLink =
        link.startsWith("http")
          ? link
          : `${typeof window !== "undefined" ? window.location.origin : ""}${link}`;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullLink);
        toast.info("Invite link copied to clipboard. Send it to the invitee (email not sent yet).");
      } else {
        toast.info("Invite link: " + fullLink);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="grid w-full min-w-[200px] max-w-xs gap-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <div className="grid w-full min-w-[120px] max-w-[180px] gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <Select
          value={role}
          onValueChange={(v) => setRole(v as "admin" | "member")}
          disabled={loading}
        >
          <SelectTrigger id="invite-role" className="bg-white dark:bg-slate-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}
