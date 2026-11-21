import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __kukSql: Sql | undefined;
}

function client(): Sql {
  if (!globalThis.__kukSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Chýba DATABASE_URL (pozri .env.example)");
    globalThis.__kukSql = postgres(url, {
      max: Number(process.env.DB_POOL ?? 10),
      idle_timeout: 30,
      onnotice: () => {},
      // stĺpce typu `date` necháme ako text "YYYY-MM-DD"
      types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
    });
  }
  return globalThis.__kukSql;
}

/**
 * Zdieľané pripojenie k Postgresu. Vytvorí sa až pri prvom dopyte,
 * takže `next build` nepotrebuje databázu.
 */
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply: (_t, _this, args: any[]) => (client() as any)(...args),
  get: (_t, prop) => {
    const c = client() as any;
    const v = c[prop];
    return typeof v === "function" ? v.bind(c) : v;
  },
});
