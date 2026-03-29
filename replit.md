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

## Database Architecture (v4 — DINA Integrated)

**Single PostgreSQL database** (`darbby`) — 31 tables + PostGIS

### Core Darbby Tables (17)
1. **users** — Customer accounts with price_sensitivity score
2. **merchants** — Merchant accounts (PENDING → APPROVED, plans: FREE/BASIC/PRO/PREMIUM)
3. **merchant_branches** — Geographic branches with PostGIS location, service radius
4. **vehicle_profiles** — Customer vehicles (fuel type for targeted offers)
5. **trips** — Customer journeys with PostGIS route geometry + `accept_offers` flag
6. **product_categories** — Categories for products (supports DINA trip interests)
7. **products** — Merchant product catalog
8. **offers** — Offers sent by merchants to trip travelers
9. **offer_items** — Individual products in an offer
10. **negotiations** — Price negotiation rounds (USER/MERCHANT/SYSTEM sender)
11. **auto_negotiator_settings** — Legacy auto-negotiator config (superseded by DINA)
12. **auto_negotiator_products** — Legacy min/max discount (superseded by DINA)
13. **subscriptions** — Merchant subscription records
14. **transactions** — Financial transactions when offer accepted
15. **commission_ledger** — Platform commission tracking (1% PREMIUM / 2% FREE)
16. **system_operations_log** — Full Audit Trail (partitioned by month, JSONB old/new values)
17. **notifications** — Push notification feed for users and merchants

### DINA Tables (14) — Darbby Intelligent Negotiation Agent
- **dina_tenants** — Multi-tenant root (Darbby is default SAAS tenant)
- **dina_tenant_subscriptions** — Per-tenant billing subscriptions
- **dina_merchants** — DINA merchant enrollment (links to external_merchant_id)
- **dina_constraints** — Negotiation boundaries (min/max discount, step, rounds)
- **dina_constraint_products** — Products linked to negotiation constraints
- **dina_trip_interests** — What each trip wants (categories/subcategories)
- **dina_sessions** — Full negotiation session record (trigger_checks JSONB)
- **dina_rounds** — Each individual negotiation round with decision factors
- **dina_hitl_requests** — Human-in-the-Loop approvals for Level 1 merchants
- **dina_barcodes** — QR/Barcode generated after deal closed
- **dina_barcode_transfers** — Branch transfer tracking
- **dina_learning_events** — AI learning events from each session
- **dina_customer_profiles** — Per-customer negotiation behavior profile
- **dina_merchant_profiles** — Per-merchant performance profile & recommendations

### DINA Integration Map
- **DINA reads**: trips.route_geom, trips.accept_offers, merchant_branches.location, products, merchants.subscription_plan, users.price_sensitivity
- **DINA writes**: negotiations (is_auto=TRUE), offers.status, users.price_sensitivity, notifications
- **DINA NEVER touches**: transactions, commission_ledger, subscriptions, merchant_branches (data)

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

## Critical Notes

- **fuelType enum** (PostgreSQL): `PETROL_91`, `PETROL_95`, `DIESEL`, `ELECTRIC`, `HYBRID` — NOT `PETROL`
- **db.execute() pattern**: Always use `dbRows<T>(result)` helper to extract rows — never destructure directly. Added in trips.ts, merchant.ts, and offers.ts
- **offer.items**: Returns mapped array of `{ id, offerId, productId, productName, quantity, unitPrice, lineTotal }`
- **Commission rates**: 1% PREMIUM, 2% FREE — auto-calculated on offer ACCEPTED
- **Seed script**: `npx tsx scripts/seed-demo.ts` — cleans and recreates all demo data
- **Demo accounts**: Travelers: ahmed@demo.com / sara@demo.com | Merchants: gulf@demo.com / food@demo.com / hotel@demo.com — all password `demo1234`

## Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/darbby run dev` — Start frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from spec
- `pnpm --filter @workspace/db run push` — Push schema to DB
