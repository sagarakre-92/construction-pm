/**
 * Tests for organization-aware data layer (org-data).
 * Mocks Supabase to verify project/task queries are org-scoped and
 * project creation requires / uses the correct organization_id.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProjectsForOrganization,
  getTasksForProject,
  createProjectForOrganization,
  ensureProjectInCurrentOrg,
  ensureTaskInCurrentOrg,
} from "./org-data";

const ORG_A = "org-a-uuid";
const ORG_B = "org-b-uuid";
const PROJECT_ID = "project-1-uuid";
const TASK_ID = "task-1-uuid";
const USER_ID = "user-1-uuid";

const captured = {
  projectsOrgId: null as string | null,
  tasksProjectId: null as string | null,
  tasksOrgId: null as string | null,
};

function chainEqOrder(data: unknown[] = [], error: unknown = null) {
  return {
    eq: (k: string, v: string) => {
      if (k === "organization_id") captured.projectsOrgId = v;
      return { order: () => ({ data, error }) };
    },
    order: () => ({ data, error }),
  };
}

function chainTasksEqEqOrder(data: unknown[] = [], error: unknown = null) {
  return {
    eq: (k: string, v: string) => {
      if (k === "project_id") captured.tasksProjectId = v;
      if (k === "organization_id") captured.tasksOrgId = v;
      return {
        eq: (k2: string, v2: string) => {
          if (k2 === "project_id") captured.tasksProjectId = v2;
          if (k2 === "organization_id") captured.tasksOrgId = v2;
          return { order: () => ({ data, error }) };
        },
        order: () => ({ data, error }),
      };
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

async function getMockClient(overrides: {
  session?: { user: { id: string } } | null;
  orgId?: string | null;
  orgRow?: { id: string; name: string; slug: string } | null;
  projectOrgId?: string | null;
  taskOrgId?: string | null;
  projects?: unknown[];
  tasks?: unknown[];
} = {}) {
  const {
    session = { user: { id: USER_ID } },
    orgId = ORG_A,
    orgRow = { id: ORG_A, name: "Org A", slug: "org-a" },
    projects = [],
    tasks = [],
  } = overrides as {
    projectOrgId?: string | null;
    projectRow?: { organization_id: string };
    [k: string]: unknown;
  };

  const { createClient } = await import("@/lib/supabase/server");
  const mockFrom = vi.fn((table: string) => {
    if (table === "orat_projects") {
      return {
        select: vi.fn(() => chainEqOrder(projects)),
        update: vi.fn(() => ({ eq: () => ({ data: null, error: null }) })),
        insert: vi.fn(() => ({ select: () => ({ single: () => ({ data: { id: "new-id" }, error: null }) }) })),
      };
    }
    if (table === "orat_tasks") {
      return {
        select: vi.fn(() => ({
          in: () => ({ data: [], error: null }),
          ...chainTasksEqEqOrder(tasks),
        })),
        insert: vi.fn(() => ({ select: () => ({ single: () => ({ data: {}, error: null }) }) })),
      };
    }
    if (table === "orat_project_members") {
      return { select: vi.fn(() => ({ in: () => ({ data: [], error: null }) })) };
    }
    if (table === "orat_external_stakeholders") {
      return { select: vi.fn(() => ({ in: () => ({ data: [], error: null }) })) };
    }
    if (table === "organizations") {
      return {
        select: vi.fn(() => ({ eq: () => ({ single: () => ({ data: orgRow, error: null }) }) })),
      };
    }
    return { select: vi.fn(() => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) })) };
  });

  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
    },
    rpc: vi.fn().mockResolvedValue({ data: orgId, error: null }),
    from: mockFrom,
  });

  return createClient;
}

describe("org-data: organization-aware foundations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.projectsOrgId = null;
    captured.tasksProjectId = null;
    captured.tasksOrgId = null;
  });

  describe("project queries are organization-scoped", () => {
    it("getProjectsForOrganization filters by organization_id", async () => {
      await getMockClient({ orgId: ORG_A, projects: [] });
      const res = await getProjectsForOrganization(ORG_A);
      expect("error" in res ? res.error : "data" in res).toBeDefined();
      expect(captured.projectsOrgId).toBe(ORG_A);
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
      await getMockClient({
        orgId: ORG_A,
        projects: [projectRow],
      });
      const res = await getProjectsForOrganization(ORG_A);
      expect("data" in res).toBe(true);
      if ("data" in res && res.data.length > 0) {
        expect(res.data[0].organizationId).toBe(ORG_A);
      }
    });
  });

  describe("task queries are not global", () => {
    it("getTasksForProject filters by project_id and organization_id", async () => {
      await getMockClient({ orgId: ORG_A, tasks: [] });
      const res = await getTasksForProject(PROJECT_ID, ORG_A);
      expect("error" in res ? res.error : "data" in res).toBeDefined();
      expect(captured.tasksProjectId).toBe(PROJECT_ID);
      expect(captured.tasksOrgId).toBe(ORG_A);
    });
  });

  describe("project creation requires organization_id", () => {
    it("createProjectForOrganization returns error when current org does not match requested orgId", async () => {
      await getMockClient({ orgId: ORG_A });
      const res = await createProjectForOrganization(ORG_B, {
        name: "P",
        description: undefined,
        archived: false,
        internalTeamMembers: [],
        externalStakeholders: [],
      });
      expect("error" in res).toBe(true);
      if ("error" in res) expect(res.error).toMatch(/organization|mismatch|denied/i);
    });

  });

  describe("ensureProjectInCurrentOrg rejects project in different org", () => {
    it("returns error when project organization_id is not current user org", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: USER_ID } } } }) },
        rpc: vi.fn().mockResolvedValue({ data: ORG_A, error: null }),
        from: vi.fn((table: string) => {
          if (table === "organizations") {
            return {
              select: vi.fn(() => ({ eq: () => ({ single: () => ({ data: { id: ORG_A, name: "A", slug: "a" }, error: null }) }) })),
            };
          }
          if (table === "orat_projects") {
            return {
              select: vi.fn(() => ({ eq: () => ({ single: () => ({ data: { organization_id: ORG_B }, error: null }) }) })),
            };
          }
          return { select: vi.fn(() => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) })) };
        }),
      });
      const res = await ensureProjectInCurrentOrg(PROJECT_ID);
      expect("error" in res).toBe(true);
      if ("error" in res) expect(res.error).toMatch(/not in your organization/i);
    });
  });

  describe("ensureTaskInCurrentOrg rejects task in different org", () => {
    it("returns error when task organization_id is not current user org", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: USER_ID } } } }) },
        rpc: vi.fn().mockResolvedValue({ data: ORG_A, error: null }),
        from: vi.fn((table: string) => {
          if (table === "organizations") {
            return {
              select: vi.fn(() => ({ eq: () => ({ single: () => ({ data: { id: ORG_A, name: "A", slug: "a" }, error: null }) }) })),
            };
          }
          if (table === "orat_tasks") {
            return {
              select: vi.fn(() => ({ eq: () => ({ single: () => ({ data: { organization_id: ORG_B }, error: null }) }) })),
            };
          }
          return { select: vi.fn(() => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) })) };
        }),
      });
      const res = await ensureTaskInCurrentOrg(TASK_ID);
      expect("error" in res).toBe(true);
      if ("error" in res) expect(res.error).toMatch(/not in your organization/i);
    });
  });
});
