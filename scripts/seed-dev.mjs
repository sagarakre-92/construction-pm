// Seed the dev Supabase project with everything needed to walk through the
// P0 testing checklist (docs/P0_TESTING_CHECKLIST.md).
//
// Usage:
//   node --env-file=.env.local scripts/seed-dev.mjs
//
// What it creates (idempotent — safe to re-run):
//   * 2 users:
//       admin@orat.dev      / orat-dev-admin-1234     (org owner)
//       invitee@orat.dev    / orat-dev-invitee-1234   (separate user, used to
//                                                       accept invitations)
//   * 1 organization:    "ACME Construction" (slug: acme-construction)
//   * 1 project:         "Lakeside Tower"
//   * 6 tasks across status / priority / due-date buckets so every P0 story has
//     visible test data on first load:
//       T1  Overdue · status=In Progress · priority=High   (proves Overdue swimlane)
//       T2  Due today · status=Not Started · priority=Medium
//       T3  Due this week (+3d) · status=In Progress · priority=Low
//       T4  Due next week (+9d) · status=Not Started · priority=High
//       T5  Future (+20d) · unassigned · priority=Medium
//       T6  Past due · status=Complete · priority=Low      (must NOT show as Overdue)
//
// Uses the service-role key, so RLS is bypassed during seed (intended).
// All other queries in the app go through the anon key + RLS as normal.

import { createClient } from "@supabase/supabase-js";

// ---------- env ----------
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes("PASTE_")) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "Grab it from Project Settings → API (click Reveal next to service_role)\n" +
      "and paste it onto the SUPABASE_SERVICE_ROLE_KEY= line in .env.local.",
  );
  process.exit(1);
}

// Sanity: verify the key is actually service_role, not anon, before we try to
// hit the auth admin API (which silently 403s with the anon key).
try {
  const payload = JSON.parse(
    Buffer.from(SERVICE_ROLE_KEY.split(".")[1], "base64").toString("utf8"),
  );
  if (payload.role !== "service_role") {
    console.error(
      `SUPABASE_SERVICE_ROLE_KEY appears to be the "${payload.role}" key, not service_role.\n` +
        "Re-copy the service_role key from Project Settings → API.",
    );
    process.exit(1);
  }
} catch (e) {
  console.error("SUPABASE_SERVICE_ROLE_KEY does not look like a JWT:", e.message);
  process.exit(1);
}

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- constants ----------
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";

const ADMIN_EMAIL = "admin@orat.dev";
const ADMIN_PASSWORD = "orat-dev-admin-1234";
const INVITEE_EMAIL = "invitee@orat.dev";
const INVITEE_PASSWORD = "orat-dev-invitee-1234";

// ---------- helpers ----------
function isoDateOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function ensureUser(email, password, profile) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: profile,
  });
  if (created.data?.user?.id) {
    return created.data.user.id;
  }
  // Already exists — find by listing and reset the password to the known value.
  const list = await admin.auth.admin.listUsers();
  if (list.error) throw new Error(`listUsers: ${list.error.message}`);
  const existing = list.data?.users.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (!existing) {
    throw new Error(
      `Could not create or find ${email}: ${created.error?.message ?? "unknown error"}`,
    );
  }
  const upd = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (upd.error) throw new Error(`updateUserById ${email}: ${upd.error.message}`);
  return existing.id;
}

async function upsert(table, rows, opts) {
  const res = await admin.from(table).upsert(rows, opts);
  if (res.error) throw new Error(`upsert ${table}: ${res.error.message}`);
}

// ---------- run ----------
console.log(`→ Seeding ${URL}\n`);

console.log("• Ensuring users…");
const adminUserId = await ensureUser(ADMIN_EMAIL, ADMIN_PASSWORD, {
  first_name: "Ada",
  last_name: "Owner",
});
const inviteeUserId = await ensureUser(INVITEE_EMAIL, INVITEE_PASSWORD, {
  first_name: "Ivy",
  last_name: "Invitee",
});
console.log(`    admin   = ${adminUserId}`);
console.log(`    invitee = ${inviteeUserId}`);

console.log("• Profiles…");
await upsert(
  "profiles",
  [
    {
      id: adminUserId,
      first_name: "Ada",
      last_name: "Owner",
      role: "Project Manager",
      company: "ACME Construction",
    },
    {
      id: inviteeUserId,
      first_name: "Ivy",
      last_name: "Invitee",
      role: "Architect",
      company: "Outside Co",
    },
  ],
  { onConflict: "id" },
);

console.log("• Organization…");
await upsert(
  "organizations",
  [{ id: ORG_ID, name: "ACME Construction", slug: "acme-construction" }],
  { onConflict: "id" },
);

console.log("• Org membership (admin only — invitee is unattached, so you can");
console.log("  invite them through the UI as part of the P0 testing flow)…");
await upsert(
  "organization_members",
  [{ organization_id: ORG_ID, user_id: adminUserId, role: "owner" }],
  { onConflict: "user_id" },
);

console.log("• Project…");
await upsert(
  "orat_projects",
  [
    {
      id: PROJECT_ID,
      name: "Lakeside Tower",
      description: "42-story mixed-use tower on the lakefront. Seed data for P0 testing.",
      owner_id: adminUserId,
      organization_id: ORG_ID,
      archived: false,
    },
  ],
  { onConflict: "id" },
);

await upsert(
  "orat_project_members",
  [{ project_id: PROJECT_ID, user_id: adminUserId, project_role: "editor" }],
  { onConflict: "project_id,user_id" },
);

console.log("• Tasks (deleting any prior seeded tasks first so re-runs are clean)…");
{
  const del = await admin
    .from("orat_tasks")
    .delete()
    .eq("project_id", PROJECT_ID)
    .like("title", "[seed]%");
  if (del.error) throw new Error(`delete prior seed tasks: ${del.error.message}`);
}

const today = isoDateOffset(0);
const tasks = [
  {
    title: "[seed] T1 · Permit submission for floor plans",
    description: "Was due last week — should appear in the Overdue swimlane on the Board.",
    status: "In Progress",
    priority: "high",
    company: "City Permitting Office",
    start_date: isoDateOffset(-14),
    original_due_date: isoDateOffset(-5),
    current_due_date: isoDateOffset(-5),
    assigned_to_user_id: adminUserId,
    sort_order: 1,
  },
  {
    title: "[seed] T2 · Site walk with structural engineer",
    description: "Due today.",
    status: "Not Started",
    priority: "medium",
    company: "Atlas Structural",
    start_date: isoDateOffset(-2),
    original_due_date: today,
    current_due_date: today,
    assigned_to_user_id: adminUserId,
    sort_order: 2,
  },
  {
    title: "[seed] T3 · Concrete pour scheduling",
    description: "Due in a few days. Already in progress.",
    status: "In Progress",
    priority: "low",
    company: "Northshore Concrete",
    start_date: isoDateOffset(-1),
    original_due_date: isoDateOffset(3),
    current_due_date: isoDateOffset(3),
    assigned_to_user_id: adminUserId,
    sort_order: 3,
  },
  {
    title: "[seed] T4 · HVAC contractor RFP review",
    description: "Due next week. Will fall under the 'This week' / 'Next week' bucket once date math kicks in.",
    status: "Not Started",
    priority: "high",
    company: "Mech-Pro HVAC",
    start_date: isoDateOffset(0),
    original_due_date: isoDateOffset(9),
    current_due_date: isoDateOffset(9),
    assigned_to_user_id: adminUserId,
    sort_order: 4,
  },
  {
    title: "[seed] T5 · Final landscaping plan signoff",
    description: "Future task with NO assignee — used to verify the 'Unassigned' group in List view.",
    status: "Not Started",
    priority: "medium",
    company: "Greenline Landscape",
    start_date: isoDateOffset(15),
    original_due_date: isoDateOffset(20),
    current_due_date: isoDateOffset(20),
    assigned_to_user_id: null,
    sort_order: 5,
  },
  {
    title: "[seed] T6 · Foundation inspection (passed)",
    description: "Past due date BUT status=Complete — should appear under Complete, NOT Overdue.",
    status: "Complete",
    priority: "low",
    company: "City Inspections",
    start_date: isoDateOffset(-30),
    original_due_date: isoDateOffset(-7),
    current_due_date: isoDateOffset(-7),
    assigned_to_user_id: adminUserId,
    sort_order: 6,
  },
].map((t) => ({
  ...t,
  project_id: PROJECT_ID,
  created_date: today,
  history: [],
}));

const ins = await admin.from("orat_tasks").insert(tasks).select("id, title");
if (ins.error) throw new Error(`insert tasks: ${ins.error.message}`);

console.log(`    inserted ${ins.data.length} tasks`);

console.log("\n✓ Seed complete.\n");
console.log("Sign in at http://localhost:3000/login as either:");
console.log(`    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}    (admin/owner of ACME Construction)`);
console.log(`    ${INVITEE_EMAIL} / ${INVITEE_PASSWORD}  (separate user — invite them through the UI)`);
