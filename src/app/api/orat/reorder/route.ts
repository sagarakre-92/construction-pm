import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureTaskInCurrentOrg } from "@/app/orat/lib/org-data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updates = body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    for (const u of updates) {
      const taskId = u?.taskId ?? u?.task_id;
      const sortOrder = Number(u?.sortOrder ?? u?.sort_order ?? 0);
      if (!taskId) continue;

      const access = await ensureTaskInCurrentOrg(taskId);
      if (access && typeof access === "object" && "error" in access) {
        const err = (access as { error: unknown }).error;
        const msg = typeof err === "string" ? err : "Access denied";
        return NextResponse.json({ error: msg }, { status: 403 });
      }

      const { error } = await supabase
        .from("orat_tasks")
        .update({ sort_order: sortOrder })
        .eq("id", taskId);

      if (error) {
        return NextResponse.json(
          { error: error.message || "Update failed" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ data: null }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg || "Failed to save order" },
      { status: 500 }
    );
  }
}
