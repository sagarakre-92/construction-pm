/**
 * Tests for organization-aware data layer (org-data).
 *
 * Mocks Supabase via a tiny Proxy-based fake (`createSupabaseFake`) so chain
 * depth doesn't matter — `.eq().eq().order().order().single()` works at any
 * length. Each call is recorded so tests can assert on captured filters
 * without hand-rolling per-test stubs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProjectsForOrganization,
  getTasksForProject,
  createProjectForOrganization,
  ensureProjectInCurrentOrg,
  ensureTaskInCurrentOrg,
} from "./org-data";
import {
  updateProject,
  updateTask,
  updateTaskStatus,
  deleteTask,
  reorderTasks,
} from "../actions";
import type { Project, Task } from "../types";
import {
  createSupabaseFake,
  type SupabaseFake,
  type SupabaseFakeOptions,
  type ChainCall,
} from "./__mocks__/supabase-fake";

const ORG_A = "org-a-uuid";
const ORG_B = "org-b-uuid";
const PROJECT_ID = "project-1-uuid";
const TASK_ID = "task-1-uuid";
const USER_ID = "user-1-uuid";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

async function installFake(opts: SupabaseFakeOptions = {}): Promise<SupabaseFake> {
  const fake = createSupabaseFake({
    session: { user: { id: USER_ID } },
    ...opts,
  });
  const { createClient } = await import("@/lib/supabase/server");
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fake);
  return fake;
}

function eqArg(fake: SupabaseFake, key: string): unknown {
  return fake.calls.eq?.find((c) => c.args[0] === key)?.args[1];
}

/** Get the most recent payload passed to `.update(...)` against a given table. */
function lastUpdatePayload(
  fake: SupabaseFake,
  table: string,
): Record<string, unknown> | undefined {
  const calls = (fake.calls.update ?? []).filter(
    (c: ChainCall) => c.table === table,
  );
  const last = calls[calls.length - 1];
  return last?.args[0] as Record<string, unknown> | undefined;
}

/** All payloads passed to `.insert(...)` against a given table, in call order. */
function insertPayloads(fake: SupabaseFake, table: string): unknown[] {
  return (fake.calls.insert ?? [])
    .filter((c: ChainCall) => c.table === table)
    .map((c: ChainCall) => c.args[0]);
}

/** Count of `.delete()` calls against a given table. */
function deleteCount(fake: SupabaseFake, table: string): number {
  return (fake.calls.delete ?? []).filter(
    (c: ChainCall) => c.table === table,
  ).length;
}

/**
 * Standard project shape for happy-path mutation tests. Pass `overrides` to
 * tweak fields that the test cares about (e.g. internalTeamMembers).
 */
function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    name: "Updated Name",
    description: "Updated description",
    createdDate: "2025-01-01",
    archived: false,
    organizationId: ORG_A,
    internalTeamMembers: [],
    externalStakeholders: [],
    tasks: [],
    ...overrides,
  };
}

/** Standard task shape for happy-path task mutation tests. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK_ID,
    title: "Updated Task Title",
    description: "Updated description",
    assignedTo: USER_ID,
    company: "Acme Co",
    createdDate: "2025-01-01",
    startDate: "2025-01-02",
    originalDueDate: "2025-01-10",
    currentDueDate: "2025-01-12",
    status: "In Progress",
    sortOrder: 3,
    meetingReference: undefined,
    projectId: PROJECT_ID,
    organizationId: ORG_A,
    history: [],
    ...overrides,
  };
}

describe("org-data: organization-aware foundations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("project queries are organization-scoped", () => {
    it("getProjectsForOrganization filters by organization_id", async () => {
      const fake = await installFake({ tables: { orat_projects: [] } });

      const res = await getProjectsForOrganization(ORG_A);

      expect("error" in res ? res.error : "data" in res).toBeDefined();
      expect(eqArg(fake, "organization_id")).toBe(ORG_A);
    });

    it("returned projects have organizationId set from query scope", async () => {
      const projectRow = {
        id: PROJECT_ID,
        name: "P1",
        description: null,
        created_date: "2025-01-01",
        archived: false,
        organization_id: ORG_A,
      };
      await installFake({ tables: { orat_projects: [projectRow] } });

      const res = await getProjectsForOrganization(ORG_A);

      expect("data" in res).toBe(true);
      if ("data" in res) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].organizationId).toBe(ORG_A);
      }
    });
  });

  describe("task queries are not global", () => {
    it("getTasksForProject filters by project_id and organization_id", async () => {
      const fake = await installFake({ tables: { orat_tasks: [] } });

      const res = await getTasksForProject(PROJECT_ID, ORG_A);

      expect("error" in res ? res.error : "data" in res).toBeDefined();
      expect(eqArg(fake, "project_id")).toBe(PROJECT_ID);
      expect(eqArg(fake, "organization_id")).toBe(ORG_A);
    });
  });

  describe("project creation requires organization_id", () => {
    it("createProjectForOrganization returns error when current org does not match requested orgId", async () => {
      await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
        },
      });

      const res = await createProjectForOrganization(ORG_B, {
        name: "P",
        description: undefined,
        archived: false,
        internalTeamMembers: [],
        externalStakeholders: [],
      });

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/organization|mismatch|denied/i);
      }
    });

    it("createProjectForOrganization happy path calls RPC, inserts external stakeholders, and returns project scoped to org", async () => {
      const NEW_PROJECT_ID = "new-project-uuid";
      const fake = await installFake({
        rpc: {
          orat_user_organization_id: ORG_A,
          orat_create_project: NEW_PROJECT_ID,
        },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_projects: [
            { id: NEW_PROJECT_ID, organization_id: ORG_A },
          ],
          orat_external_stakeholders: [
            {
              id: "ext-1",
              project_id: NEW_PROJECT_ID,
              first_name: "Ada",
              last_name: "Lovelace",
              role: "Architect",
              company: "AL Inc",
            },
          ],
        },
      });

      const res = await createProjectForOrganization(ORG_A, {
        name: "Brand New",
        description: "desc",
        archived: false,
        internalTeamMembers: [],
        externalStakeholders: [
          {
            id: "ex-new",
            firstName: "Ada",
            lastName: "Lovelace",
            role: "Architect",
            company: "AL Inc",
            projectId: "",
          },
        ],
      });

      expect("data" in res).toBe(true);
      if ("data" in res) {
        expect(res.data.id).toBe(NEW_PROJECT_ID);
        expect(res.data.organizationId).toBe(ORG_A);
        expect(res.data.externalStakeholders).toHaveLength(1);
        expect(res.data.externalStakeholders[0].firstName).toBe("Ada");
      }
      const rpcCall = fake.calls.rpc?.find(
        (c: ChainCall) => c.args[0] === "orat_create_project",
      );
      expect(rpcCall).toBeDefined();
      const insertedExternals = insertPayloads(
        fake,
        "orat_external_stakeholders",
      );
      expect(insertedExternals).toHaveLength(1);
      const inserted = insertedExternals[0] as Array<Record<string, unknown>>;
      expect(inserted[0].project_id).toBe(NEW_PROJECT_ID);
      expect(inserted[0].first_name).toBe("Ada");
    });
  });

  describe("updateProject", () => {
    it("happy path updates project, reconciles members, and reconciles external stakeholders", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_projects: [
            { id: PROJECT_ID, organization_id: ORG_A, owner_id: USER_ID },
          ],
          orat_external_stakeholders: [
            { id: "kept-ext", project_id: PROJECT_ID },
            { id: "old-ext", project_id: PROJECT_ID },
          ],
        },
      });

      const res = await updateProject(
        makeProject({
          internalTeamMembers: ["new-member"],
          externalStakeholders: [
            {
              id: "kept-ext",
              firstName: "K",
              lastName: "E",
              role: "Engineer",
              company: "C",
              projectId: PROJECT_ID,
            },
            {
              id: "ex-new-1",
              firstName: "N",
              lastName: "E",
              role: "Engineer",
              company: "C",
              projectId: PROJECT_ID,
            },
          ],
        }),
      );

      expect(res).toEqual({ data: null });
      const projectUpdate = lastUpdatePayload(fake, "orat_projects");
      expect(projectUpdate).toMatchObject({
        name: "Updated Name",
        description: "Updated description",
        archived: false,
      });
      // Members are wiped then re-inserted.
      expect(deleteCount(fake, "orat_project_members")).toBeGreaterThanOrEqual(
        1,
      );
      const memberInserts = insertPayloads(fake, "orat_project_members");
      expect(memberInserts).toHaveLength(1);
      const memberRows = memberInserts[0] as Array<Record<string, unknown>>;
      const memberIds = memberRows.map((r) => r.user_id);
      expect(memberIds).toContain("new-member");
      expect(memberIds).toContain(USER_ID);
      // The external stakeholder removed from the new list is deleted.
      expect(deleteCount(fake, "orat_external_stakeholders")).toBe(1);
      const deletedExtId = fake.calls.eq?.find(
        (c) => c.table === "orat_external_stakeholders" && c.args[0] === "id",
      )?.args[1];
      expect(deletedExtId).toBe("old-ext");
      // The new "ex-..." stakeholder is inserted.
      const extInserts = insertPayloads(fake, "orat_external_stakeholders");
      expect(extInserts).toHaveLength(1);
    });

    it("rejects when project belongs to a different organization", async () => {
      await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_projects: [{ id: PROJECT_ID, organization_id: ORG_B }],
        },
      });

      const res = await updateProject(makeProject());

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not in your organization|denied|mismatch/i);
      }
    });
  });

  describe("updateTask", () => {
    it("happy path updates task fields scoped to the current org", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_projects: [{ id: PROJECT_ID, organization_id: ORG_A }],
          // parseAssignee queries this; empty means assignee resolves to user.
          orat_external_stakeholders: [],
        },
      });

      const res = await updateTask(
        makeTask({ title: "Renamed", status: "Complete" }),
      );

      expect(res).toEqual({ data: null });
      const payload = lastUpdatePayload(fake, "orat_tasks");
      expect(payload).toMatchObject({
        title: "Renamed",
        status: "Complete",
        assigned_to_user_id: USER_ID,
        assigned_to_external_id: null,
      });
      // Update was scoped to the right task id.
      const updateEqs = (fake.calls.eq ?? []).filter(
        (c) => c.table === "orat_tasks" && c.args[0] === "id",
      );
      expect(updateEqs.some((c) => c.args[1] === TASK_ID)).toBe(true);
    });

    it("rejects when the task's project belongs to a different organization", async () => {
      await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_projects: [{ id: PROJECT_ID, organization_id: ORG_B }],
        },
      });

      const res = await updateTask(makeTask());

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not in your organization|denied|mismatch/i);
      }
    });
  });

  describe("updateTaskStatus", () => {
    it("happy path appends history entry to existing history and writes new status", async () => {
      const existingEntry = {
        date: "2025-01-01",
        action: "Created",
        user: USER_ID,
      };
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_tasks: [
            {
              id: TASK_ID,
              organization_id: ORG_A,
              history: [existingEntry],
            },
          ],
        },
      });

      const newEntry = {
        date: "2025-02-01",
        action: "Marked In Progress",
        user: USER_ID,
      };
      const res = await updateTaskStatus(TASK_ID, "In Progress", newEntry);

      expect(res).toEqual({ data: null });
      const payload = lastUpdatePayload(fake, "orat_tasks");
      expect(payload?.status).toBe("In Progress");
      const history = payload?.history as Array<Record<string, unknown>>;
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(existingEntry);
      expect(history[1]).toEqual(newEntry);
    });

    it("rejects when task belongs to a different organization", async () => {
      await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_tasks: [{ id: TASK_ID, organization_id: ORG_B }],
        },
      });

      const res = await updateTaskStatus(TASK_ID, "Complete", {
        date: "2025-02-01",
        action: "Done",
        user: USER_ID,
      });

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not in your organization|denied|mismatch/i);
      }
    });
  });

  describe("deleteTask", () => {
    it("happy path issues a delete on orat_tasks scoped by id", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_tasks: [{ id: TASK_ID, organization_id: ORG_A }],
        },
      });

      const res = await deleteTask(TASK_ID);

      expect(res).toEqual({ data: null });
      expect(deleteCount(fake, "orat_tasks")).toBe(1);
      const idEq = (fake.calls.eq ?? []).find(
        (c) => c.table === "orat_tasks" && c.args[0] === "id",
      );
      expect(idEq?.args[1]).toBe(TASK_ID);
    });

    it("rejects when task belongs to a different organization", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_tasks: [{ id: TASK_ID, organization_id: ORG_B }],
        },
      });

      const res = await deleteTask(TASK_ID);

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not in your organization|denied|mismatch/i);
      }
      // Reject must short-circuit BEFORE issuing a destructive delete.
      expect(deleteCount(fake, "orat_tasks")).toBe(0);
    });
  });

  describe("reorderTasks (server action)", () => {
    it("happy path updates sort_order for each task in the current org", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_tasks: [{ id: TASK_ID, organization_id: ORG_A }],
        },
      });

      const res = await reorderTasks([{ taskId: TASK_ID, sortOrder: 7 }]);

      expect(res).toEqual({ data: null });
      const payload = lastUpdatePayload(fake, "orat_tasks");
      expect(payload).toEqual({ sort_order: 7 });
    });

    it("rejects when any task in the batch belongs to a different organization", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_tasks: [{ id: TASK_ID, organization_id: ORG_B }],
        },
      });

      const res = await reorderTasks([{ taskId: TASK_ID, sortOrder: 7 }]);

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not in your organization|denied|mismatch/i);
      }
      // Reject must short-circuit BEFORE writing sort_order.
      expect(lastUpdatePayload(fake, "orat_tasks")).toBeUndefined();
    });
  });

  describe("ensureProjectInCurrentOrg rejects project in different org", () => {
    it("returns error when project organization_id is not current user org", async () => {
      await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "A", slug: "a" }],
          orat_projects: [{ id: PROJECT_ID, organization_id: ORG_B }],
        },
      });

      const res = await ensureProjectInCurrentOrg(PROJECT_ID);

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not in your organization/i);
      }
    });
  });

  describe("ensureTaskInCurrentOrg rejects task in different org", () => {
    it("returns error when task organization_id is not current user org", async () => {
      await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "A", slug: "a" }],
          orat_tasks: [{ id: TASK_ID, organization_id: ORG_B }],
        },
      });

      const res = await ensureTaskInCurrentOrg(TASK_ID);

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not in your organization/i);
      }
    });
  });
});
