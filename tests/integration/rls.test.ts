/**
 * RLS gate — integration tier.
 *
 * Boots against a real Postgres + Supabase Auth from `supabase start`. Each
 * test signs in as a real user (anon key + password), then either:
 *   1. exercises the production data layer (`@/app/orat/lib/org-data`,
 *      `@/app/orat/actions`) — the `@/lib/supabase/server` import is swapped
 *      for a tiny shim that hands back the user's authenticated client, OR
 *   2. issues a raw `from(...)` query so RLS is the only thing standing
 *      between USER_B and ORG_A's data.
 *
 * AGENTS.md says "RLS is the source of truth for security." This file is
 * the only place in the suite that actually proves that.
 */

import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => import("./setup/server-mock"));

import {
  ORG_A_ID,
  ORG_B_ID,
  PROJECT_A_ID,
  TASK_A_ID,
  USER_A_EMAIL,
  USER_B_EMAIL,
  USER_PASSWORD,
  seedRlsFixtures,
} from "./setup/seed";
import {
  type AuthenticatedClient,
  createUserClient,
} from "./setup/clients";
import {
  clearActiveClient,
  setActiveClient,
} from "./setup/server-mock";

import { getProjectsForOrganization } from "@/app/orat/lib/org-data";
import { createTask } from "@/app/orat/actions";

let userA: AuthenticatedClient;
let userB: AuthenticatedClient;

beforeAll(async () => {
  await seedRlsFixtures();
  userA = await createUserClient(USER_A_EMAIL, USER_PASSWORD);
  userB = await createUserClient(USER_B_EMAIL, USER_PASSWORD);
});

afterAll(() => {
  clearActiveClient();
});

describe("RLS gate (real Postgres + Supabase Auth)", () => {
  test("USER_A in ORG_A sees own org's projects via getProjectsForOrganization", async () => {
    setActiveClient(userA.client);

    const result = await getProjectsForOrganization(ORG_A_ID);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.length).toBeGreaterThan(0);
    for (const project of result.data) {
      expect(project.organizationId).toBe(ORG_A_ID);
    }
    expect(result.data.some((p) => p.id === PROJECT_A_ID)).toBe(true);
  });

  test("USER_B sees ZERO ORG_A projects when calling getProjectsForOrganization(ORG_A)", async () => {
    setActiveClient(userB.client);

    const result = await getProjectsForOrganization(ORG_A_ID);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data).toEqual([]);
  });

  test("USER_B cannot create a task in ORG_A's project", async () => {
    setActiveClient(userB.client);

    const today = new Date().toISOString().slice(0, 10);
    const result = await createTask(PROJECT_A_ID, {
      title: "B should not be able to create this",
      assignedTo: "",
      company: "",
      createdDate: today,
      startDate: today,
      originalDueDate: today,
      currentDueDate: today,
      status: "Not Started",
      sortOrder: 0,
      history: [],
    });

    expect("error" in result).toBe(true);
  });

  test("USER_B cannot read ORG_A's tasks via direct supabase.from query", async () => {
    const { data, error } = await userB.client
      .from("orat_tasks")
      .select("id, organization_id")
      .eq("organization_id", ORG_A_ID);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test("USER_B cannot read ORG_A's projects via direct supabase.from query", async () => {
    const { data, error } = await userB.client
      .from("orat_projects")
      .select("id")
      .eq("id", PROJECT_A_ID);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test("USER_B cannot insert a task into ORG_A's project via raw query", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await userB.client
      .from("orat_tasks")
      .insert({
        project_id: PROJECT_A_ID,
        title: "raw insert from B",
        company: "",
        created_date: today,
        start_date: today,
        original_due_date: today,
        current_due_date: today,
        status: "Not Started",
        sort_order: 0,
        history: [],
      })
      .select()
      .single();

    expect(error).not.toBeNull();
  });

  test("USER_A can read their own seeded task via direct supabase.from query (sanity check)", async () => {
    const { data, error } = await userA.client
      .from("orat_tasks")
      .select("id, organization_id")
      .eq("id", TASK_A_ID)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.organization_id).toBe(ORG_A_ID);
  });

  test("USER_A cannot read ORG_B (different org) — sanity that the gate is symmetric", async () => {
    const { data, error } = await userA.client
      .from("organizations")
      .select("id")
      .eq("id", ORG_B_ID);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});
