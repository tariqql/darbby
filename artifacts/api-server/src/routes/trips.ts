import { Router } from "express";
import { sharedDb, sharedPool, merchantsPool, trips, offers } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, requireActor, JwtPayload } from "../lib/auth.js";
import { getRouteFromGoogle } from "../lib/geoUtils.js";
import { writeAuditLog } from "../lib/auditLog.js";

const router = Router();
router.use(authenticate);
router.use(requireActor("USER"));

function auth(req: any): JwtPayload { return req.auth; }

function dbRows<T>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

// GET /api/trips
router.get("/", async (req, res) => {
  const { id } = auth(req);
  const statusFilter = req.query.status as string | undefined;

  const conditions = [eq(trips.userId, id)];
  if (statusFilter) conditions.push(sql`${trips.status} = ${statusFilter}::trip_status`);

  const list = await sharedDb.select().from(trips).where(and(...conditions)).orderBy(sql`${trips.createdAt} DESC`);
  res.json(list);
});

// POST /api/trips
router.post("/", async (req, res) => {
  const { id } = auth(req);
  const {
    title, tripPurpose, originName, originLat, originLng,
    destinationName, routePolyline,
    arrivalTime, vehicleProfileId, isPublic,
  } = req.body;

  // Accept both destLat/destLng and destinationLat/destinationLng
  const destLat: number | undefined = req.body.destLat ?? req.body.destinationLat;
  const destLng: number | undefined = req.body.destLng ?? req.body.destinationLng;

  // Accept estimatedDepartureAt (ISO timestamp) or departureTime (ISO timestamp)
  const departureTime: string | undefined = req.body.estimatedDepartureAt ?? req.body.departureTime;

  if (!originName || !destinationName || !tripPurpose) {
    res.status(400).json({ error: "originName, destinationName, tripPurpose are required" });
    return;
  }

  // Try Google Maps polyline first, fall back gracefully
  let polyline = routePolyline;
  if (!polyline && originLat && originLng && destLat && destLng) {
    try {
      const route = await getRouteFromGoogle(originLat, originLng, destLat, destLng);
      polyline = route.polyline;
    } catch {
      // continue without polyline
    }
  }

  const oLat = originLat ?? 0;
  const oLng = originLng ?? 0;
  const dLat = destLat ?? 0;
  const dLng = destLng ?? 0;

  const originGeog = `SRID=4326;POINT(${oLng} ${oLat})`;
  const destGeog   = `SRID=4326;POINT(${dLng} ${dLat})`;

  // Raw pool INSERT — avoids Drizzle null/UUID serialization issues; PostGIS on sharedDb
  const raw = await sharedPool.query(
    `INSERT INTO trips (
       id, user_id, vehicle_profile_id, title, trip_purpose,
       origin_name, origin, destination_name, destination,
       route_polyline, route_geom,
       departure_time, arrival_time, is_public, status
     ) VALUES (
       gen_random_uuid(),
       $1::uuid,
       $2::uuid,
       $3,
       $4::trip_purpose,
       $5, ST_GeogFromText($6),
       $7, ST_GeogFromText($8),
       $9,
       ST_MakeLine(
         ST_SetSRID(ST_MakePoint($10, $11), 4326),
         ST_SetSRID(ST_MakePoint($12, $13), 4326)
       ),
       $14::timestamptz,
       $15::timestamptz,
       $16,
       'ACTIVE'
     ) RETURNING id`,
    [
      id,
      vehicleProfileId || null,
      title || null,
      tripPurpose,
      originName, originGeog,
      destinationName, destGeog,
      polyline || null,
      oLng, oLat, dLng, dLat,
      departureTime ? new Date(departureTime).toISOString() : null,
      arrivalTime ? new Date(arrivalTime).toISOString() : null,
      isPublic !== false,
    ]
  );
  const tripId: string = raw.rows[0]?.id;

  // Re-fetch using Drizzle for consistent camelCase response
  const [trip] = await sharedDb.select().from(trips).where(eq(trips.id, tripId)).limit(1);

  // Count nearby merchants (non-blocking)
  let merchantsNotified = 0;
  if (oLat && oLng && dLat && dLng) {
    try {
      const routeWktRaw = await sharedDb.execute<any>(sql`
        SELECT ST_AsEWKT(route_geom) AS ewkt FROM trips WHERE id = ${tripId}::uuid LIMIT 1
      `);
      const routeEwkt: string = dbRows<any>(routeWktRaw)[0]?.ewkt;
      if (routeEwkt) {
        const nearbyRaw = await merchantsPool.query(
          `SELECT COUNT(DISTINCT mb.merchant_id)::int AS cnt
           FROM merchant_branches mb
           JOIN merchants m ON m.id = mb.merchant_id
           WHERE mb.status = 'ACTIVE'
             AND m.status = 'APPROVED'
             AND m.is_active = TRUE
             AND ST_DWithin(
               mb.location::geometry,
               ST_GeomFromEWKT($1)::geometry,
               mb.service_radius_km * 1000
             )`,
          [routeEwkt]
        );
        merchantsNotified = nearbyRaw.rows[0]?.cnt ?? 0;
      }
    } catch {
      // Non-critical — trip already created
    }
  }

  await writeAuditLog({
    tableName: "trips", recordId: tripId, operation: "INSERT", actorType: "USER", actorId: id,
    newValues: { originName, destinationName, tripPurpose }, ipAddress: req.ip,
  });

  res.status(201).json({ ...trip, offers: [], merchantsNotified });
});

// GET /api/trips/:id
router.get("/:id", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;

  const [trip] = await sharedDb.select().from(trips).where(
    and(eq(trips.id, id), eq(trips.userId, userId))
  ).limit(1);
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }

  const tripOffers = await sharedDb.select().from(offers).where(eq(offers.tripId, id));
  res.json({ ...trip, offers: tripOffers });
});

// PATCH /api/trips/:id
router.patch("/:id", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;
  const { status } = req.body;

  if (!status) { res.status(400).json({ error: "status is required" }); return; }

  const existingRaw = await sharedDb.execute<any>(sql`SELECT id, status FROM trips WHERE id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1`);
  const existing = dbRows<any>(existingRaw)[0];
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await sharedDb.update(trips)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(trips.id, id))
    .returning();

  await writeAuditLog({
    tableName: "trips", recordId: id, operation: "STATUS_CHANGE", actorType: "USER", actorId: userId,
    oldValues: { status: existing.status }, newValues: { status }, changedFields: ["status"],
  });
  res.json(updated);
});

// GET /api/trips/:id/nearby-merchants
router.get("/:id/nearby-merchants", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;

  const tripRaw = await sharedDb.execute<any>(sql`SELECT id, route_geom, status FROM trips WHERE id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1`);
  const trip = dbRows<any>(tripRaw)[0];
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }
  if (!trip.route_geom) { res.json([]); return; }

  const routeWktRaw = await sharedDb.execute<any>(sql`SELECT ST_AsEWKT(route_geom) AS ewkt FROM trips WHERE id = ${id}::uuid LIMIT 1`);
  const routeEwkt: string = dbRows<any>(routeWktRaw)[0]?.ewkt;
  if (!routeEwkt) { res.json([]); return; }

  // Use raw pool — Drizzle alias case-folding causes issues with ORDER BY on computed columns
  const nearby = await merchantsPool.query(
    `SELECT
       mb.id           AS "branchId",
       mb.merchant_id  AS "merchantId",
       m.business_name AS "businessName",
       mb.branch_name  AS "branchName",
       mb.address_text AS "addressText",
       mb.service_radius_km AS "serviceRadiusKm",
       ROUND(
         (ST_Distance(
           mb.location::geometry,
           ST_ClosestPoint(ST_GeomFromEWKT($1)::geometry, mb.location::geometry)
         ) / 1000)::numeric
       , 1) AS "distanceKm"
     FROM merchant_branches mb
     JOIN merchants m ON m.id = mb.merchant_id
     WHERE mb.status = 'ACTIVE'
       AND m.status = 'APPROVED'
       AND m.is_active = TRUE
       AND ST_DWithin(
         mb.location::geometry,
         ST_GeomFromEWKT($2)::geometry,
         mb.service_radius_km * 1000
       )
     ORDER BY "distanceKm" ASC
     LIMIT 50`,
    [routeEwkt, routeEwkt]
  );

  res.json(nearby.rows);
});

export default router;
