# Dry Ginger Sales OS

Internal sales CRM for dry ginger exports (India → UAE, Middle East, Europe, South Africa).
Single product: Dry Ginger (HS 0910.12) — whole / slices / powder.

## Install / run / seed / login

```bash
npm install
npm run seed     # tsx lib/seed.ts — wipes dev DB, inserts DEMO data + admin users
npm run dev      # http://localhost:3000
```

Login (seeded dev accounts, override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env):

- `admin@gingeros.local` / `admin123` (admin)
- `sales@gingeros.local` / `admin123` (sales)

## Verify

```bash
npx tsc --noEmit   # or: npm run typecheck
npm run build
```

## Architecture

- Next.js 15 (App Router) + TypeScript + Tailwind. SQLite via `node:sqlite` (`lib/db.ts`, file at `data/ginger.db`, foreign keys on, schema auto-created).
- `lib/config.ts` — business config: regions, countries, buyer types, pipeline stages, `PRODUCTS` (dry ginger only), data labels.
- `lib/qualification.ts` — explainable buyer scoring (0–100 → grade A/B/C), no fake certainty.
- `lib/providers.ts` — abstractions for discovery / enrichment / email / AI. Defaults are local mocks; the AI default only references evidence already on file.
- `lib/auth.ts` — bcrypt + JWT (jose) in httpOnly cookie, RBAC (`viewer` / `sales` / `admin`).
- `lib/seed.ts` — DEMO seed (`npm run seed`).
- `lib/csv.ts`, `lib/utils.ts` — CSV import/export helpers, formatting.
- API: `app/api/companies` (GET list `?q=&country=&grade=`, POST create + auto-score), `app/api/companies/move` (POST pipeline move), `app/api/followups` (POST/PATCH), `app/api/communications` (POST log-only), `app/api/enquiries`, `app/api/opportunities`, `app/api/quotes` (POST/PATCH each).

## Data labels

Every company/exporter row carries `data_label`:

| Label | Meaning |
|---|---|
| `DEMO` | Seeded demo data — verify before any outreach, never present as real |
| `VERIFIED` | Checked against a real source |
| `UNVERIFIED` | Entered/found but not yet checked |
| `IMPORTED` | Came from CSV import |
| `MANUAL` | Hand-entered via UI/API |

Unknown fields stay `Unknown` / `Evidence not available` — never fabricate contacts, emails, or trade data.

## Provider abstractions

All external capability goes through `lib/providers.ts` interfaces (`DiscoveryProvider`, `EnrichmentProvider`, `EmailProvider`, `AIProvider`). Default instances are mocks / evidence-grounded local implementations. Connecting a live trade database, enrichment, email-sending, or AI provider means adding an implementation of the interface — no page or route changes. `providerHealth()` reports connection status; comms routes log drafts only and never auto-send.

## Security notes

- Secrets (`AUTH_SECRET`, `ADMIN_PASSWORD`) via env only; `AUTH_SECRET` signs session JWTs — set a long random value in production.
- Passwords bcrypt-hashed; sessions are httpOnly, SameSite=lax cookies.
- RBAC: read (`viewer`+), write (`sales`+), user/admin management (`admin`).
- Validation on all API routes (required fields, enum checks for stage/status, 0–100 probability); JSON errors with correct status codes.
- SQLite file lives in `data/` (git-ignored dev artifact); seed wipes it — dev/demo only, never run against production data.
