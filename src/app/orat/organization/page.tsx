import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getCurrentOrganization,
  getCurrentUserOrgRole,
  getOrganizationMembersAndInvitations,
} from "@/app/orat/actions";
import { Button } from "@/components/ui/button";
import { OrganizationInviteForm } from "./OrganizationInviteForm";
import { OrganizationPendingInvitations } from "./OrganizationPendingInvitations";

export default async function OrganizationPage() {
  const [orgRes, role] = await Promise.all([
    getCurrentOrganization(),
    getCurrentUserOrgRole(),
  ]);

  if ("error" in orgRes || !orgRes.data) {
    redirect("/orat");
  }

  const org = orgRes.data;
  const canManage = role === "owner" || role === "admin";

  if (!canManage) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orat">← Back</Link>
          </Button>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Only organization owners and admins can manage members and invitations.
        </p>
      </div>
    );
  }

  const membersInvitesRes = await getOrganizationMembersAndInvitations(org.id);
  const members = "data" in membersInvitesRes ? membersInvitesRes.data.members : [];
  const pendingInvitations =
    "data" in membersInvitesRes ? membersInvitesRes.data.pendingInvitations : [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orat">← Back</Link>
          </Button>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Organization: {org.name}
          </h1>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Invite teammates
        </h2>
        <OrganizationInviteForm organizationId={org.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Pending invitations
        </h2>
        <OrganizationPendingInvitations initialInvitations={pendingInvitations} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Members
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No members yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="text-slate-900 dark:text-white">
                  {m.first_name || m.last_name
                    ? [m.first_name, m.last_name].filter(Boolean).join(" ").trim()
                    : m.user_id.slice(0, 8) + "…"}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
