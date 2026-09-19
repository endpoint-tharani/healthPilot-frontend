# HealthPilot Pharmacy ERP — Frontend

React + TypeScript ERP client for the multi-branch hospital pharmacy backend. It consumes the
existing API only: there is no mock data, no duplicated business logic and no second inventory or
document model.

## Tech Stack

- **React 18 + Vite + TypeScript** (strict)
- **Material UI 6** (no Tailwind)
- **React Router 6** — permission-gated routes
- **TanStack React Query 5** — server state, caching and invalidation
- **Axios** — one client with access-token refresh and retry
- **React Hook Form + Zod** — form state and client-side validation
- **decimal.js** — every client-side money/quantity calculation

## Prerequisites

- Node.js 18+
- The backend running (see `../backend/README` section in the root README), seeded with
  `npm run prisma:seed`

## Setup

```bash
cd frontend
cp .env.example .env     # point VITE_API_BASE_URL at the API
npm install
```

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Base URL of the backend API | `http://localhost:4000/api` |

## Run

```bash
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle
npm run preview    # serve the built bundle
npm run typecheck  # strict TypeScript, no emit
```

### Smoke tests

No browser is required for either check.

```bash
npm run smoke       # server-renders every page with a stubbed session:
                    # catches import errors, bad element types and hook misuse
npm run smoke:data  # renders the document, ledger, stock and payment views with
                    # real payloads from a running, seeded backend, and asserts the
                    # scenario's money figures are formatted correctly
```

## Demo credentials

All seeded users share the password `Password123!`.

| Email | Role | Branch scope |
| --- | --- | --- |
| `admin@healthpilot.ai` | `COMPANY_ADMIN` | All branches |
| `central@healthpilot.ai` | `CENTRAL_PHARMACY` | Central Pharmacy Warehouse |
| `brancha@healthpilot.ai` | `PHARMACIST` | Branch A |
| `branchb@healthpilot.ai` | `PHARMACIST` | Branch B |
| `branchc@healthpilot.ai` | `PHARMACIST` | Branch C |

## Design system

The shell follows the FINCORPX visual language:

- **Green primary** (`#2E9E4F`) on flat, bordered white surfaces — no drop shadows, 10px radii.
- **Sidebar**: brand lockup, collapsible sections, icon per item, active item as a soft-green pill
  with the section's green rail down the left, collapse-to-rail toggle, user footer with role.
- **Top bar**: branch-scope pill, centred document search (`/` focuses it), green quick-create
  button, light/dark toggle, account menu.
- **Dashboard**: KPI header with a working 12 months / 30 days / 7 days / 24 hours range switcher,
  KPI tiles, and statement-style tables with coloured section bars.
- **Dark mode** is a real theme (tokens in `src/app/theme.ts`), remembered per browser and
  defaulting to the OS preference.

Everything in the shell is wired to real behaviour: search runs against the document register,
quick-create lists only the documents the signed-in user may raise, and the branch menu shows the
branches actually in scope.

## Architecture

```
src/
  api/        axios client (token refresh), typed endpoint modules, error normalisation
  app/        theme, react-query client
  auth/       auth context, permission helpers, route guards
  components/ DataTable, filters, dialogs, status chips, audit timeline, document chain
  features/   one folder per ERP module (list / create / detail)
  hooks/      list query params, reference data (branches, products, suppliers, stock)
  layouts/    app shell: sidebar, top bar, breadcrumbs, user menu
  routes/     route table with per-module permission gates
  types/      API contract types mirroring the backend responses
  utils/      decimal + money formatting, date and enum formatting
```

Business documents are never modelled as separate client-side entities. Requirements, purchase
orders, goods receipts, corrections, invoices, credit notes, transfers and dispensing are all
`Document` rows with `DocumentLineItem`, `DocumentLink`, `InventoryTransaction`, `Payment` and
`DocumentLog`, and the UI presents them through one shared document view.

### Terminology

The UI, routes, types, state and API calls use **Branch** only (`branchId`, `sourceBranchId`,
`destinationBranchId`). The Central Pharmacy Warehouse is a branch whose `type` is
`CENTRAL_WAREHOUSE`. There is no "location" concept anywhere in the frontend.

## Authentication

0. `POST /api/auth/signup` creates the company, its branches and the founding `COMPANY_ADMIN`, and
   returns the same token pair as login. The `/signup` wizard collects the admin account, the
   company and its branches across three steps in a single form, so nothing is lost when stepping
   back, and server-side field errors are mapped back onto the step that owns them.
1. `POST /api/auth/login` returns an access token, a rotating refresh token and the user.
2. `GET /api/auth/me` supplies the permission list and branch scope; a stored session is only
   trusted once `/me` confirms it, so a deactivated user or revoked session is rejected on load.
3. On a `401`, the axios interceptor refreshes once (a single shared in-flight refresh for all
   concurrent requests), replays the original request once, and on failure clears the session and
   redirects to the login page. A request is never replayed twice, so a refresh loop cannot form.
4. `POST /api/auth/logout` revokes the current refresh token; `logout-all` revokes every session.

## Permissions and branch scope

Navigation, routes and workflow buttons are driven by the permission list from `/auth/me`, and
branch selectors are populated from `/api/branches`, which the backend already narrows to the
caller's scope. These checks are **UX only** — the backend authorises every request, and the UI
never sends a `companyId` or an unscoped `branchId`.

## Backend endpoints added for this frontend

The backend architecture is unchanged; three additive gaps were filled so the UI could be built on
real data rather than client-side aggregation:

| Change | Why |
| --- | --- |
| `GET /api/documents` (document register, `documentType` filter, `DOCUMENT_VIEW`) | Only per-type lists existed, so a cross-type register would otherwise have to fan out over eight endpoints and paginate client-side. Reuses the existing `listDocuments` scope rules. |
| `GET /api/branches?scope=company` (needs `STOCK_TRANSFER_CREATE` or `BRANCH_MANAGE`) | A transfer destination may legitimately sit outside the sender's branch scope — the backend already allows it — but the scoped branch list could not name one. |
| `createdBy` on stock-ledger rows | The ledger is required to show which user caused each movement; the data was stored but not serialised. |

## Decimal handling

Money and quantities arrive as fixed-point strings and stay strings. Any arithmetic the UI performs
(receipt splits, allocation remainders, preview totals) goes through `decimal.js`; stored figures
always come from the backend.
