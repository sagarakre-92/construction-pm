/**
 * Tests for the /api/orat/reorder route handler.
 *
 * Per the test-coverage audit, this is the only `/api/*` handler in the app
 * and it re-implements org-scoping itself (rather than delegating to a server
 * action). Until that's consolidated, the handler needs its own tests so the
 * cross-org guard can't silently regress.
 *
 * Reuses the Proxy-based Supabase fake from
 * `src/app/orat/lib/__mocks__/supabase-fake` so chain depth doesn't matter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import {
  createSupabaseFake,
  type SupabaseFake,
  type SupabaseFakeOptions,
  type ChainCall,
} from "@/app/orat/lib/__mocks__/supabase-fake";

const ORG_A = "org-a-uuid";
const ORG_B = "org-b-uuid";
const TASK_ID = "task-1-uuid";
const USER_ID = "user-1-uuid";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

async function installFake(
  opts: SupabaseFakeOptions = {},
): Promise<SupabaseFake> {
  const fake = createSupabaseFake({
    session: { user: { id: USER_ID } },
    ...opts,
  });
  const { createClient } = await import("@/lib/supabase/server");
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fake);
  return fake;
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/orat/reorder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function lastUpdatePayload(
  fake: SupabaseFake,
  table: string,
): Record<string, unknown> | undefined {
  const calls = (fake.calls.update ?? []).filter(
    (c: ChainCall) => c.table === table,
  );
  return calls[calls.length - 1]?.args[0] as
    | Record<string, unknown>
    | undefined;
}

describe("/api/orat/reorder POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with no-op when updates list is empty", async () => {
    await installFake();

    const res = await POST(postRequest({ updates: [] }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: null });
  });

  it("returns 401 when user is not authenticated", async () => {
    await installFake({ session: null });

    const res = await POST(
      postRequest({ updates: [{ taskId: TASK_ID, sortOrder: 1 }] }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/not authenticated/i);
  });

  it("happy path: updates sort_order for a task in the current org", async () => {
    const fake = await installFake({
      rpc: { orat_user_organization_id: ORG_A },
      tables: {
        organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
        orat_tasks: [{ id: TASK_ID, organization_id: ORG_A }],
      },
    });

    const res = await POST(
      postRequest({ updates: [{ taskId: TASK_ID, sortOrder: 5 }] }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: null });
    expect(lastUpdatePayload(fake, "orat_tasks")).toEqual({ sort_order: 5 });
  });

  it("rejects with 403 when any task in the batch belongs to a different organization", async () => {
    const fake = await installFake({
      rpc: { orat_user_organization_id: ORG_A },
      tables: {
        organizations: [{ id: ORG_A, name: "Org A", slug: "org-a" }],
        orat_tasks: [{ id: TASK_ID, organization_id: ORG_B }],
      },
    });

    const res = await POST(
      postRequest({ updates: [{ taskId: TASK_ID, sortOrder: 5 }] }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not in your organization|denied|mismatch/i);
    expect(lastUpdatePayload(fake, "orat_tasks")).toBeUndefined();
  });
});
