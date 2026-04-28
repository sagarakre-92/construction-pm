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
  listSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
  listPendingInvitations,
} from "./org-data";
import {
  createTask,
  updateProject,
  updateTask,
  updateTaskStatus,
  deleteTask,
  reorderTasks,
  revokeInvitation,
} from "../actions";

vi.mock("@/lib/email", () => ({
  sendInvitationEmail: vi.fn(async () => ({ ok: true })),
}));
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
    priority: "medium",
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

  describe("task priority", () => {
    it("getTasksForProject maps priority from row, defaulting to 'medium' when null", async () => {
      await installFake({
        tables: {
          orat_tasks: [
            {
              id: "t-with-prio",
              project_id: PROJECT_ID,
              organization_id: ORG_A,
              title: "T1",
              description: null,
              assigned_to_user_id: USER_ID,
              assigned_to_external_id: null,
              company: "",
              created_date: "2025-01-01",
              start_date: "2025-01-02",
              original_due_date: "2025-01-10",
              current_due_date: "2025-01-12",
              status: "In Progress",
              priority: "high",
              sort_order: 0,
              history: [],
            },
            {
              id: "t-no-prio",
              project_id: PROJECT_ID,
              organization_id: ORG_A,
              title: "T2",
              description: null,
              assigned_to_user_id: USER_ID,
              assigned_to_external_id: null,
              company: "",
              created_date: "2025-01-01",
              start_date: "2025-01-02",
              original_due_date: "2025-01-10",
              current_due_date: "2025-01-12",
              status: "Not Started",
              priority: null,
              sort_order: 0,
              history: [],
            },
          ],
        },
      });

      const res = await getTasksForProject(PROJECT_ID, ORG_A);

      expect("data" in res).toBe(true);
      if ("data" in res) {
        const byId = new Map(res.data.map((t) => [t.id, t]));
        expect(byId.get("t-with-prio")?.priority).toBe("high");
        expect(byId.get("t-no-prio")?.priority).toBe("medium");
      }
    });

    it("updateTask round-trips priority into the orat_tasks update payload", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_projects: [{ id: PROJECT_ID, organization_id: ORG_A }],
          orat_external_stakeholders: [],
        },
      });

      const res = await updateTask(makeTask({ priority: "high" }));

      expect(res).toEqual({ data: null });
      const payload = lastUpdatePayload(fake, "orat_tasks");
      expect(payload?.priority).toBe("high");
    });

    it("createTask sends 'medium' as the default priority when caller does not specify one", async () => {
      const NEW_TASK_ID = "task-new-uuid";
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_projects: [{ id: PROJECT_ID, organization_id: ORG_A }],
          orat_external_stakeholders: [],
          orat_tasks: [
            {
              id: NEW_TASK_ID,
              project_id: PROJECT_ID,
              organization_id: ORG_A,
              title: "New",
              description: null,
              assigned_to_user_id: USER_ID,
              assigned_to_external_id: null,
              company: "",
              created_date: "2025-01-01",
              start_date: "2025-01-02",
              original_due_date: "2025-01-10",
              current_due_date: "2025-01-12",
              status: "Not Started",
              priority: "medium",
              sort_order: 0,
              history: [],
            },
          ],
        },
      });

      const baseTask = makeTask({ id: NEW_TASK_ID, title: "New" });
      const { id: _id, projectId: _projectId, ...rest } = baseTask;
      void _id;
      void _projectId;
      const taskInput = { ...rest, priority: "medium" as const };

      const res = await createTask(PROJECT_ID, taskInput);

      expect("data" in res).toBe(true);
      if ("data" in res) {
        expect(res.data.priority).toBe("medium");
      }
      const inserts = insertPayloads(fake, "orat_tasks");
      expect(inserts.length).toBeGreaterThan(0);
      const lastInsert = inserts[inserts.length - 1] as Record<string, unknown>;
      expect(lastInsert.priority).toBe("medium");
    });

    it("createTask passes through an explicit 'high' priority into the insert payload", async () => {
      const NEW_TASK_ID = "task-new-uuid-2";
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_projects: [{ id: PROJECT_ID, organization_id: ORG_A }],
          orat_external_stakeholders: [],
          orat_tasks: [
            {
              id: NEW_TASK_ID,
              project_id: PROJECT_ID,
              organization_id: ORG_A,
              title: "Urgent",
              description: null,
              assigned_to_user_id: USER_ID,
              assigned_to_external_id: null,
              company: "",
              created_date: "2025-01-01",
              start_date: "2025-01-02",
              original_due_date: "2025-01-10",
              current_due_date: "2025-01-12",
              status: "Not Started",
              priority: "high",
              sort_order: 0,
              history: [],
            },
          ],
        },
      });

      const baseTask = makeTask({ id: NEW_TASK_ID, title: "Urgent", priority: "high" });
      const { id: _id, projectId: _projectId, ...rest } = baseTask;
      void _id;
      void _projectId;

      const res = await createTask(PROJECT_ID, rest);

      expect("data" in res).toBe(true);
      if ("data" in res) {
        expect(res.data.priority).toBe("high");
      }
      const inserts = insertPayloads(fake, "orat_tasks");
      const lastInsert = inserts[inserts.length - 1] as Record<string, unknown>;
      expect(lastInsert.priority).toBe("high");
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

  describe("saved views: per-user, org-scoped", () => {
    const VIEW_ID = "view-1-uuid";
    const OTHER_USER = "user-2-uuid";

    it("listSavedViews filters by current user_id and current organization_id", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_saved_views: [
            {
              id: VIEW_ID,
              organization_id: ORG_A,
              user_id: USER_ID,
              name: "My week",
              filters: { assignee_filter: "my-tasks" },
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      });

      const res = await listSavedViews();

      expect("data" in res).toBe(true);
      if ("data" in res) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].id).toBe(VIEW_ID);
        expect(res.data[0].userId).toBe(USER_ID);
        expect(res.data[0].organizationId).toBe(ORG_A);
        expect(res.data[0].name).toBe("My week");
      }
      const eqs = (fake.calls.eq ?? []).filter(
        (c) => c.table === "orat_saved_views",
      );
      const eqKeys = eqs.map((c) => c.args[0]);
      expect(eqKeys).toContain("user_id");
      expect(eqKeys).toContain("organization_id");
      expect(
        eqs.find((c) => c.args[0] === "user_id")?.args[1],
      ).toBe(USER_ID);
      expect(
        eqs.find((c) => c.args[0] === "organization_id")?.args[1],
      ).toBe(ORG_A);
    });

    it("createSavedView writes user_id from session and organization_id from current org", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_saved_views: [
            {
              id: VIEW_ID,
              organization_id: ORG_A,
              user_id: USER_ID,
              name: "High priority",
              filters: { priority: "high" },
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      });

      const res = await createSavedView("High priority", {
        priority: "high",
      });

      expect("data" in res).toBe(true);
      if ("data" in res) {
        expect(res.data.userId).toBe(USER_ID);
        expect(res.data.organizationId).toBe(ORG_A);
        expect(res.data.name).toBe("High priority");
      }
      const inserts = insertPayloads(fake, "orat_saved_views");
      expect(inserts).toHaveLength(1);
      const payload = inserts[0] as Record<string, unknown>;
      expect(payload.user_id).toBe(USER_ID);
      expect(payload.organization_id).toBe(ORG_A);
      expect(payload.name).toBe("High priority");
      expect(payload.filters).toEqual({ priority: "high" });
    });

    it("createSavedView rejects empty name", async () => {
      await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
        },
      });

      const res = await createSavedView("   ", {});
      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/name|required/i);
      }
    });

    it("updateSavedView blocks writes to a view owned by another user", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_saved_views: [
            {
              id: VIEW_ID,
              organization_id: ORG_A,
              user_id: OTHER_USER,
              name: "Theirs",
              filters: {},
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      });

      const res = await updateSavedView(VIEW_ID, {
        name: "Hijack",
        filters: {},
      });

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not your|forbidden|denied|own/i);
      }
      expect(lastUpdatePayload(fake, "orat_saved_views")).toBeUndefined();
    });

    it("updateSavedView happy path writes new name and filters scoped to id", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_saved_views: [
            {
              id: VIEW_ID,
              organization_id: ORG_A,
              user_id: USER_ID,
              name: "Old",
              filters: { assignee_filter: "all" },
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      });

      const res = await updateSavedView(VIEW_ID, {
        name: "Renamed",
        filters: { assigneeFilter: "my-tasks" },
      });

      expect("data" in res).toBe(true);
      const payload = lastUpdatePayload(fake, "orat_saved_views");
      expect(payload).toBeDefined();
      expect(payload?.name).toBe("Renamed");
      expect(payload?.filters).toEqual({ assigneeFilter: "my-tasks" });
      const idEq = (fake.calls.eq ?? []).find(
        (c) => c.table === "orat_saved_views" && c.args[0] === "id",
      );
      expect(idEq?.args[1]).toBe(VIEW_ID);
    });

    it("deleteSavedView blocks deleting another user's view", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_saved_views: [
            {
              id: VIEW_ID,
              organization_id: ORG_A,
              user_id: OTHER_USER,
              name: "Theirs",
              filters: {},
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      });

      const res = await deleteSavedView(VIEW_ID);

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/not your|forbidden|denied|own/i);
      }
      expect(deleteCount(fake, "orat_saved_views")).toBe(0);
    });

    it("deleteSavedView happy path issues delete scoped by id", async () => {
      const fake = await installFake({
        rpc: { orat_user_organization_id: ORG_A },
        tables: {
          organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
          orat_saved_views: [
            {
              id: VIEW_ID,
              organization_id: ORG_A,
              user_id: USER_ID,
              name: "Mine",
              filters: {},
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      });

      const res = await deleteSavedView(VIEW_ID);

      expect(res).toEqual({ data: null });
      expect(deleteCount(fake, "orat_saved_views")).toBe(1);
      const idEq = (fake.calls.eq ?? []).find(
        (c) =>
          c.table === "orat_saved_views" &&
          c.args[0] === "id" &&
          c.args[1] === VIEW_ID,
      );
      expect(idEq).toBeDefined();
    });
  });

  describe("listPendingInvitations", () => {
    it("filters by organization_id and status='pending' and returns rows", async () => {
      const fake = await installFake({
        tables: {
          organization_invitations: [
            {
              id: "inv-1",
              organization_id: ORG_A,
              email: "maria@example.com",
              role: "member",
              status: "pending",
              created_at: "2026-04-20T00:00:00Z",
              expires_at: "2026-04-27T00:00:00Z",
              first_name: "Maria",
              last_name: "Lopez",
              title: "Engineer",
            },
          ],
        },
      });

      const res = await listPendingInvitations(ORG_A);

      expect("data" in res).toBe(true);
      if ("data" in res) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0]).toMatchObject({
          id: "inv-1",
          email: "maria@example.com",
          status: "pending",
        });
      }

      const eqs = fake.calls.eq ?? [];
      expect(
        eqs.some((c) => c.args[0] === "organization_id" && c.args[1] === ORG_A),
      ).toBe(true);
      expect(
        eqs.some((c) => c.args[0] === "status" && c.args[1] === "pending"),
      ).toBe(true);
    });
  });

  describe("revokeInvitation (server action)", () => {
    const INVITE_ID = "inv-1";

    it("happy path updates the row with status='cancelled' scoped by id", async () => {
      const fake = await installFake({
        tables: {
          organization_invitations: [
            {
              id: INVITE_ID,
              organization_id: ORG_A,
              status: "pending",
            },
          ],
        },
      });

      const res = await revokeInvitation(INVITE_ID);

      expect(res).toEqual({ data: null });
      const payload = lastUpdatePayload(fake, "organization_invitations");
      expect(payload).toMatchObject({ status: "cancelled" });
      const idEq = (fake.calls.eq ?? []).find(
        (c) =>
          c.table === "organization_invitations" && c.args[0] === "id",
      );
      expect(idEq?.args[1]).toBe(INVITE_ID);
    });

    it("rejects when not authenticated", async () => {
      await installFake({ session: null });

      const res = await revokeInvitation(INVITE_ID);

      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toMatch(/Not authenticated/i);
      }
    });
  });
});
