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
  // Per-table select data (keyed by from() table name); falls back to selectData.
  // Lets a multi-read action return different rows per table.
  selectDataByTable?: Record<string, unknown>;
  selectError?: { message: string; code?: string } | null;
  apiMaxRows?: number;
  upsertError?: { message: string; code?: string } | null;
  upsertData?: unknown;
  insertError?: { message: string; code?: string } | null;
  // RPC results keyed by function name (e.g. accept_household_invite).
  rpcData?: Record<string, unknown>;
  rpcError?: Record<string, { message: string; code?: string }>;
}

export interface FakeSupabaseQuery {
  table: string;
  operation: 'read' | 'upsert' | 'insert' | 'update' | 'delete';
  eq: Array<{ column: string; value: unknown }>;
  in: Array<{ column: string; values: unknown }>;
  order: Array<{ column: string; options: unknown }>;
  range?: { from: number; to: number };
}

export interface FakeSupabaseCalls {
  queries: FakeSupabaseQuery[];
  from: string[];
  upsert: unknown[];
  insert: unknown[];
  update: unknown[];
  delete: number;
  rpc: Array<{ name: string; args: unknown }>;
}

export function makeFakeSupabase(opts: FakeSupabaseOptions = {}) {
  const calls: FakeSupabaseCalls = {
    queries: [],
    from: [],
    upsert: [],
    insert: [],
    update: [],
    delete: 0,
    rpc: [],
  };

  function buildQuery(table: string) {
    const query: FakeSupabaseQuery = {
      table,
      operation: 'read',
      eq: [],
      in: [],
      order: [],
    };
    calls.queries.push(query);
    let exactCount = false;
    function selectResult() {
      const data = opts.selectDataByTable
        ? (opts.selectDataByTable[table] ?? opts.selectData ?? null)
        : (opts.selectData ?? null);
      if (!Array.isArray(data)) {
        return {
          data,
          error: opts.selectError ?? null,
          ...(exactCount ? { count: 0 } : {}),
        };
      }
      const from = query.range?.from ?? 0;
      const requestedEnd = query.range ? query.range.to + 1 : data.length;
      const end = Math.min(
        requestedEnd,
        from + (opts.apiMaxRows ?? data.length)
      );
      return {
        data: data.slice(from, end),
        error: opts.selectError ?? null,
        ...(exactCount ? { count: data.length } : {}),
      };
    }

    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: (_columns?: string, options?: { count?: string }) => {
        exactCount = options?.count === 'exact';
        return builder;
      },
      range: (from: number, to: number) => {
        query.range = { from, to };
        return builder;
      },
      eq: (column: string, value: unknown) => {
        query.eq.push({ column, value });
        return builder;
      },
      in: (column: string, values: unknown) => {
        query.in.push({ column, values });
        return builder;
      },
      order: (column: string, options?: unknown) => {
        query.order.push({ column, options });
        return builder;
      },
      single: async () => selectResult(),
      maybeSingle: async () => selectResult(),
      upsert: (payload: unknown) => {
        query.operation = 'upsert';
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
        query.operation = 'insert';
        calls.insert.push(payload);
        return { error: opts.insertError ?? null };
      },
      update: (payload: unknown) => {
        query.operation = 'update';
        calls.update.push(payload);
        return builder;
      },
      delete: () => {
        query.operation = 'delete';
        calls.delete += 1;
        return builder;
      },
      then: (resolve: (v: unknown) => unknown) => resolve(selectResult()),
    });

    return builder;
  }

  const client = {
    from: (table: string) => {
      calls.from.push(table);
      return buildQuery(table);
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
