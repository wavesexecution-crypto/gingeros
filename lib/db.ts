// Relational store — SQLite via node:sqlite (no native deps). Foreign keys enforced.
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "ginger.db");
  _db = new DatabaseSync(file);
  _db.exec("PRAGMA foreign_keys = ON;");
  initSchema(_db);
  return _db;
}

export function initSchema(db: DatabaseSync) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'sales',
    password_hash TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS markets(
    code TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL,
    notes TEXT DEFAULT '', sources TEXT DEFAULT '', updated_at TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS products(
    id TEXT PRIMARY KEY, name TEXT NOT NULL, hs TEXT DEFAULT '', description TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS companies(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  );
  CREATE TABLE IF NOT EXISTS contacts(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, role TEXT DEFAULT '', dept TEXT DEFAULT '', email TEXT DEFAULT 'Unknown',
    phone TEXT DEFAULT 'Unknown', linkedin TEXT DEFAULT '', confidence TEXT DEFAULT 'Unverified',
    is_dm INTEGER DEFAULT 0, notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS lead_evidence(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source TEXT NOT NULL, url TEXT DEFAULT '', snippet TEXT DEFAULT '', discovered_at TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS activities(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT '', owner TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS communications(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    channel TEXT NOT NULL, direction TEXT DEFAULT 'outbound', subject TEXT DEFAULT '', body TEXT DEFAULT '',
    status TEXT DEFAULT 'logged', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS followups(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL, due_date TEXT NOT NULL, done INTEGER DEFAULT 0, owner TEXT DEFAULT '',
    notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS enquiries(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    country TEXT DEFAULT '', product TEXT DEFAULT 'Dry Ginger', qty TEXT DEFAULT '',
    packaging TEXT DEFAULT '', destination TEXT DEFAULT '', specs TEXT DEFAULT '', certs TEXT DEFAULT '',
    target_price TEXT DEFAULT '', delivery TEXT DEFAULT '', payment_terms TEXT DEFAULT '',
    status TEXT DEFAULT 'New', notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS opportunities(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    product TEXT DEFAULT 'Dry Ginger', qty TEXT DEFAULT '', price TEXT DEFAULT '', currency TEXT DEFAULT 'USD',
    value REAL DEFAULT 0, stage TEXT DEFAULT 'Discovered', probability INTEGER DEFAULT 10,
    expected_close TEXT DEFAULT '', last_activity TEXT DEFAULT '', next_action TEXT DEFAULT '',
    notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quotes(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL, enquiry_id INTEGER REFERENCES enquiries(id) ON DELETE SET NULL,
    product TEXT DEFAULT 'Dry Ginger', qty TEXT DEFAULT '', unit_price TEXT DEFAULT '', currency TEXT DEFAULT 'USD',
    packaging TEXT DEFAULT '', incoterm TEXT DEFAULT 'CIF', destination TEXT DEFAULT '', validity TEXT DEFAULT '',
    payment_terms TEXT DEFAULT '', lead_time TEXT DEFAULT '', status TEXT DEFAULT 'Draft',
    notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quote_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL, qty TEXT DEFAULT '', unit_price TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS exporters(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT DEFAULT '',
    website TEXT DEFAULT '', products TEXT DEFAULT '', ginger_offering TEXT DEFAULT '',
    export_markets TEXT DEFAULT '', certs TEXT DEFAULT 'Unknown', source TEXT DEFAULT '',
    evidence TEXT DEFAULT '', notes TEXT DEFAULT '', data_label TEXT DEFAULT 'DEMO'
  );
  CREATE TABLE IF NOT EXISTS notes(
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    body TEXT NOT NULL, owner TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comp_country ON companies(country);
  CREATE INDEX IF NOT EXISTS idx_comp_status ON companies(buyer_status);
  CREATE INDEX IF NOT EXISTS idx_comp_grade ON companies(grade);
  CREATE INDEX IF NOT EXISTS idx_opp_stage ON opportunities(stage);
  `);
}

export function nowISO() { return new Date().toISOString(); }
export function todayISO() { return new Date().toISOString().slice(0, 10); }

// Small query helpers (node:sqlite has strict SQLInputValue typings — cast at boundary)
export function q<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  const db = getDb();
  return (db.prepare(sql).all(...(params as never[])) as unknown) as T[];
}
export function q1<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  const db = getDb();
  return (db.prepare(sql).get(...(params as never[])) as unknown) as T | undefined;
}
export function exec(sql: string, ...params: unknown[]): number {
  const db = getDb();
  const r = db.prepare(sql).run(...(params as never[]));
  return Number(r.changes ?? 0);
}
export function insertGetId(sql: string, ...params: unknown[]): number {
  const db = getDb();
  const r = db.prepare(sql).run(...(params as never[]));
  return Number(r.lastInsertRowid);
}
