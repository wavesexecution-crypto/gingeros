// Relational store - Neon serverless Postgres (Vercel-compatible).
//
// PREVIOUS: node:sqlite with file at data/ginger.db.
// That is incompatible with Vercel because (a) data/*.db is git-ignored so the
// file is never deployed, (b) /var/task is read-only (EROFS on mkdir), (c) /tmp
// is ephemeral and per-instance so writes are not persisted.
//
// CURRENT: Neon serverless Postgres. The neon() client is connection-pooled and
// safe to call at module level (it caches the pool).
import { neon, type QueryResult } from "@neondatabase/serverless";

// Sanitize the connection string: `vercel env pull` writes values wrapped in
// double quotes (POSTGRES_URL="postgresql://..."), and a naive import of that
// file (e.g. push.bat) keeps the literal quotes. neon() then throws
// "not a valid URL". Strip surrounding quotes/whitespace defensively.
function cleanConnectionString(raw: string): string {
  let v = raw.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

const connectionString = cleanConnectionString(
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  ""
);

// Lazy-init the sql function to avoid connecting at build time
let _sql: ReturnType<typeof neon> | null = null;
function getSql() {
  if (!_sql) {
    if (!connectionString) {
      throw new Error(
        "Database not configured. Set POSTGRES_URL in Vercel project settings."
      );
    }
    _sql = neon(connectionString);
  }
  return _sql;
}

// Convert SQLite ? placeholders to Postgres $1, $2, ...
function pg(query: string, params: unknown[]): { text: string; values: unknown[] } {
  let i = 0;
  const text = query.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

// The neon() HTTP client resolves .query() to the ROWS ARRAY directly when
// fullResults is false (see processQueryResult in @neondatabase/serverless),
// NOT to a { rows, rowCount } object. Normalize both shapes here so every
// caller keeps working regardless of driver response shape.
function asRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function asRowCount(result: unknown): number {
  if (result && typeof result === "object" && typeof (result as { rowCount?: unknown }).rowCount === "number") {
    return (result as { rowCount: number }).rowCount;
  }
  return 0;
}

// Query helpers (async - Postgres requires a network round-trip)
export async function q<T = Record<string, unknown>>(
  query: string,
  ...params: unknown[]
): Promise<T[]> {
  const { text, values } = pg(query, params);
  const result = (await getSql().query(text, values as never[])) as unknown as QueryResult<Record<string, unknown>>;
  return asRows<T>(result);
}

export async function q1<T = Record<string, unknown>>(
  query: string,
  ...params: unknown[]
): Promise<T | undefined> {
  const rows = await q<T>(query, ...params);
  return rows[0];
}

export async function exec(query: string, ...params: unknown[]): Promise<number> {
  const { text, values } = pg(query, params);
  const result = (await getSql().query(text, values as never[])) as unknown as QueryResult<Record<string, unknown>>;
  return asRowCount(result);
}

export async function insertGetId(query: string, ...params: unknown[]): Promise<number> {
  const { text, values } = pg(query, params);
  const finalQuery = /RETURNING/i.test(text) ? text : `${text} RETURNING id`;
  const result = (await getSql().query(finalQuery, values as never[])) as unknown as QueryResult<Record<string, unknown>>;
  return Number(asRows<Record<string, unknown>>(result)[0]?.id ?? 0);
}

// Compatibility layer for callers that use db.prepare().get/all/run()
export function getDb() {
  return {
    prepare(query: string) {
      return {
        get: async (...params: unknown[]) => q1(query, ...params),
        all: async (...params: unknown[]) => q(query, ...params),
        run: async (...params: unknown[]) => {
          if (/^\s*INSERT/i.test(query)) {
            const id = await insertGetId(query, ...params);
            return { changes: id > 0 ? 1 : 0, lastInsertRowid: id };
          }
          const changes = await exec(query, ...params);
          return { changes, lastInsertRowid: 0 };
        },
      };
    },
    exec: async (query: string) => {
      await exec(query);
    },
  };
}

export function nowISO() {
  return new Date().toISOString();
}
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function initSchema() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'sales',
      password_hash TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS markets(
      code TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL,
      notes TEXT DEFAULT '', sources TEXT DEFAULT '', updated_at TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS products(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, hs TEXT DEFAULT '', description TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS companies(
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, country TEXT NOT NULL, city TEXT DEFAULT '',
      website TEXT DEFAULT '', company_type TEXT DEFAULT 'Other',
      industry TEXT DEFAULT '', products TEXT DEFAULT '',
      ginger_fit TEXT DEFAULT 'Unknown', import_relevance TEXT DEFAULT 'Unknown',
      size TEXT DEFAULT 'Unknown', source TEXT DEFAULT 'MANUAL', source_url TEXT DEFAULT '',
      date_discovered TEXT DEFAULT '', evidence TEXT DEFAULT '',
      last_verified TEXT DEFAULT '', buyer_status TEXT DEFAULT 'Discovered',
      qual_score INTEGER DEFAULT 0, grade TEXT DEFAULT 'C', priority TEXT DEFAULT 'Low',
      outreach_status TEXT DEFAULT 'Not contacted', last_activity TEXT DEFAULT '',
      owner TEXT DEFAULT 'Unassigned', notes TEXT DEFAULT '', data_label TEXT DEFAULT 'MANUAL'
    )`,
    `CREATE TABLE IF NOT EXISTS contacts(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL, role TEXT DEFAULT '', dept TEXT DEFAULT '', email TEXT DEFAULT 'Unknown',
      phone TEXT DEFAULT 'Unknown', linkedin TEXT DEFAULT '', confidence TEXT DEFAULT 'Unverified',
      is_dm INTEGER DEFAULT 0, notes TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS lead_evidence(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      source TEXT NOT NULL, url TEXT DEFAULT '', snippet TEXT DEFAULT '', discovered_at TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS activities(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT '', owner TEXT DEFAULT '', created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS communications(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      channel TEXT NOT NULL, direction TEXT DEFAULT 'outbound', subject TEXT DEFAULT '', body TEXT DEFAULT '',
      status TEXT DEFAULT 'logged', created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS followups(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL, due_date TEXT NOT NULL, done INTEGER DEFAULT 0, owner TEXT DEFAULT '',
      notes TEXT DEFAULT '', created_at TEXT NOT NULL
    )`,
  ];
  for (const s of stmts) await exec(s);
  await initSchemaPart2();
}

export async function initSchemaPart2() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS enquiries(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      country TEXT DEFAULT '', product TEXT DEFAULT 'Dry Ginger', qty TEXT DEFAULT '', packaging TEXT DEFAULT '',
      destination TEXT DEFAULT '', specs TEXT DEFAULT '', certs TEXT DEFAULT '',
      target_price TEXT DEFAULT '', delivery TEXT DEFAULT '', payment_terms TEXT DEFAULT '',
      status TEXT DEFAULT 'New', notes TEXT DEFAULT '', created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS opportunities(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      product TEXT DEFAULT 'Dry Ginger', qty TEXT DEFAULT '', price TEXT DEFAULT '', currency TEXT DEFAULT 'USD',
      value REAL DEFAULT 0, stage TEXT DEFAULT 'Discovered', probability INTEGER DEFAULT 10,
      expected_close TEXT DEFAULT '', last_activity TEXT DEFAULT '', next_action TEXT DEFAULT '',
      notes TEXT DEFAULT '', created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS quotes(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      enquiry_id INTEGER REFERENCES enquiries(id) ON DELETE SET NULL,
      product TEXT DEFAULT 'Dry Ginger', qty TEXT DEFAULT '', unit_price TEXT DEFAULT '', currency TEXT DEFAULT 'USD',
      packaging TEXT DEFAULT '', incoterm TEXT DEFAULT 'CIF', destination TEXT DEFAULT '', validity TEXT DEFAULT '',
      payment_terms TEXT DEFAULT '', lead_time TEXT DEFAULT '', status TEXT DEFAULT 'Draft',
      notes TEXT DEFAULT '', created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS quote_items(
      id SERIAL PRIMARY KEY, quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      description TEXT NOT NULL, qty TEXT DEFAULT '', unit_price TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS exporters(
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, location TEXT DEFAULT '',
      website TEXT DEFAULT '', products TEXT DEFAULT '', ginger_offering TEXT DEFAULT '',
      export_markets TEXT DEFAULT '', certs TEXT DEFAULT 'Unknown', source TEXT DEFAULT '',
      evidence TEXT DEFAULT '', notes TEXT DEFAULT '', data_label TEXT DEFAULT 'DEMO'
    )`,
    `CREATE TABLE IF NOT EXISTS notes(
      id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      body TEXT NOT NULL, owner TEXT DEFAULT '', created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_comp_country ON companies(country)`,
    `CREATE INDEX IF NOT EXISTS idx_comp_status ON companies(buyer_status)`,
    `CREATE INDEX IF NOT EXISTS idx_comp_grade ON companies(grade)`,
    `CREATE INDEX IF NOT EXISTS idx_opp_stage ON opportunities(stage)`,
  ];
  for (const s of stmts) await exec(s);
}

// Cached schema provisioning: ~20 sequential Neon round-trips are expensive,
// so run them once per server instance instead of on every request. The cache
// resets on failure so a later request retries (e.g. transient "Connection
// closed" or missing env at build time — build prerenders must never poison it).
let schemaPromise: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = initSchema().catch((e) => {
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}
