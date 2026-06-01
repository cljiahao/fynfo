/**
 * Minimal chainable Supabase stub for server-action unit tests.
 *
 * - read chains (`from().select().eq().order()/.in()`) are awaitable and resolve
 *   to `{ data: selectData, error: selectError }`; `.single()` resolves the same.
 * - `upsert`/`insert` record their payload and return `{ error }`.
 * - `update`/`delete` record the call and return the (awaitable) builder, so a
 *   trailing `.eq()/.in()` chain still resolves to the select result — set
 *   `selectError` to drive a write-chain error.
 */
export interface FakeSupabaseOptions {
  selectData?: unknown;
  selectError?: { message: string; code?: string } | null;
  upsertError?: { message: string; code?: string } | null;
  insertError?: { message: string; code?: string } | null;
}

export interface FakeSupabaseCalls {
  from: string[];
  upsert: unknown[];
  insert: unknown[];
  update: unknown[];
  delete: number;
}

export function makeFakeSupabase(opts: FakeSupabaseOptions = {}) {
  const calls: FakeSupabaseCalls = {
    from: [],
    upsert: [],
    insert: [],
    update: [],
    delete: 0,
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
      return { error: opts.upsertError ?? null };
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
  };

  return { client, calls };
}
