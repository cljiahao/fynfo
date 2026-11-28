/** Table-keyed chain stub: every read resolves to the rows registered for that table. */
export function makeTableStub(tables: Record<string, unknown[]>) {
  const upserts: Array<{ table: string; payload: unknown }> = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        upsert: (payload: unknown) => {
          upserts.push({ table, payload });
          tables[table] = [payload];
          return Promise.resolve({ error: null });
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: tables[table] ?? [], error: null }),
      };
      return chain;
    },
  };
  return { client, tables, upserts };
}
