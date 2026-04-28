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
import { inviteToProject } from "@/app/orat/actions";

type Props = {
  projectId: string;
  projectName: string;
  onInvited?: () => void;
};

type ProjectRole = "editor" | "viewer";

export function ProjectInviteForm({ projectId, projectName, onInvited }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<ProjectRole>("editor");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter an email address");
      return;
    }
    setLoading(true);
    try {
      const result = await inviteToProject(
        projectId,
        email.trim(),
        firstName.trim(),
        lastName.trim(),
        title.trim(),
        role,
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Invitation sent for ${projectName}`);
      setFirstName("");
      setLastName("");
      setEmail("");
      setTitle("");
      setRole("editor");
      onInvited?.();
      router.refresh();

      const link = result.data.inviteLink;
      const fullLink = link.startsWith("http")
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
      aria-label={`Invite to ${projectName}`}
    >
      <div className="grid w-full min-w-[120px] flex-1 gap-1.5 md:min-w-0">
        <Label htmlFor="project-invite-first-name">First name</Label>
        <Input
          id="project-invite-first-name"
          type="text"
          placeholder="Jane"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <div className="grid w-full min-w-[120px] flex-1 gap-1.5 md:min-w-0">
        <Label htmlFor="project-invite-last-name">Last name</Label>
        <Input
          id="project-invite-last-name"
          type="text"
          placeholder="Smith"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <div className="grid w-full min-w-[160px] flex-1 gap-1.5 md:min-w-0 md:flex-[1.25]">
        <Label htmlFor="project-invite-email">Email</Label>
        <Input
          id="project-invite-email"
          type="email"
          placeholder="collaborator@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <div className="grid w-full min-w-[120px] flex-1 gap-1.5 md:min-w-0">
        <Label htmlFor="project-invite-title">Title</Label>
        <Input
          id="project-invite-title"
          type="text"
          placeholder="e.g. Subcontractor"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="bg-white dark:bg-slate-800"
        />
      </div>
      <div className="grid w-full min-w-[120px] gap-1.5 md:w-[140px]">
        <Label htmlFor="project-invite-role">Role</Label>
        <Select
          value={role}
          onValueChange={(v) => setRole(v as ProjectRole)}
          disabled={loading}
        >
          <SelectTrigger id="project-invite-role" aria-label="Project role">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="shrink-0">
        {loading ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}
