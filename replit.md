# Darbby Platform

## Overview

Smart travel platform connecting travelers (customers) with merchants (fuel stations, restaurants, hotels) along their route. Travelers post trips, merchants send targeted offers, and an AI auto-negotiator handles price negotiations automatically.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (Node.js)
- **Database**: PostgreSQL + PostGIS + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Frontends**: React + Vite × 2 — `artifacts/client-app` (travelers) + `artifacts/merchant-portal` (merchants)

## Database Architecture (v5 — 5-Database Split)

**5 separate PostgreSQL databases** on same cluster (host: `helium`). No cross-DB FK constraints — UUIDs used as plain columns, joins handled at application level.

### 1. darbby_customers
- **users** — Customer accounts with price_sensitivity score
- **vehicle_profiles** — Customer vehicles (fuel type for targeted offers)
- Connection: `customersDb` via `buildDbUrl("darbby_customers")`

### 2. darbby_merchants (PostGIS enabled)
- **merchants** — Merchant accounts (PENDING → APPROVED, plans: FREE/BASIC/PRO/PREMIUM)
- **merchant_branches** — Geographic branches with PostGIS location, service radius
- **products** — Merchant product catalog
- **product_categories** — Categories for products (supports DINA trip interests)
- **subscriptions** — Merchant subscription records
- **auto_negotiator_settings** — Auto-negotiator config per merchant
- **auto_negotiator_products** — Min/max discount per product
- Connection: `merchantsDb` via `buildDbUrl("darbby_merchants")`

### 3. darbby_shared (PostGIS enabled)
- **trips** — Customer journeys with PostGIS route geometry + `accept_offers` flag
- **offers** — Offers sent by merchants to trip travelers
- **offer_items** — Individual products in an offer
- **negotiations** — Price negotiation rounds (USER/MERCHANT/SYSTEM sender)
- **transactions** — Financial transactions when offer accepted
- **commission_ledger** — Platform commission tracking (1% PREMIUM / 2% FREE)
- **notifications** — Push notification feed for users and merchants
- **system_operations_log** — Full Audit Trail (JSONB old/new values)
- Connection: `sharedDb` via `buildDbUrl("darbby_shared")`

### 4. darbby_staff
- **staff_users** — Admin/support staff accounts (roles: SUPER_ADMIN, ADMIN, SUPPORT, FINANCE, MODERATOR)
- **audit_log** — Staff action audit trail
- Connection: `staffDb` via `buildDbUrl("darbby_staff")`

### 5. darbby_dina — DINA Engine (Darbby Intelligent Negotiation Agent)
- **dina_tenants** — Multi-tenant root (Darbby is default SAAS tenant)
- **dina_tenant_subscriptions** — Per-tenant billing subscriptions
- **dina_merchants** — DINA merchant enrollment (links to external_merchant_id)
- **dina_constraints** — Negotiation boundaries (min/max discount, step, rounds)
- **dina_constraint_products** — Products linked to negotiation constraints
- **dina_trip_interests** — What each trip wants (categories/subcategories)
- **dina_sessions** — Full negotiation session record
- **dina_rounds** — Each individual negotiation round with decision factors
- **dina_hitl_requests** — Human-in-the-Loop approvals for Level 1 merchants
- **dina_barcodes** — QR/Barcode generated after deal closed
- **dina_barcode_transfers** — Branch transfer tracking
- **dina_learning_events** — AI learning events from each session
- **dina_customer_profiles** — Per-customer negotiation behavior profile
- **dina_merchant_profiles** — Per-merchant performance profile & recommendations
- Connection: `dinaDb` via `buildDbUrl("darbby_dina")`

### Cross-DB Query Pattern
Queries spanning databases are done at application level:
- Fetch from DB A, extract IDs → query DB B with those IDs (e.g., offer_items + products)
- For PostGIS cross-DB: fetch geometry as EWKT from one DB, pass as parameter to other DB
- All data in shared tables (trips, offers, etc.) use UUID references to other DBs (no FK constraints)
- **IMPORTANT**: For cross-DB product name lookups, use `merchantsPool.query()` directly (not Drizzle `inArray`) — raw pg Pool avoids UUID type handling issues

### Dev Environment Reality (Replit PostgreSQL)
In Replit's PostgreSQL instance, all 5 logical databases exist as separate PostgreSQL databases under host `helium`:
- `heliumdb` — Replit default DB, holds a copy of all data from migrations/seeding
- `darbby_shared` — has trips, offers, offer_items, negotiations (actual live data)
- `darbby_customers` — has users, vehicle_profiles (actual live data)
- `darbby_merchants` — has merchants, branches, products (products must be seeded here separately)
- `darbby_dina` — has all DINA tables (actual live data)

**Gotcha**: The `products` table in `darbby_merchants` starts empty — if seeding only hits `heliumdb`, copy manually: `INSERT INTO products SELECT * FROM heliumdb.products` (connect to each DB separately).

## Structure

```text
darbby-monorepo/
├── artifacts/
│   ├── api-server/         # Express 5 API server (all backend routes)
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── auth.ts       # User + merchant JWT auth
│   │       │   ├── trips.ts      # 13 customer screens
│   │       │   ├── vehicles.ts   # Vehicle profiles
│   │       │   ├── offers.ts     # Accept/reject/counter
│   │       │   ├── merchant.ts   # 17 merchant screens
│   │       │   ├── notifications.ts
│   │       │   └── geo.ts        # Google Maps route
│   │       └── lib/
│   │           ├── auth.ts           # JWT sign/verify/middleware
│   │           ├── auditLog.ts       # system_operations_log writer
│   │           ├── autoNegotiator.ts # Auto-negotiator engine v3
│   │           └── geoUtils.ts       # Google Maps API + fallback
│   ├── client-app/         # React + Vite — Traveler app (/client/, port 21647)
│   │   └── src/
│   │       ├── pages/      # 9 traveler pages (UserDashboard, CreateTrip, etc.)
│   │       ├── components/ # AppLayout (user nav) + Radix UI components
│   │       ├── hooks/      # use-auth.ts — USER-only JWT auth (zustand)
│   │       └── lib/        # utils.ts, cn, formatCurrency
│   ├── merchant-portal/    # React + Vite — Merchant app (/merchant-portal/, port 21804)
│   │   └── src/
│   │       ├── pages/      # 12 merchant pages (MerchantDashboard, DINE, etc.)
│   │       ├── components/ # AppLayout (merchant nav) + Radix UI components
│   │       ├── hooks/      # use-auth.ts — MERCHANT-only JWT auth (zustand)
│   │       └── lib/        # utils.ts, cn, formatCurrency
│   └── darbby/             # Legacy combined React + Vite app (kept intact at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   └── db/
│       └── src/schema/     # Drizzle ORM table definitions
│           ├── users.ts
│           ├── merchants.ts
│           ├── vehicleProfiles.ts
│           ├── trips.ts
│           ├── merchantBranches.ts
│           ├── products.ts
│           ├── offers.ts
│           ├── negotiations.ts
│           ├── autoNegotiator.ts
│           ├── transactions.ts
│           └── notifications.ts
```

## API Endpoints

### Auth
- `POST /api/auth/user/register` — Register customer
- `POST /api/auth/user/login` — Login customer
- `POST /api/auth/merchant/register` — Register merchant
- `POST /api/auth/merchant/login` — Login merchant

### Customer (USER JWT required)
- `GET/POST /api/vehicles` — Vehicle profiles
- `PUT/DELETE /api/vehicles/:id` — Manage vehicles
- `GET/POST /api/trips` — Trips
- `GET/PATCH /api/trips/:id` — Trip detail / status update
- `GET /api/trips/:id/nearby-merchants` — Geo-matched merchants
- `GET /api/offers/:id` — Offer detail
- `POST /api/offers/:id/accept` — Accept offer → creates transaction + commission ledger
- `POST /api/offers/:id/reject` — Reject offer
- `POST /api/offers/:id/counter` — Counter-offer (negotiation round)
- `GET /api/notifications` — Notifications feed

### Merchant (MERCHANT JWT required)
- `GET/PUT /api/merchant/profile` — Merchant profile
- `GET /api/merchant/stats` — Dashboard stats
- `GET /api/merchant/commission` — Commission ledger summary
- `GET /api/merchant/trips` — Nearby active trips
- `POST /api/merchant/trips/:tripId/offer` — Send offer
- `GET /api/merchant/offers` — Sent offers list
- `POST /api/merchant/offers/:id/accept-counter` — Accept customer counter
- `POST /api/merchant/offers/:id/counter` — Merchant counter
- `GET/POST /api/merchant/branches` — Branch management
- `PUT/DELETE /api/merchant/branches/:id` — Update/delete branch
- `GET/POST /api/merchant/products` — Product catalog
- `PUT/DELETE /api/merchant/products/:id` — Update/delete product
- `GET/PUT /api/merchant/auto-negotiator` — Auto-negotiator settings

### Geo
- `POST /api/geo/route` — Get route polyline + distance (Google Maps or fallback)

## Business Logic

### Auto-Negotiator
- Checks `auto_negotiator_settings.is_enabled` before proceeding
- Applies `trip_purpose` rules (e.g. UMRAH → extra 5% discount)
- Uses `users.price_sensitivity` (0.0–1.0) to widen acceptable price range
- Calculates adjusted min discount: `minDiscount * (1 + sensitivity * 0.3)`
- If user's counter is within range → auto-accepts
- Otherwise sends a mid-range counter with `is_auto=true`
- Checks branch `working_hours` before sending

### Commission System
- On offer `ACCEPTED`: creates a `transactions` record
- Commission rate: 1% for PREMIUM merchants, 2% for FREE merchants
- Automatically creates `commission_ledger` entry with `PENDING` status
- Computed columns: `commission_amount` and `net_to_merchant` (GENERATED ALWAYS AS STORED)

### Geo-Matching
- Trip routes stored as `GEOGRAPHY(LINESTRING,4326)`
- Branch locations stored as `GEOGRAPHY(POINT,4326)`
- Matching uses `ST_DWithin(branch.location, trip.route_geom, radius_meters)`
- Distance computed via `ST_ClosestPoint` for accurate route proximity

### Audit Trail
- All status changes, inserts, updates written to `system_operations_log`
- Stores `old_values` and `new_values` as JSONB
- Partitioned by month (sol_YYYY_MM tables)

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `PORT` — API server port (auto-assigned by Replit)
- `SESSION_SECRET` — JWT signing secret
- `GOOGLE_MAPS_API_KEY` — Optional: enables real Google Maps routes (falls back to straight-line encoding)

## Frontend Screens

### Customer App (9 screens)
- `/` or `/login` — **AuthPage**: Login/Register with traveler/merchant tab switch
- `/user/trips` — **UserDashboard**: Trip list with status badges and departure time
- `/user/trips/new` — **CreateTrip**: New trip form with origin/destination + departure time
- `/user/trips/:id` — **TripDetail**: Trip info + received offers list
- `/user/offers/:id` — **UserOfferDetail**: Offer details, items, negotiation history, accept/reject/counter
- `/user/vehicles` — **VehicleList**: Vehicle cards with fuel type, plate, delete/edit
- `/user/vehicles/new` or `/user/vehicles/:id/edit` — **VehicleForm**: Add/edit vehicle form
- `/user/profile` — **UserProfile**: Account info, email, logout
- `/notifications` — **NotificationCenter**: Notification feed with mark-as-read

### Merchant App (11 screens)
- `/merchant/dashboard` — **MerchantDashboard**: Stats (revenue, offers, nearby trips) + weekly chart
- `/merchant/trips` — **NearbyTrips**: Active trips near branches, send offer CTA
- `/merchant/trips/:id/offer` — **SendOffer**: Send offer with product selection + auto-negotiator toggle
- `/merchant/offers` — **MerchantOffers**: Sent offers list with status + date
- `/merchant/offers/:id` — **MerchantOfferDetail**: Offer detail, negotiation history, accept/counter
- `/merchant/branches` — **BranchList**: Branch cards with coordinates, radius, active status
- `/merchant/branches/new` or `/:id/edit` — **BranchForm**: Add/edit branch location form
- `/merchant/products` — **ProductList**: Product catalog cards with price, category, availability
- `/merchant/products/new` or `/:id/edit` — **ProductForm**: Add/edit product form
- `/merchant/commission` — **CommissionLedger**: Commission summary cards + detailed table
- `/merchant/settings` — **MerchantSettings**: Profile edit form + auto-negotiator quick link
- `/merchant/auto-negotiator` — **AutoNegotiatorSettings**: Min/max discount, product selection

## DINA — Darbby Intelligent Negotiation Agent

Full negotiation engine across 5 tested scenarios (S10-S13), constraints (S01-S04), and trigger evaluation (S05-S09).

### DINA Constraints API (`POST/GET /api/dina/constraints`)
- Creates constraints with auto-calculated `max_rounds`
- Validates min < max and step ≤ range
- Detects expired constraints (S04)
- Sends merchant notification on CANCELLED sessions

### DINA Trigger Evaluation (`POST /api/dina/session/trigger`)
- Checks: `acceptOffers`, `routeWithinRadius`, `branchOpen` (working_hours JSONB), `interestMatch`, `hasConstraint`
- Logs CANCELLED session with `trigger_checks` JSONB on any failed check
- `dinaSkipReasonEnum`: NO_ACTIVE_TRIP | ROUTE_TOO_FAR | CUSTOMER_NO_OFFERS | INTEREST_MISMATCH | BRANCH_CLOSED | NO_POLICY | SUBSCRIPTION_EXPIRED

### DINA Negotiation Engine (`/api/dina/negotiate/*`)
- `POST /api/dina/negotiate/start` — Opens ACTIVE session, DINA sends first offer at minDiscountPct
- `POST /api/dina/negotiate/:sessionId/respond` — Customer responds: ACCEPT / REJECT / COUNTER_OFFER
- `GET /api/dina/negotiate/:sessionId` — Get session + all rounds

**Autonomy Levels:**
- `LEVEL_1`: Customer accept → HITL request created, merchant must approve within timeout
- `LEVEL_2`: Customer accept → DEAL_CLOSED immediately

**Outcomes:**
- `DEAL_CLOSED` — Agreement reached
- `REJECTED_BY_CUSTOMER` — Customer rejected all rounds (maxRounds reached) → merchant notified
- `PENDING_HITL_APPROVAL` — Level 1: waiting for merchant approval
- `DINA_COUNTER_OFFERED` — Customer counter > max → DINA offers at max
- `NEGOTIATING` — Round ongoing

### Auth Endpoints (complete)
- `POST /api/auth/user/register` — Register with email/phone uniqueness check + `23505` error handling
- `POST /api/auth/user/verify-otp` — Mock OTP: any 6-digit code → marks user as `is_verified=true`
- `POST /api/auth/user/login` — JWT login
- `POST /api/auth/merchant/register` — Merchant registration with phone+email uniqueness check
- `POST /api/auth/merchant/login` — Merchant JWT login

## Critical Notes

- **fuelType enum** (PostgreSQL): `PETROL_91`, `PETROL_95`, `DIESEL`, `ELECTRIC`, `HYBRID` — NOT `PETROL`
- **tripPurpose enum** (PostgreSQL): `WORK`, `TOURISM`, `UMRAH`, `FAMILY_VISIT`, `MEDICAL`, `EDUCATION`, `OTHER` — NOT `PERSONAL`
- **db.execute() pattern**: Always use `dbRows<T>(result)` helper to extract rows — never destructure directly. Added in trips.ts, merchant.ts, and offers.ts
- **Drizzle UUID null bug**: Drizzle ORM sends `""` (empty string) instead of `NULL` for nullable UUID columns. Use raw `sharedPool.query()` / `merchantsPool.query()` for any INSERT that has optional UUID columns (`branchId`, etc.)
- **PostGIS ROUND**: `ROUND(double_precision, integer)` fails in PostgreSQL — must cast: `ROUND(value::numeric, 1)`
- **commission_ledger NOT NULL columns**: `gross_amount`, `commission_rate_pct`, `commission_amount`, `net_to_merchant` are all required. `transaction_id` is nullable despite Drizzle schema saying otherwise.
- **offer.items**: Returns mapped array of `{ id, offerId, productId, productName, quantity, unitPrice, lineTotal }`
- **Commission rates**: 1% PREMIUM, 2% FREE — auto-calculated on offer ACCEPTED
- **Seed script**: `npx tsx scripts/seed-demo.ts` — cleans and recreates all demo data
- **Demo accounts**: Travelers: ahmed@demo.com / sara@demo.com | Merchants: gulf@demo.com / food@demo.com / hotel@demo.com — all password `demo1234`

## API Improvement Roadmap (Claude-generated, 4 phases)

### Phase 1 — Critical Bug Fixes ✅ COMPLETED
- `route_geom` computed via `ST_MakeLine` on trip creation (raw pool INSERT)
- `nearby-merchants` endpoint fixed: `ROUND(::numeric, 1)` + raw pool
- `branchId` null properly sent to DB (raw pool bypasses Drizzle UUID empty-string bug)
- `commission_ledger` INSERT includes all NOT NULL columns: `commission_amount`, `net_to_merchant`
- Trip creation accepts `estimatedDepartureAt` (ISO timestamp) OR `departureTime`
- All endpoints return camelCase via Drizzle re-fetch

### Phase 2 — Merchant Approval Workflow (PENDING)
- Merchants currently created as `PENDING` status → need admin approval flow
- Demo merchants must be `APPROVED` for `nearby-merchants` to return results

### Phase 3 — DINA + Claude Integration (PENDING)
- Power DINA negotiation engine with `claude-sonnet-4-6` via Replit AI Integration proxy
- Endpoint: `http://localhost:1106/modelfarm/anthropic`

### Phase 4 — Production Hardening (PENDING)
- Tests, performance optimization, deployment

## Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/darbby run dev` — Start frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from spec
- `pnpm --filter @workspace/db run push` — Push schema to DB
