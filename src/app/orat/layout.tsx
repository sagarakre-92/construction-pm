import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { getCurrentOrganization } from "./actions";

export default async function ORATLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) redirect("/login");
  if (!orgRes.data) redirect("/onboarding");

  return (
    <div className="flex h-screen min-h-0 min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
      {children}
      <Toaster position="bottom-center" richColors />
    </div>
  );
}
