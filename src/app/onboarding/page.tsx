import { redirect } from "next/navigation";
import { getCurrentOrganization } from "@/app/orat/actions";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const orgRes = await getCurrentOrganization();
  if ("error" in orgRes) redirect("/login");
  if (orgRes.data) redirect("/orat");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <OnboardingForm />
    </div>
  );
}
