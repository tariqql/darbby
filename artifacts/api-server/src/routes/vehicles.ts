import { Router } from "express";
import { db, vehicleProfiles } from "@workspace/db"
import { eq, and } from "drizzle-orm";
import { authenticate, requireActor } from "../lib/auth.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { JwtPayload } from "../lib/auth.js";

const router = Router();
router.use(authenticate);
router.use(requireActor("USER"));

function auth(req: any): JwtPayload { return req.auth; }

// GET /api/vehicles
router.get("/", async (req, res) => {
  const { id } = auth(req);
  const list = await db
    .select()
    .from(vehicleProfiles)
    .where(and(eq(vehicleProfiles.userId, id), eq(vehicleProfiles.isActive, true)));
  res.json(list);
});

// POST /api/vehicles
router.post("/", async (req, res) => {
  const { id } = auth(req);
  const { nickname, vehicleType, make, model, year, color, fuelType, plateNo, tankCapacityLiters, isPrimary } = req.body;

  if (!nickname || !vehicleType || !make || !model || !year || !fuelType) {
    res.status(400).json({ error: "Required fields missing" });
    return;
  }

  const [vehicle] = await db.insert(vehicleProfiles).values({
    userId: id,
    nickname, vehicleType, make, model, year, color, fuelType,
    plateNo: plateNo || null,
    tankCapacityLiters: tankCapacityLiters?.toString() || null,
    isPrimary: isPrimary || false,
  }).returning();

  await writeAuditLog({ tableName: "vehicle_profiles", recordId: vehicle.id, operation: "INSERT", actorType: "USER", actorId: id });
  res.status(201).json(vehicle);
});

// PUT /api/vehicles/:id
router.put("/:id", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;

  const [existing] = await db.select().from(vehicleProfiles)
    .where(and(eq(vehicleProfiles.id, id), eq(vehicleProfiles.userId, userId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Partial<typeof vehicleProfiles.$inferInsert> = {};
  const allowed = ["nickname", "vehicleType", "make", "model", "year", "color", "fuelType", "plateNo", "tankCapacityLiters", "isPrimary"] as const;
  for (const key of allowed) {
    if (req.body[key] !== undefined) (updates as any)[key] = req.body[key];
  }
  (updates as any).updatedAt = new Date();

  const [updated] = await db.update(vehicleProfiles).set(updates).where(eq(vehicleProfiles.id, id)).returning();
  await writeAuditLog({ tableName: "vehicle_profiles", recordId: id, operation: "UPDATE", actorType: "USER", actorId: userId, oldValues: existing as any, newValues: updated as any });
  res.json(updated);
});

// DELETE /api/vehicles/:id
router.delete("/:id", async (req, res) => {
  const { id: userId } = auth(req);
  const { id } = req.params;

  const [existing] = await db.select().from(vehicleProfiles)
    .where(and(eq(vehicleProfiles.id, id), eq(vehicleProfiles.userId, userId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(vehicleProfiles).set({ isActive: false, updatedAt: new Date() }).where(eq(vehicleProfiles.id, id));
  res.status(204).end();
});

export default router;
