# HealthPilot.ai — Multi-Branch Hospital Pharmacy ERP

A working ERP for a hospital pharmacy network: one central warehouse and three branches, with
stock requisitions, procurement, receiving, corrections, supplier invoicing and credit notes,
inter-branch stock transfers, dispensing, payments and a full stock ledger.

Two repositories:

| Repository | Contents |
| --- | --- |
| `healthPilot-backend` | Express + TypeScript API, Prisma, PostgreSQL, Socket.IO |
| `healthPilot-frontend` | React 18 + TypeScript + Material UI client (this repo) |

---

## 1. Project overview

The system models one hospital company with four branches. A branch that is short of stock raises a
**stock requisition**; central procurement either **transfers** stock from a branch that can spare
it, or raises a **purchase order** on a supplier. Deliveries are booked with a **goods receipt**
split into accepted, damaged and missing; a later **stock adjustment (receipt correction)** can
restate that split without ever editing the posted receipt. The **supplier invoice** is booked at
the value the supplier claims but is only payable up to what was actually accepted — the difference
is an **invoice discrepancy** that a **credit note** clears before any **payment** may be allocated.
Stock reaching a branch is **dispensed** to patients, which records the sale, the patient payment
and **COGS**.

Every stock figure in the product is derived from the **stock ledger** (`InventoryTransaction`).
There is no second balance table that could drift from it.

On top of that sits a **double-entry accounting module** built on the **Ind AS reporting format**:
Nature — Nature Type — Head — Group — Sub Group — Ledger. Supplier invoices, supplier
payments, dispensing sales and cost of goods sold raise balanced journal entries through explicit,
idempotent accounting events, and the Trial Balance, Profit & Loss and Balance Sheet are derived
from posted journal lines on every request.

## 2. Architecture

**One document model.** Requisitions, purchase orders, goods receipts, corrections, invoices,
credit notes, transfers and dispensing are all `Document` rows with `DocumentLineItem` lines,
`DocumentLink` relationships, `InventoryTransaction` stock movements, `Payment` /
`PaymentAllocation` money and `DocumentLog` audit history. Adding a document type is a new service,
not a new schema.

```
Backend                                  Frontend
  routes/      HTTP surface + guards       api/        axios client, typed endpoints
  middleware/  auth, permissions, limits   auth/       session, permissions, route guards
  controller/  request -> service          features/   one folder per ERP module
  services/    all business rules          components/ tables, chains, timelines, forms
  database/    Prisma client, transactions hooks/      list params, reference data
  prisma/      schema, migrations          types/      API contract types
```

The accounting hierarchy, as the Ind AS reporting format defines it:

```
IND_AS reporting format
  Nature (AS, LI, EQ, IN, EX)
    Nature Type (Current / Non-Current, ...)
      Head (AS-0009 Inventories, LI-0006 Trade payables, IN-0001 Revenue, ...)
        Group          (optional)
          Sub Group    (optional)
            Ledger (4101 Sales, 5101 COGS, 5201 Purchases, ...)
              JournalLine -> JournalEntry -> General Ledger -> Trial Balance / P&L / Balance Sheet
```

Rules that matter:

- **Posted documents are immutable.** A mistake is corrected by a new document carrying the signed
  delta, never by editing the original.
- **Every posting is one transaction.** Document, lines, links, stock movements, payments and audit
  entries commit or roll back together.
- **Status changes are conditional writes.** `UPDATE ... WHERE id = ? AND status IN (...)`, so two
  users posting the same receipt cannot both succeed.
- **Branch scope is applied in the query**, never to a result set after fetching.
- **Fulfilment is branch-aware.** A requisition is met by usable stock that reached *the branch that
  raised it* — stock sitting in the central warehouse does not count.
- **Accounting is an explicit, idempotent event.** Posting a document's accounting twice returns the
  journal raised the first time. Duplicate postings are refused by a unique index on
  `(companyId, sourceEventKey)`, not by a check two concurrent requests could both pass.
- **Posted journals are immutable.** A correction is a reversing entry with every debit and credit
  swapped; the original stays in the record. The debit/credit rules and the balance of a posted
  entry are `CHECK` constraints in Postgres, so they hold against raw SQL too.
- **No business service names a ledger code.** Accounts are resolved by role
  (`SALES`, `INVENTORY`, `BANK`, ...) through `AccountMapping`, with an optional per-branch
  override.

## 3. Setup

Requires Node 18+ (CI uses 22) and a PostgreSQL database.

```bash
# backend
cd healthPilot-backend
cp .env.example .env          # then fill in DATABASE_URL and JWT_SECRET
npm install
npm run prisma:migrate        # first run: creates the schema
npm run prisma:seed           # loads the demo scenario
npm run dev                   # http://localhost:4000

# frontend
cd healthPilot-frontend
cp .env.example .env          # point VITE_API_BASE_URL at the API
npm install
npm run dev                   # http://localhost:5173
```

## 4. Environment variables

**Backend** (`healthPilot-backend/.env`, never committed):

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_SECRET` | yes | **none** | Access-token signing key. The server refuses to start without it; minimum 16 characters in development, 32 in production. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `PORT` | no | `4000` | API port |
| `NODE_ENV` | no | `development` | `production` tightens the secret policy |
| `ACCESS_TOKEN_EXPIRES_IN` | no | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_IN` | no | `30d` | Refresh token lifetime |
| `MAX_PAGE_SIZE` | no | `100` | Upper bound on `limit` |
| `ALLOW_PUBLIC_SIGNUP` | no | `true` | Set `false` to close self-service tenant creation |
| `SIGNUP_RATE_LIMIT` | no | `10` | Signups per client address per hour |
| `LOGIN_RATE_LIMIT` | no | `30` | Login attempts per client address per window |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | no | `900000` | Login throttle window (15 minutes) |
| `TRUST_PROXY` | no | `false` | Set `true` only when behind a reverse proxy |
| `SEED_PASSWORD` | no | `Password123!` | Password given to every seeded user |

**Frontend** (`healthPilot-frontend/.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:4000/api` | Base URL of the backend API |

No `.env` file is committed in either repository; both `.gitignore` files exclude `.env` and
`.env.*` while keeping `.env.example`.

## 5. Database migration

```bash
cd healthPilot-backend
npm run prisma:migrate        # development: applies and creates migrations
npx prisma migrate deploy --schema=prisma   # production/CI: applies existing migrations only
npx prisma migrate status --schema=prisma   # check the database is up to date
npm run prisma:studio         # browse the data
```

The schema is split across `prisma/models/**` and `prisma/enums/` using Prisma's schema-folder
support; `prisma/schema.prisma` holds the generator and datasource only.

## 6. Seed and demo data

```bash
npm run prisma:seed        # builds the demo scenario through the real services
npm run verify:scenario    # asserts every stock and money figure (no server needed)
```

The seed is **scoped to the two demo tenants it owns** (`COMP-HEALTHPILOT` and `COMP-OTHERCARE`).
It never touches another company's data, so it is safe to run against a shared database.

It does not insert balances or totals. It signs in as the seeded users and drives the real
application services, so every figure the demo shows is produced by the same business rules the API
uses at runtime.

## 7. Test credentials

All seeded users share the password `Password123!` (or `SEED_PASSWORD`).

| Email | Role | Branch scope |
| --- | --- | --- |
| `admin@healthpilot.ai` | `COMPANY_ADMIN` | All branches |
| `central@healthpilot.ai` | `CENTRAL_PHARMACY` | Central Pharmacy Warehouse |
| `brancha@healthpilot.ai` | `PHARMACIST` | Branch A |
| `branchb@healthpilot.ai` | `PHARMACIST` | Branch B |
| `branchc@healthpilot.ai` | `PHARMACIST` | Branch C |
| `admin@othercare.ai` | `COMPANY_ADMIN` | A second tenant, for isolation testing |

## 8. Live deployed URL

> **TODO (author):** add the deployed frontend and API URLs here before submitting. Nothing in
> either repository currently records a deployment target, so this is deliberately left blank
> rather than guessed.

- Frontend: _not yet recorded_
- API: _not yet recorded_

## 9. Assumptions

- One company, one currency (INR), one tax rate per product. No multi-currency and no tax
  jurisdictions.
- Missing quantities on a delivery never enter the warehouse, so they produce a document record and
  no stock movement at all.
- A credit note is a financial document only. It clears disputed invoice value and never restores
  usable stock.
- Damaged stock is recorded and credited but is never transferable or dispensable. There is no
  disposal or write-off document; the damaged bucket simply holds it.
- An internal transfer moves stock at the cost the batch already carries, not at the current product
  price, so moving stock between branches creates no inventory value.
- A transfer counts towards a requisition only when it is received at the branch that raised it.
- Document numbering is per company and per series (`REQ-0001`, `PO-0001`, …), serialised with a
  PostgreSQL advisory lock.
- Business dates are supplied by the caller and default to now; `createdAt` always records when the
  row was actually written, and the two are separate facts.

## 10. External sources and research

- [Prisma documentation](https://www.prisma.io/docs) — schema folders, interactive transactions,
  `groupBy`, relation filters.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html) and
  read-committed behaviour, for the concurrency model used by document numbering, the stock ledger
  and status transitions.
- [Material UI](https://mui.com/material-ui/getting-started/) and
  [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) documentation.
- [OWASP Authentication and Session Management cheat sheets](https://cheatsheetseries.owasp.org/)
  for token handling, refresh-token rotation and login throttling.
- General ERP practice for three-way matching (order / receipt / invoice), goods-received-not-
  invoiced handling and credit notes.

## 11. AI tools used

- **Claude (Anthropic), via Claude Code** — used for implementation, review and for the fixes
  applied in the remediation pass: the scoped seed, branch-aware fulfilment, concurrency-safe status
  transitions, the post-invoice correction rule, transfer validation, the searchable requisition
  picker and the verification scripts. All generated code was reviewed, and every business figure is
  asserted by `npm run verify:scenario` rather than taken on trust.

> **TODO (author):** add any other AI tools used during the original build.

## 12. Third-party components

**Backend:** Express, Prisma, `@prisma/client`, PostgreSQL, `jsonwebtoken`, `bcrypt`, `zod`,
`decimal.js`, `socket.io`, `cors`, `dotenv`, `tsx`, TypeScript.

**Frontend:** React 18, Vite, TypeScript, Material UI 6, React Router 6, TanStack React Query 5,
Axios, React Hook Form, `zod`, `decimal.js`, `socket.io-client`.

No UI kit beyond Material UI, no state library beyond React Query, and no ORM beyond Prisma.

## 13. Features intentionally omitted

- Multi-currency, tax jurisdictions and statutory reporting.
- Supplier returns, stock disposal/write-off documents and physical stocktake.
- Purchase requisition approval hierarchies and budget checks.
- Email or SMS delivery; notifications are in-app and realtime only.
- Reporting exports (PDF/Excel) and scheduled reports.
- Automated test suite in a runner. Verification is done by the `verify:*` scripts described below,
  which assert real behaviour against a real database rather than mocks.
- Horizontal-scale concerns: the rate limiter is in-process, so a multi-instance deployment needs a
  shared limiter or a WAF in front.

## 14. Demo workflow

Seed, then sign in as `central@healthpilot.ai` and follow the chain:

| Step | Document | What to look at |
| --- | --- | --- |
| 01 Sep | `REQ-0001` Branch A, 100 vials | Also `REQ-0002` (Branch B, 40) and `REQ-0003` (Branch C, 60), left open |
| 02 Sep | `PO-0001` 100 × ₹500 | Subtotal ₹50,000, tax ₹2,500, total ₹52,500 |
| 05 Sep | `GRN-0001` | All 100 booked as accepted |
| 06 Sep | `COR-0001` | Corrected to 70 usable / 20 damaged / 10 missing |
| 06 Sep | `INV-0001` ₹52,500 | Payable ₹36,750, disputed ₹15,750 |
| 06 Sep | `CN-0001` ₹15,750 | Clears the dispute; `PAY-0001` then settles ₹36,750 |
| 09 Sep | `TRF-0001` | 30 vials Central → Branch A, linked to `REQ-0001` |
| 09 Sep | `DSP-0001` | 5 vials, ₹3,250 + ₹162.50 tax = ₹3,412.50, paid by CARD, COGS ₹2,500 (`PAY-0002`) |

The seed then raises the accounting for that chain, through the same event functions the API
exposes. Four journals, all balanced:

| Journal | Event | Entry |
| --- | --- | --- |
| `JV-0001` | Supplier invoice | Dr Inventory ₹35,000 · Dr Input GST ₹1,750 · Cr Trade Payables ₹36,750 |
| `JV-0002` | Supplier payment | Dr Trade Payables ₹36,750 · Cr Bank ₹36,750 |
| `JV-0003` | Sales | Dr Bank ₹3,412.50 · Cr Sales ₹3,250 · Cr Output GST ₹162.50 |
| `JV-0004` | COGS | Dr COGS ₹2,500 · Cr Inventory ₹2,500 |

Two documents deliberately raise **no** journal, and the reconciliation report says so rather than
leaving a gap:

- **`TRF-0001`, the internal stock transfer.** The same stock, at the same cost, moves between two
  branches of one company. No revenue is earned and no expense incurred, so recognising a sale on it
  would let the company book profit by moving boxes between its own shelves — and would
  double-count against the real sale when the stock is eventually dispensed. The branch-level
  movement is already in the stock ledger.
- **`CN-0001`, the ₹15,750 credit note.** `JV-0001` books the *accepted payable* of ₹36,750, not the
  ₹52,500 the supplier claimed, so the ₹15,750 the credit note clears was never a liability in the
  books. Booking it again would take Trade Payables below what is actually owed.

Final position, all derived from the stock ledger:

| | Usable | Damaged | Dispensed | Missing |
| --- | --- | --- | --- | --- |
| Central Warehouse | 40 | 20 | — | — |
| Branch A | 25 | — | 5 | — |
| Never delivered | — | — | — | 10 |

`REQ-0001` sits at **PARTIALLY_FULFILLED**: 100 requested, 30 fulfilled, 70 outstanding. The 70
usable vials that reached the central warehouse are company stock but are not Branch A's fulfilment.

### Verification

```bash
# backend, no server required
npm run verify:scenario            # stock, money, document chain, ledger integrity
npm run verify:seed                # what the seed produced

npm run verify:accounting          # the books: balances, reports, isolation, reconciliation
npm run test                       # vitest: unit + integration (integration needs a database)
npm run test:unit                  # vitest: pure logic only, no database

# backend, against a running server (these leave documents behind - re-seed after)
npm run verify:controls            # concurrency, post-invoice corrections, invalid transfers
npm run verify:internal-fulfilment # inter-branch sourcing, transfers, isolation, concurrency
ALLOW_NOTIFICATION_RESET=true npm run verify:notifications

# frontend
npm run typecheck
npm run build
npm run smoke                      # server-renders every page with a stubbed session
npm run smoke:data                 # renders real payloads from a running, seeded backend
```
