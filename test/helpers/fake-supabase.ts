/**
 * Minimal chainable Supabase stub for server-action unit tests.
 *
 * - read chains (`from().select().eq().order()/.in()`) are awaitable and resolve
 *   to `{ data: selectData, error: selectError }`; `.single()` resolves the same.
 * - `upsert` records its payload and is both awaitable (resolves to
 *   `{ data: upsertData, error: upsertError }`) and chainable
 *   (`.select().single()` resolves the same) — covers the upsert-then-return-id
 *   pattern. `insert` records its payload and returns `{ error }`.
 * - `update`/`delete` record the call and return the (awaitable) builder, so a
 *   trailing `.eq()/.in()` chain still resolves to the select result — set
 *   `selectError` to drive a write-chain error.
 */
export interface FakeSupabaseOptions {
  selectData?: unknown;
  selectError?: { message: string; code?: string } | null;
  upsertError?: { message: string; code?: string } | null;
  upsertData?: unknown;
  insertError?: { message: string; code?: string } | null;
  // RPC results keyed by function name (e.g. accept_household_invite).
  rpcData?: Record<string, unknown>;
  rpcError?: Record<string, { message: string; code?: string }>;
}

export interface FakeSupabaseCalls {
  from: string[];
  upsert: unknown[];
  insert: unknown[];
  update: unknown[];
  delete: number;
  rpc: Array<{ name: string; args: unknown }>;
}

export function makeFakeSupabase(opts: FakeSupabaseOptions = {}) {
  const calls: FakeSupabaseCalls = {
    from: [],
    upsert: [],
    insert: [],
    update: [],
    delete: 0,
    rpc: [],
  };

  const selectResult = {
    data: opts.selectData ?? null,
    error: opts.selectError ?? null,
  };

  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    single: async () => selectResult,
    upsert: (payload: unknown) => {
      calls.upsert.push(payload);
      const res = {
        data: opts.upsertData ?? null,
        error: opts.upsertError ?? null,
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        single: async () => res,
        then: (resolve: (v: unknown) => unknown) => resolve(res),
      };
      return chain;
    },
    insert: (payload: unknown) => {
      calls.insert.push(payload);
      return { error: opts.insertError ?? null };
    },
    update: (payload: unknown) => {
      calls.update.push(payload);
      return builder;
    },
    delete: () => {
      calls.delete += 1;
      return builder;
    },
    then: (resolve: (v: unknown) => unknown) => resolve(selectResult),
  });

  const client = {
    from: (table: string) => {
      calls.from.push(table);
      return builder;
    },
    rpc: (name: string, args?: unknown) => {
      calls.rpc.push({ name, args });
      const res = {
        data: opts.rpcData?.[name] ?? null,
        error: opts.rpcError?.[name] ?? null,
      };
      return {
        then: (resolve: (v: unknown) => unknown) => resolve(res),
      };
    },
  };

  return { client, calls };
}
