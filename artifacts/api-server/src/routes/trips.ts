import { Router } from "express";
import { db, trips, offers, merchantBranches, merchants } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, requireActor, JwtPayload } from "../lib/auth.js";
import { getRouteFromGoogle } from "../lib/geoUtils.js";
import { writeAuditLog } from "../lib/auditLog.js";

const router = Router();
router.use(authenticate);
router.use(requireActor("USER"));

function auth(req: any): JwtPayload { return req.auth; }

// GET /api/trips
router.get("/", async (req, res) => {
  const { id } = auth(req);
  const statusFilter = req.query.status as string | undefined;

  const conditions = [eq(trips.userId, id)];
  if (statusFilter) conditions.push(sql`${trips.status} = ${statusFilter}::trip_status`);

  const list = await db.select().from(trips).where(and(...conditions)).orderBy(sql`${trips.createdAt} DESC`);
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

  const originGeog = `SRID=4326;POINT(${originLng} ${originLat})`;
  const destGeog = `SRID=4326;POINT(${destLng} ${destLat})`;
  const routeGeog = polyline ? null : null;

  const [trip] = await db.execute<any>(sql`
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

  await writeAuditLog({ tableName: "trips", recordId: trip.id, operation: "INSERT", actorType: "USER", actorId: id, newValues: { originName, destinationName, tripPurpose }, ipAddress: req.ip });
  res.status(201).json(trip);
});

// GET /api/trips/:id
router.get("/:id", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;

  const [trip] = await db.execute<any>(sql`SELECT * FROM trips WHERE id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1`);
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }

  const tripOffers = await db.select().from(offers).where(eq(offers.tripId, id));
  res.json({ ...trip, offers: tripOffers });
});

// PATCH /api/trips/:id
router.patch("/:id", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;
  const { status } = req.body;

  if (!status) { res.status(400).json({ error: "status is required" }); return; }

  const [existing] = await db.execute<any>(sql`SELECT * FROM trips WHERE id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1`);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.execute<any>(sql`
    UPDATE trips SET status = ${status}::trip_status, updated_at = NOW()
    WHERE id = ${id}::uuid RETURNING *
  `);

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

  const [trip] = await db.execute<any>(sql`SELECT * FROM trips WHERE id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1`);
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }
  if (!trip.route_geom) {
    res.json([]);
    return;
  }

  const nearby = await db.execute<any>(sql`
    SELECT
      mb.id AS branch_id,
      mb.merchant_id,
      m.business_name,
      mb.branch_name,
      mb.address_text,
      mb.service_radius_km,
      ST_Distance(mb.location::geometry, ST_ClosestPoint(t.route_geom::geometry, mb.location::geometry)) AS dist_meters
    FROM merchant_branches mb
    JOIN merchants m ON m.id = mb.merchant_id
    CROSS JOIN trips t
    WHERE t.id = ${id}::uuid
      AND t.status = 'ACTIVE'
      AND mb.status = 'ACTIVE'
      AND m.status = 'APPROVED'
      AND m.is_active = TRUE
      AND ST_DWithin(mb.location::geometry, t.route_geom::geometry, mb.service_radius_km * 1000)
    ORDER BY dist_meters ASC
    LIMIT 50
  `);

  res.json(nearby);
});

export default router;
