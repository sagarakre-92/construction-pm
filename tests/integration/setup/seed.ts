import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "./clients";

/**
 * Stable IDs so the suite is idempotent: re-running against the same local
 * Supabase stack upserts the same rows instead of accumulating fixtures.
 */
export const ORG_A_ID = "11111111-1111-1111-1111-aaaaaaaaaaaa";
export const ORG_B_ID = "22222222-2222-2222-2222-bbbbbbbbbbbb";
export const PROJECT_A_ID = "33333333-3333-3333-3333-cccccccccccc";
export const TASK_A_ID = "44444444-4444-4444-4444-dddddddddddd";

export const USER_A_EMAIL = "rls-user-a@example.test";
export const USER_B_EMAIL = "rls-user-b@example.test";
/** > 8 chars to satisfy the auth.minimum_password_length default. */
export const USER_PASSWORD = "rls-test-password-1234";

export type SeedResult = {
  userAId: string;
  userBId: string;
};

async function ensureUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.data?.user?.id) return created.data.user.id;

  // Probably already exists from a previous run — look it up and reset the
  // password so subsequent sign-ins use the well-known value.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    throw new Error(`listUsers failed for ${email}: ${listErr.message}`);
  }
  const existing = list?.users.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (!existing) {
    throw new Error(
      `Could not create or find user ${email}: ${created.error?.message ?? "unknown error"}`,
    );
  }
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    existing.id,
    { password },
  );
  if (updateErr) {
    throw new Error(`Could not reset password for ${email}: ${updateErr.message}`);
  }
  return existing.id;
}

/**
 * Idempotent seed: two orgs, two users (each in their own org), one project +
 * one task in ORG_A. Run with the service-role client so RLS doesn't get in
 * the way of fixture setup. The trigger on `orat_tasks` syncs the task's
 * organization_id from its parent project, so we don't set it explicitly.
 */
export async function seedRlsFixtures(): Promise<SeedResult> {
  const admin = createServiceRoleClient();

  const orgRes = await admin
    .from("organizations")
    .upsert(
      [
        { id: ORG_A_ID, name: "RLS Test Org A", slug: "rls-test-org-a" },
        { id: ORG_B_ID, name: "RLS Test Org B", slug: "rls-test-org-b" },
      ],
      { onConflict: "id" },
    );
  if (orgRes.error) {
    throw new Error(`seed organizations: ${orgRes.error.message}`);
  }

  const userAId = await ensureUser(admin, USER_A_EMAIL, USER_PASSWORD);
  const userBId = await ensureUser(admin, USER_B_EMAIL, USER_PASSWORD);

  // organization_members has UNIQUE(user_id) — one org per user. Upsert by
  // user_id so re-runs don't fail and so a user that drifted to a different
  // org during a prior run gets snapped back to the seeded org.
  const memberRes = await admin
    .from("organization_members")
    .upsert(
      [
        { organization_id: ORG_A_ID, user_id: userAId, role: "owner" },
        { organization_id: ORG_B_ID, user_id: userBId, role: "owner" },
      ],
      { onConflict: "user_id" },
    );
  if (memberRes.error) {
    throw new Error(`seed organization_members: ${memberRes.error.message}`);
  }

  const projectRes = await admin
    .from("orat_projects")
    .upsert(
      {
        id: PROJECT_A_ID,
        name: "RLS Test Project (Org A)",
        description: "Used by tests/integration/rls.test.ts.",
        owner_id: userAId,
        organization_id: ORG_A_ID,
        archived: false,
      },
      { onConflict: "id" },
    );
  if (projectRes.error) {
    throw new Error(`seed orat_projects: ${projectRes.error.message}`);
  }

  const pmRes = await admin
    .from("orat_project_members")
    .upsert(
      [{ project_id: PROJECT_A_ID, user_id: userAId }],
      { onConflict: "project_id,user_id" },
    );
  if (pmRes.error) {
    throw new Error(`seed orat_project_members: ${pmRes.error.message}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const taskRes = await admin
    .from("orat_tasks")
    .upsert(
      {
        id: TASK_A_ID,
        project_id: PROJECT_A_ID,
        title: "RLS Test Task (Org A)",
        company: "Acme",
        created_date: today,
        start_date: today,
        original_due_date: today,
        current_due_date: today,
        status: "Not Started",
        sort_order: 0,
        history: [],
      },
      { onConflict: "id" },
    );
  if (taskRes.error) {
    throw new Error(`seed orat_tasks: ${taskRes.error.message}`);
  }

  return { userAId, userBId };
}
