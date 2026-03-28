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
- **Frontend**: React + Vite (artifacts/darbby)

## Database Architecture (v3)

17 tables + PostGIS geographic support:
1. **users** — Customer accounts with price_sensitivity score
2. **merchants** — Merchant accounts (PENDING → APPROVED flow)
3. **merchant_branches** — Geographic branches with PostGIS location, service radius
4. **vehicle_profiles** — Customer vehicles (fuel type for targeted offers)
5. **trips** — Customer journeys with PostGIS route geometry + trip_purpose
6. **products** — Merchant product catalog
7. **offers** — Offers sent by merchants to trip travelers
8. **offer_items** — Individual products in an offer
9. **negotiations** — Price negotiation rounds (USER/MERCHANT/SYSTEM sender)
10. **auto_negotiator_settings** — Per-merchant auto-negotiator config
11. **auto_negotiator_products** — Min/max discount per product
12. **subscriptions** — Merchant subscription records
13. **transactions** — Financial transactions when offer accepted
14. **commission_ledger** — Platform commission tracking (1% PREMIUM / 2% FREE)
15. **system_operations_log** — Full Audit Trail (partitioned by month, JSONB old/new values)
16. **notifications** — Push notification feed for users and merchants
17. **operations** — Lightweight operation log

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
│   └── darbby/             # React + Vite frontend
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

## Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/darbby run dev` — Start frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from spec
- `pnpm --filter @workspace/db run push` — Push schema to DB
