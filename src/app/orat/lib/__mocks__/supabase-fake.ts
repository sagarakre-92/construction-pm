/**
 * Tiny Proxy-based fake of the Supabase server client used in unit tests.
 *
 * Replaces hand-rolled chainable stubs that broke whenever the production
 * code added another `.eq()` / `.order()` / `.in()` to a query. Every chain
 * method returns the same Proxy, so chains of arbitrary depth work; the
 * Proxy is a `PromiseLike` that resolves to `{ data, error }` derived from
 * the configured table data when awaited. Each call is recorded so tests
 * can assert on captured filters.
 *
 * Example:
 *   const fake = createSupabaseFake({
 *     session: { user: { id: "u" } },
 *     rpc: { orat_user_organization_id: "org-a" },
 *     tables: {
 *       organizations: [{ id: "org-a", name: "A", slug: "a" }],
 *       orat_projects: [{ id: "p", organization_id: "org-a" }],
 *     },
 *   });
 *   (createClient as Mock).mockResolvedValue(fake);
 *   // ...run code under test...
 *   expect(fake.calls.eq?.find((c) => c.args[0] === "organization_id")?.args[1])
 *     .toBe("org-a");
 */

export type SupabaseRow = Record<string, unknown>;

export type ChainCall = {
  method: string;
  args: unknown[];
  table: string;
};

export type SupabaseFakeCalls = Record<string, ChainCall[]>;

type FilterOp =
  | { kind: "eq"; key: string; value: unknown }
  | { kind: "in"; key: string; value: unknown[] };

type RpcResult = { data: unknown; error: unknown };

export type SupabaseFakeOptions = {
  /** Per-table seed rows. Filters from `.eq()` / `.in()` are applied at await time. */
  tables?: Record<string, SupabaseRow[]>;
  /** Per-RPC return values. Pass a `{data,error}` shape to control both, or a bare value to be wrapped as `{data,error:null}`. */
  rpc?: Record<string, unknown>;
  /** Auth session returned by `auth.getSession()`. Pass `null` to simulate signed-out. */
  session?: { user: { id: string } } | null;
};

export type SupabaseFake = {
  auth: { getSession: () => Promise<{ data: { session: unknown } }> };
  from: (table: string) => unknown;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;
  /** All chain method calls grouped by method name (e.g. `calls.eq[0].args`). */
  calls: SupabaseFakeCalls;
};

function recordCall(
  calls: SupabaseFakeCalls,
  method: string,
  args: unknown[],
  table: string,
): void {
  const list = calls[method] ?? [];
  list.push({ method, args, table });
  calls[method] = list;
}

function applyFilters(rows: SupabaseRow[], filters: FilterOp[]): SupabaseRow[] {
  let result = rows;
  for (const f of filters) {
    if (f.kind === "eq") {
      result = result.filter((r) => r[f.key] === f.value);
    } else {
      const set = new Set(f.value);
      result = result.filter((r) => set.has(r[f.key]));
    }
  }
  return result;
}

type QueryState = {
  table: string;
  tables: Record<string, SupabaseRow[]>;
  filters: FilterOp[];
  single: boolean;
  calls: SupabaseFakeCalls;
};

function makeQueryProxy(state: QueryState): unknown {
  // Function target so the Proxy is callable if anything ever invokes it,
  // and so symbol/prototype reflection doesn't blow up.
  const proxy: unknown = new Proxy(function () {} as object, {
    get(_target, prop, receiver) {
      if (typeof prop !== "string") return undefined;
      if (prop === "then") {
        return (
          onFulfilled?: (value: { data: unknown; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => {
          const rows = applyFilters(
            state.tables[state.table] ?? [],
            state.filters,
          );
          const value = state.single
            ? { data: rows[0] ?? null, error: null }
            : { data: rows, error: null };
          return Promise.resolve(value).then(onFulfilled, onRejected);
        };
      }
      return (...args: unknown[]) => {
        recordCall(state.calls, prop, args, state.table);
        if (prop === "eq" && typeof args[0] === "string") {
          state.filters.push({ kind: "eq", key: args[0], value: args[1] });
        } else if (prop === "in" && typeof args[0] === "string") {
          const arr = Array.isArray(args[1])
            ? (args[1] as unknown[])
            : [args[1]];
          state.filters.push({ kind: "in", key: args[0], value: arr });
        } else if (prop === "single" || prop === "maybeSingle") {
          state.single = true;
        }
        return receiver;
      };
    },
  });
  return proxy;
}

export function createSupabaseFake(
  opts: SupabaseFakeOptions = {},
): SupabaseFake {
  const tables = opts.tables ?? {};
  const rpcConfig = opts.rpc ?? {};
  const session =
    opts.session === undefined ? { user: { id: "user-1" } } : opts.session;
  const calls: SupabaseFakeCalls = {};

  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
    },
    rpc: (name: string, args?: Record<string, unknown>) => {
      recordCall(calls, "rpc", [name, args], "__rpc__");
      const value = (rpcConfig as Record<string, unknown>)[name];
      if (
        value !== null &&
        typeof value === "object" &&
        ("data" in (value as object) || "error" in (value as object))
      ) {
        return Promise.resolve(value as RpcResult);
      }
      return Promise.resolve({
        data: value === undefined ? null : value,
        error: null,
      });
    },
    from: (table: string) => {
      recordCall(calls, "from", [table], table);
      return makeQueryProxy({
        table,
        tables,
        filters: [],
        single: false,
        calls,
      });
    },
    calls,
  };
}
