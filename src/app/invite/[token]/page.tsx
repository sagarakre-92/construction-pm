import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation } from "@/app/orat/actions";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ token: string }> };

export default async function InviteAcceptPage({ params }: Props) {
  const { token } = await params;
  if (!token?.trim()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-600 dark:text-red-400">Invalid invitation link.</p>
        <Button asChild variant="outline">
          <Link href="/orat">Go to app</Link>
        </Button>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const result = await acceptInvitation(token);

  if ("error" in result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-red-600 dark:text-red-400">{result.error}</p>
        <Button asChild variant="outline">
          <Link href="/orat">Go to app</Link>
        </Button>
      </div>
    );
  }

  redirect("/orat");
}
