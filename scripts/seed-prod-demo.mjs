// Seed the PRODUCTION Supabase project with demo accounts + a clearly-marked
// demo organization that is safe for showing the app to prospects.
//
// SAFETY NOTES — read before running:
//   1. The org is named "DEMO — ACME Construction (do not edit)" so any real
//      user browsing the app will know not to touch it.
//   2. Passwords are randomly generated each run (24 chars, mixed case + nums).
//      They print to STDOUT exactly once at the end. SAVE THEM IN A PASSWORD
//      MANAGER — they cannot be recovered without re-running this script and
//      issuing new passwords (which would lock out anyone using the old ones).
//   3. This script is idempotent on the org/project/tasks (uses fixed UUIDs +
//      upserts), but generates NEW passwords every run. If accounts already
//      exist, their passwords are reset.
//   4. Uses SUPABASE_SERVICE_ROLE_KEY from the env file — NEVER commit this.
//
// Usage:
//   node --env-file=.env.prod scripts/seed-prod-demo.mjs

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

// ---------- env ----------
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.prod");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes("PASTE_")) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.prod");
  process.exit(1);
}

// ---------- safety: verify role is service_role ----------
try {
  const payload = JSON.parse(
    Buffer.from(SERVICE_ROLE_KEY.split(".")[1], "base64").toString("utf8"),
  );
  if (payload.role !== "service_role") {
    console.error(
      `SUPABASE_SERVICE_ROLE_KEY appears to be the "${payload.role}" key, not service_role.`,
    );
    process.exit(1);
  }
  // Make the user confirm they meant prod, not dev. The dev project ref starts
  // with "kuwib" — anything else is presumed prod and gets a louder header.
  console.log(`\n⚠️  About to seed DEMO data into Supabase project: ${payload.ref}`);
  console.log(`    URL: ${URL}\n`);
  if (!process.env.SEED_PROD_CONFIRM || process.env.SEED_PROD_CONFIRM !== "yes") {
    console.error(
      "Refusing to run without explicit confirmation. Set SEED_PROD_CONFIRM=yes:\n" +
        "  SEED_PROD_CONFIRM=yes node --env-file=.env.prod scripts/seed-prod-demo.mjs",
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
const DEMO_ORG_ID = "deadbeef-1111-4111-8111-111111111111";
const DEMO_PROJECT_ID = "deadbeef-2222-4222-8222-222222222222";

const DEMO_ADMIN_EMAIL = "demo-admin@orat.dev";
const DEMO_INVITEE_EMAIL = "demo-invitee@orat.dev";

// ---------- helpers ----------
function generatePassword() {
  // 24 chars, base64url-ish (a-z A-Z 0-9 _ -). No special chars that need escaping.
  return randomBytes(18).toString("base64url");
}

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
    return { id: created.data.user.id, created: true };
  }
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
  return { id: existing.id, created: false };
}

async function upsert(table, rows, opts) {
  const res = await admin.from(table).upsert(rows, opts);
  if (res.error) throw new Error(`upsert ${table}: ${res.error.message}`);
}

// ---------- run ----------
console.log("→ Seeding demo data\n");

const adminPassword = generatePassword();
const inviteePassword = generatePassword();

console.log("• Ensuring demo users…");
const adminUser = await ensureUser(DEMO_ADMIN_EMAIL, adminPassword, {
  first_name: "Demo",
  last_name: "Admin",
});
const inviteeUser = await ensureUser(DEMO_INVITEE_EMAIL, inviteePassword, {
  first_name: "Demo",
  last_name: "Invitee",
});
console.log(`    admin   = ${adminUser.id} (${adminUser.created ? "new" : "password reset"})`);
console.log(`    invitee = ${inviteeUser.id} (${inviteeUser.created ? "new" : "password reset"})`);

console.log("• Profiles…");
await upsert(
  "profiles",
  [
    {
      id: adminUser.id,
      first_name: "Demo",
      last_name: "Admin",
      role: "Project Manager",
      company: "DEMO — ACME Construction",
    },
    {
      id: inviteeUser.id,
      first_name: "Demo",
      last_name: "Invitee",
      role: "Architect",
      company: "DEMO — Outside Co",
    },
  ],
  { onConflict: "id" },
);

console.log("• Demo organization…");
await upsert(
  "organizations",
  [
    {
      id: DEMO_ORG_ID,
      name: "DEMO — ACME Construction (do not edit)",
      slug: "demo-acme-construction",
    },
  ],
  { onConflict: "id" },
);

console.log("• Org membership (admin only)…");
await upsert(
  "organization_members",
  [{ organization_id: DEMO_ORG_ID, user_id: adminUser.id, role: "owner" }],
  { onConflict: "user_id" },
);

console.log("• Demo project…");
await upsert(
  "orat_projects",
  [
    {
      id: DEMO_PROJECT_ID,
      name: "DEMO — Lakeside Tower",
      description: "DEMO data for prospect/partner walkthroughs. Do not edit or delete.",
      owner_id: adminUser.id,
      organization_id: DEMO_ORG_ID,
      archived: false,
    },
  ],
  { onConflict: "id" },
);

await upsert(
  "orat_project_members",
  [{ project_id: DEMO_PROJECT_ID, user_id: adminUser.id, project_role: "editor" }],
  { onConflict: "project_id,user_id" },
);

console.log("• Tasks (deleting any prior [demo] tasks first so re-runs are clean)…");
{
  const del = await admin
    .from("orat_tasks")
    .delete()
    .eq("project_id", DEMO_PROJECT_ID)
    .like("title", "[demo]%");
  if (del.error) throw new Error(`delete prior demo tasks: ${del.error.message}`);
}

const today = isoDateOffset(0);
const tasks = [
  {
    title: "[demo] Permit submission for floor plans",
    description: "Was due last week — appears in the Overdue swimlane on the Board.",
    status: "In Progress",
    priority: "high",
    company: "City Permitting Office",
    start_date: isoDateOffset(-14),
    original_due_date: isoDateOffset(-5),
    current_due_date: isoDateOffset(-5),
    assigned_to_user_id: adminUser.id,
    sort_order: 1,
  },
  {
    title: "[demo] Site walk with structural engineer",
    description: "Due today.",
    status: "Not Started",
    priority: "medium",
    company: "Atlas Structural",
    start_date: isoDateOffset(-2),
    original_due_date: today,
    current_due_date: today,
    assigned_to_user_id: adminUser.id,
    sort_order: 2,
  },
  {
    title: "[demo] Concrete pour scheduling",
    description: "Due in a few days. Already in progress.",
    status: "In Progress",
    priority: "low",
    company: "Northshore Concrete",
    start_date: isoDateOffset(-1),
    original_due_date: isoDateOffset(3),
    current_due_date: isoDateOffset(3),
    assigned_to_user_id: adminUser.id,
    sort_order: 3,
  },
  {
    title: "[demo] HVAC contractor RFP review",
    description: "Due next week.",
    status: "Not Started",
    priority: "high",
    company: "Mech-Pro HVAC",
    start_date: isoDateOffset(0),
    original_due_date: isoDateOffset(9),
    current_due_date: isoDateOffset(9),
    assigned_to_user_id: adminUser.id,
    sort_order: 4,
  },
  {
    title: "[demo] Final landscaping plan signoff",
    description: "Future task with NO assignee.",
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
    title: "[demo] Foundation inspection (passed)",
    description: "Past due date BUT status=Complete — appears under Complete, not Overdue.",
    status: "Complete",
    priority: "low",
    company: "City Inspections",
    start_date: isoDateOffset(-30),
    original_due_date: isoDateOffset(-7),
    current_due_date: isoDateOffset(-7),
    assigned_to_user_id: adminUser.id,
    sort_order: 6,
  },
].map((t) => ({ ...t, project_id: DEMO_PROJECT_ID, created_date: today, history: [] }));

const ins = await admin.from("orat_tasks").insert(tasks).select("id");
if (ins.error) throw new Error(`insert tasks: ${ins.error.message}`);

console.log(`    inserted ${ins.data.length} tasks`);

console.log("\n" + "=".repeat(72));
console.log("✓ Demo seed complete. SAVE THESE CREDENTIALS NOW (they won't repeat).");
console.log("=".repeat(72));
console.log(`
  Org:     DEMO — ACME Construction (do not edit)
  Project: DEMO — Lakeside Tower

  ┌─ Demo admin (org owner) ────────────────────────────────────────────┐
  │  Email:    ${DEMO_ADMIN_EMAIL.padEnd(60)}│
  │  Password: ${adminPassword.padEnd(60)}│
  └─────────────────────────────────────────────────────────────────────┘

  ┌─ Demo invitee (no org membership — used for invitation demos) ──────┐
  │  Email:    ${DEMO_INVITEE_EMAIL.padEnd(60)}│
  │  Password: ${inviteePassword.padEnd(60)}│
  └─────────────────────────────────────────────────────────────────────┘
`);
console.log("Reminder: paste both into your password manager NOW.");
console.log("Re-running this script generates NEW passwords (locks out the old ones).\n");
