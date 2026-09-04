# Implementation status (reqs 1–27)

| # | Requirement (short) | Status |
|---|---|---|
| 1 | Markets: UAE, ME, Europe, South Africa + country list | Done — `lib/config.ts` (`REGIONS`, `COUNTRIES`), `markets` table + DEMO seed |
| 2 | Product: dry ginger only (HS 0910.12, whole/slices/powder) | Done — `PRODUCTS`, `PRODUCT_DRY_GINGER`, `products` table |
| 3 | Buyer discovery data model (source, evidence, labels) | Done — `companies` + `lead_evidence`, `source/source_url/evidence/data_label`; live discovery is a stub (`MockDiscovery`) |
| 4 | Qualification engine (explainable score → A/B/C) | Done — `lib/qualification.ts` `scoreBuyer`; used by buyer-new page + `POST /api/companies` |
| 5 | Pipeline stages (Discovered → Won/Lost/Not Relevant) | Done — `PIPELINE_STAGES`, `buyer_status`, kanban + `POST /api/companies/move` |
| 6 | Contacts (decision-makers, Unknown-safe) | Done — `contacts` table, seeded DEMO contacts for A/B buyers |
| 7 | Provider abstractions (trade DB, enrichment, email, AI) | Done — `lib/providers.ts` interfaces + mock/evidence-grounded defaults; no live keys wired |
| 8 | Outreach drafts (evidence-grounded, no auto-send) | Done — `LocalEvidenceAI` drafts + `POST /api/communications` log-only |
| 9 | Follow-ups / tasks with due dates | Done — `followups` table + UI + `app/api/followups` POST/PATCH |
| 10 | Enquiries capture | Done — `enquiries` table + `app/api/enquiries` POST/PATCH |
| 11 | Quotations (configurable terms, items) | Done — `quotes` + `quote_items` + `app/api/quotes` POST/PATCH |
| 12 | Opportunities / deal tracking | Done — `opportunities` + `app/api/opportunities` POST/PATCH |
| 13 | Activities timeline per buyer | Done — `activities` written on create/move/comms/enquiry |
| 14 | CSV import (labelled IMPORTED) | Done — `lib/csv.ts` + import UI route |
| 15 | CSV export | Done — `lib/csv.ts` export helper |
| 16 | Dashboard (scores, pipeline, follow-ups due) | Done — dashboard page queries `companies`/`opportunities`/`followups` |
| 17 | Admin/Settings extensibility | Partial — central `lib/config.ts`; no admin UI for editing config yet |
| 18 | Auth + RBAC (admin/sales/viewer) | Done — `lib/auth.ts` bcrypt+JWT cookie, `can()` gating |
| 19 | DEMO seed clearly labelled | Done — `lib/seed.ts`, all rows `DEMO`, evidence says demo/unverified |
| 20 | Data labels DEMO/VERIFIED/etc | Done — `DATA_LABELS`, `data_label` columns |
| 21 | No fabricated data (Unknown-safe) | Done by convention — Unknown defaults, evidence guard in AI, log-only comms |
| 22 | Notes per buyer | Done — `notes` table |
| 23 | Exporter directory (Indian suppliers) | Done — `exporters` table + DEMO seed |
| 24 | Search / filter buyers | Done — buyers UI + `GET /api/companies?q=&country=&grade=` |
| 25 | API for CRUD on core entities | Done — companies, followups, communications, enquiries, opportunities, quotes routes |
| 26 | TypeScript-safe build | Done — `npm run typecheck` + `npm run build` (verify below) |
| 27 | Docs (.env.example, README, this plan) | Done — `.env.example`, `README.md`, `docs/plan.md` |

## How to verify

```bash
npm install
npx tsc --noEmit   # same as npm run typecheck
npm run build
npm run seed       # optional: reset dev DB with DEMO data
```

Then `npm run dev`, log in with `admin@gingeros.local` / `admin123`.
