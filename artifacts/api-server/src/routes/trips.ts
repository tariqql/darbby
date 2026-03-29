import { Router } from "express";
import { sharedDb, merchantsDb, trips, offers } from "@workspace/db";
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
    destinationName, destLat, destLng, routePolyline,
    departureTime, arrivalTime, vehicleProfileId, isPublic,
  } = req.body;

  if (!originName || !destinationName || !departureTime || !tripPurpose) {
    res.status(400).json({ error: "originName, destinationName, departureTime, tripPurpose are required" });
    return;
  }

  let polyline = routePolyline;
  if (!polyline && originLat && originLng && destLat && destLng) {
    try {
      const route = await getRouteFromGoogle(originLat, originLng, destLat, destLng);
      polyline = route.polyline;
    } catch {
      // continue without polyline
    }
  }

  const originGeog = `SRID=4326;POINT(${originLng ?? 0} ${originLat ?? 0})`;
  const destGeog = `SRID=4326;POINT(${destLng ?? 0} ${destLat ?? 0})`;

  const raw = await sharedDb.execute<any>(sql`
    INSERT INTO trips (
      id, user_id, vehicle_profile_id, title, trip_purpose,
      origin_name, origin, destination_name, destination,
      route_polyline, departure_time, arrival_time, is_public, status
    ) VALUES (
      uuid_generate_v4(), ${id}::uuid, ${vehicleProfileId ?? null}::uuid, ${title ?? null},
      ${tripPurpose}::trip_purpose,
      ${originName}, ST_GeogFromText(${originGeog}),
      ${destinationName}, ST_GeogFromText(${destGeog}),
      ${polyline ?? null}, ${departureTime}::timestamptz, ${arrivalTime ?? null}::timestamptz,
      ${isPublic !== false}, 'ACTIVE'
    ) RETURNING *
  `);
  const trip = dbRows<any>(raw)[0];

  await writeAuditLog({ tableName: "trips", recordId: trip.id, operation: "INSERT", actorType: "USER", actorId: id, newValues: { originName, destinationName, tripPurpose }, ipAddress: req.ip });
  res.status(201).json(trip);
});

// GET /api/trips/:id
router.get("/:id", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;

  const raw = await sharedDb.execute<any>(sql`SELECT * FROM trips WHERE id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1`);
  const trip = dbRows<any>(raw)[0];
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

  const existingRaw = await sharedDb.execute<any>(sql`SELECT * FROM trips WHERE id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1`);
  const existing = dbRows<any>(existingRaw)[0];
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const updatedRaw = await sharedDb.execute<any>(sql`
    UPDATE trips SET status = ${status}::trip_status, updated_at = NOW()
    WHERE id = ${id}::uuid RETURNING *
  `);
  const updated = dbRows<any>(updatedRaw)[0];

  await writeAuditLog({
    tableName: "trips", recordId: id, operation: "STATUS_CHANGE", actorType: "USER", actorId: userId,
    oldValues: { status: existing.status }, newValues: { status }, changedFields: ["status"],
  });
  res.json(updated);
});

// GET /api/trips/:id/nearby-merchants
// Cross-DB: trips in sharedDb, merchant_branches/merchants in merchantsDb
router.get("/:id/nearby-merchants", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;

  const tripRaw = await sharedDb.execute<any>(sql`SELECT id, route_geom, status FROM trips WHERE id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1`);
  const trip = dbRows<any>(tripRaw)[0];
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }
  if (!trip.route_geom) { res.json([]); return; }

  // Get route geometry as EWKT from sharedDb
  const routeWktRaw = await sharedDb.execute<any>(sql`SELECT ST_AsEWKT(route_geom) AS ewkt FROM trips WHERE id = ${id}::uuid LIMIT 1`);
  const routeEwkt: string = dbRows<any>(routeWktRaw)[0]?.ewkt;
  if (!routeEwkt) { res.json([]); return; }

  // Query merchant_branches within route in merchantsDb
  const nearby = await merchantsDb.execute<any>(sql`
    SELECT
      mb.id AS branch_id,
      mb.merchant_id,
      m.business_name,
      mb.branch_name,
      mb.address_text,
      mb.service_radius_km,
      ST_Distance(mb.location::geometry, ST_ClosestPoint(ST_GeomFromEWKT(${routeEwkt})::geometry, mb.location::geometry)) AS dist_meters
    FROM merchant_branches mb
    JOIN merchants m ON m.id = mb.merchant_id
    WHERE mb.status = 'ACTIVE'
      AND m.status = 'APPROVED'
      AND m.is_active = TRUE
      AND ST_DWithin(mb.location::geometry, ST_GeomFromEWKT(${routeEwkt})::geometry, mb.service_radius_km * 1000)
    ORDER BY dist_meters ASC
    LIMIT 50
  `);

  res.json(dbRows(nearby));
});

export default router;
