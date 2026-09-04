# Client Handoff — Waves Dry Ginger International Sales OS

**Product:** WAVES Dry Ginger International Sales OS

**Client:** Dry Ginger International

**Delivery model:** One client = one tenant. No multi-tenancy. No workspace switching. The client visits the URL, logs in with dedicated credentials, and uses the OS.

**Brand (Waves):** `#071A3D` navy · `#00C8D7` cyan · `#FF6B61` coral · `#FFFFFF` white · `#F7F8FA` off-white · `#EEF1F4` surface · `#DCE3EA` border.

---

## 1. Client access

The client logs in with dedicated credentials provisioned from environment variables:

- **Client email:** `CLIENT_EMAIL` (set in production environment)
- **Client password:** `CLIENT_PASSWORD` (set in production environment)
- **Role:** `sales` (full read/write access to all buyer-facing modules)
- **Client CANNOT access:** `/admin` or any Waves-internal administrative functionality

Access the production login at: `/login`

---

## 2. What was built

| Module | Path | Notes |
|---|---|---|
| Executive dashboard | `/` | KPIs, hot buyers, open opportunities, today's follow-ups, recent enquiries, market roll-up |
| Buyer database | `/buyers`, `/buyers/[id]`, `/buyers/new` | Filter by region / country / grade / stage / text; per-buyer timeline + notes |
| Buyer profiles | `/buyers/[id]` | Identity, products, signals, evidence, contacts, enquiries, opportunities, quotes, notes |
| Buyer qualification | `lib/qualification.ts` + buyer-new | Explainable 0–100 score → grade A/B/C, used everywhere |
| Buyer discovery | `/discovery` | Discovery provider abstraction (live DB plug-in later); UI present, default returns local-only |
| Market intelligence | `/markets`, `/countries/[code]` | 4 regions, 15 countries, buyer roll-up per market |
| Indian exporter intelligence | `/exporters` | Indian supplier directory with `data_label` (DEMO / VERIFIED / etc.) |
| CRM kanban | `/crm` | Drag-style stage moves with audit |
| Outreach | `/outreach` | Per-buyer outreach status + drafts (log-only, never auto-send) |
| Follow-ups | `/followups` | Due-date tasks per buyer; overdue badge in sidebar |
| Enquiries | `/enquiries`, `/enquiries/new`, `/enquiries/[id]` | Capture MT volume + destination + specs |
| Opportunities | `/opportunities`, `/opportunities/new`, `/opportunities/[id]` | Stage / probability / value / next action |
| Quotations | `/quotes`, `/quotes/new`, `/quotes/[id]` | Configurable terms, line items, Incoterm, validity |
| AI control layer | `/ai` + global Copilot + `lib/ai/*` | Local evidence-based engine, RBAC, HMAC-signed write confirmations, audit, evidence-only |
| CSV import | `/import` + `app/api/import` | Imports become `data_label=IMPORTED` |

---

## 3. Auth model — dedicated client login

- **One client login only.** The client signs in with `CLIENT_EMAIL` / `CLIENT_PASSWORD` from env. There is no sign-up page, no invitation flow, no workspace picker.
- **Waves-internal admin** (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) is provisioned automatically on first request from env. The client role is `sales`; the admin role is `admin`. The client's sidebar does **not** show `/admin` (Settings).
- **No dev / smoke credentials** are auto-created. `lib/seed.ts` refuses to run in production. `lib/auth.ts` only seeds users from env, never from hard-coded defaults.
- **Middleware** (`middleware.ts`) blocks every page except `/login` and every API except `/api/auth/*` without a valid JWT cookie. The login page bounces signed-in users home.
- **RBAC**: viewer = read, sales = read + write, admin = all. Tool-level RBAC is mirrored in `lib/ai/permissions.ts`.
- **Cookie hardening**: `httpOnly`, `SameSite=lax`, `Secure` toggled by `COOKIE_SECURE` env (set `true` behind HTTPS in production).

---

## 4. AI control layer

`lib/ai/agent.ts` is the orchestrator. `lib/ai/tools.ts` exposes buyer/company/enquiry/quote/outreach/follow-up/pipeline tools. All tools are RBAC-gated (`lib/ai/permissions.ts`) and validated with Zod.

**Default AI mode:** `local-evidence` — deterministic, evidence-only, no external provider required. Never invents facts. Returns "Evidence not available" or "Unknown" when no signal is on file.

**AI context configured for:**
- Product: Dry Ginger (HS 0910.12, whole / slices / powder)
- Origin: India
- Target markets: UAE, Middle East, Europe, South Africa

**AI capabilities available to client:**
- AI brief
- Buyer research
- Buyer qualification
- Follow-up creation
- Pipeline actions
- Confirmation flow
- Audit log
- Undo

---

## 5. Environment variables required for deployment

```
AUTH_SECRET=          # Long random string (≥48 chars). Rotate only on maintenance windows.
COOKIE_SECURE=true    # Set to true behind HTTPS in production.

ADMIN_EMAIL=          # Waves-internal admin account (NOT given to client)
ADMIN_PASSWORD=       # Strong unique password

CLIENT_NAME=Dry Ginger International
CLIENT_EMAIL=         # Client login email
CLIENT_PASSWORD=       # Strong unique password

AI_PROVIDER=local-evidence   # Safe default (no external provider required)
NEXT_PUBLIC_APP_URL=         # Public URL of the deployed app
```

**IMPORTANT:** Never commit `.env.local` or any file containing real secrets to Git. Set these variables in the deployment environment.

---

## 6. Deployment instructions

1. Set all required environment variables in the production environment.
2. Run `npm run build` to create the production build.
3. Run `npm start` to start the production server (port 3000 by default).
4. On first request, `ensureClientSeed()` + `ensureAdminSeed()` (in `app/layout.tsx`) create both accounts idempotently.
5. The client can now log in with `CLIENT_EMAIL` / `CLIENT_PASSWORD`.

---

## 7. Production verification checklist

- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0
- [x] `.env.local` is NOT in the deploy bundle (git-ignored)
- [x] `data/*.db` is NOT in the deploy bundle (regenerated on first request)
- [x] `AUTH_SECRET` set to a long random string
- [x] `COOKIE_SECURE=true` (for HTTPS production)
- [x] `AI_PROVIDER=local-evidence` (safe default)
- [x] Database contains only 2 users (admin + client)
- [x] Database contains 18 DEMO buyers (explicitly labeled)
- [x] Database contains 6 DEMO exporters (explicitly labeled)
- [x] No legacy dev/smoke-test credentials
- [x] Client login works and redirects to dashboard
- [x] Client cannot access `/admin`
- [x] Admin login works and can access `/admin`
- [x] All client pages return 200 (Dashboard, Buyers, Discovery, Markets, CRM, Follow-ups, Enquiries, Quotes, Opportunities, AI)

---

## 8. Mobile + Desktop support

**Mobile (375x812, 390x844, 430x932):**
- Bottom navigation works
- No horizontal overflow
- Forms, tables/cards, CRM, AI all functional
- 44px minimum tap targets

**Desktop (1280x800, 1440x900, 1920x1080):**
- Navy sidebar with grouped navigation
- Sticky top bar with search and create buttons
- Tables and grid layouts
- All modules functional

---

## 9. What was verified in this workspace

- `npm run build` exits 0, 13 static pages prerendered, middleware 39.6 kB
- `npx tsc --noEmit` exits 0
- DB inspection confirms only 2 users provisioned from env (`waves-admin@waves.example` + `client@gingerosales.com`)
- No legacy `admin@gingeros.local` / `sales@gingeros.local` accounts
- All 18 buyers explicitly labeled `DEMO`
- All 6 exporters explicitly labeled `DEMO`
- Client login works, admin access blocked for client
- Admin login works, admin access granted

---

## 10. Support contact

For configuration changes (new regions, currencies, buyer types, pipeline stages, AI provider swaps), edit `lib/config.ts` and re-deploy. For schema changes, edit `lib/db.ts` (auto-migrating on first request).

Waves maintains the OS; the client uses it.
