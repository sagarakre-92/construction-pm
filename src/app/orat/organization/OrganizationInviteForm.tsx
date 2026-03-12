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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter an email address");
      return;
    }
    setLoading(true);
    try {
      const result = await createInvitation(
        organizationId,
        email.trim(),
        firstName.trim(),
        lastName.trim(),
        title.trim()
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation created");
      setFirstName("");
      setLastName("");
      setEmail("");
      setTitle("");
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 md:flex-nowrap"
    >
      <div className="grid w-full min-w-[120px] flex-1 gap-1.5 md:min-w-0">
        <Label htmlFor="invite-first-name">First name</Label>
        <Input
          id="invite-first-name"
          type="text"
          placeholder="Jane"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <div className="grid w-full min-w-[120px] flex-1 gap-1.5 md:min-w-0">
        <Label htmlFor="invite-last-name">Last name</Label>
        <Input
          id="invite-last-name"
          type="text"
          placeholder="Smith"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <div className="grid w-full min-w-[140px] flex-1 gap-1.5 md:min-w-0 md:flex-[1.25]">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <div className="grid w-full min-w-[120px] flex-1 gap-1.5 md:min-w-0">
        <Label htmlFor="invite-title">Title</Label>
        <Input
          id="invite-title"
          type="text"
          placeholder="e.g. Project Manager"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <Button type="submit" disabled={loading} className="shrink-0">
        {loading ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}
