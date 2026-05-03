import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { getCurrentOrganization, getPendingOrganizationInvitePath } from "./actions";

export default async function ORATLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let orgRes: Awaited<ReturnType<typeof getCurrentOrganization>>;
  try {
    orgRes = await getCurrentOrganization();
  } catch {
    redirect("/login");
  }
  if ("error" in orgRes) redirect("/login");
  if (!orgRes.data) {
    const pending = await getPendingOrganizationInvitePath();
    if (!("error" in pending) && pending.data) {
      redirect(pending.data);
    }
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen min-h-0 min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
      {children}
      <Toaster position="bottom-center" richColors />
    </div>
  );
}
