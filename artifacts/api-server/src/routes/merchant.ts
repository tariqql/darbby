import { Router } from "express";
import { db, merchants, merchantBranches, products, offers, offerItems, negotiations, transactions, commissionLedger, autoNegotiatorSettings, autoNegotiatorProducts } from "@workspace/db"
import { eq, and, sql } from "drizzle-orm";
import { authenticate, requireActor, JwtPayload } from "../lib/auth.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { runAutoNegotiator } from "../lib/autoNegotiator.js";

const router = Router();
router.use(authenticate);
router.use(requireActor("MERCHANT"));

function auth(req: any): JwtPayload { return req.auth; }

/** Safely extract rows from db.execute() — handles both QueryResult and plain arrays */
function dbRows<T>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

async function getOfferWithDetails(offerId: string) {
  const [offer] = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  if (!offer) return null;
  const itemsRaw = await db.execute<any>(sql`
    SELECT oi.*, p.name as product_name FROM offer_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.offer_id = ${offerId}::uuid
  `);
  const negs = await db.select().from(negotiations).where(eq(negotiations.offerId, offerId));
  return { ...offer, items: dbRows(itemsRaw), negotiations: negs };
}

// ─── PROFILE ─────────────────────────────────────────────────────────────
router.get("/profile", async (req, res) => {
  const { id } = auth(req);
  const [m] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  if (!m) { res.status(404).json({ error: "Not found" }); return; }
  const { passwordHash, ...safe } = m;
  res.json(safe);
});

router.put("/profile", async (req, res) => {
  const { id } = auth(req);
  const { businessName, ownerName, phone, nationalAddress, fcmToken } = req.body;
  const [updated] = await db.update(merchants).set({
    ...(businessName && { businessName }),
    ...(ownerName && { ownerName }),
    ...(phone && { phone }),
    ...(nationalAddress !== undefined && { nationalAddress }),
    ...(fcmToken !== undefined && { fcmToken }),
    updatedAt: new Date(),
  }).where(eq(merchants.id, id)).returning();
  const { passwordHash, ...safe } = updated;
  res.json(safe);
});

// ─── STATS ────────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const { id } = auth(req);

  const statsRaw = await db.execute<any>(sql`
    SELECT
      COUNT(*)::int AS total_offers,
      SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS accepted_offers,
      SUM(CASE WHEN status IN ('SENT','VIEWED','NEGOTIATING') THEN 1 ELSE 0 END)::int AS pending_offers,
      COALESCE(SUM(CASE WHEN status = 'ACCEPTED' THEN final_price ELSE 0 END), 0) AS total_revenue
    FROM offers WHERE merchant_id = ${id}::uuid
  `);
  const stats = dbRows<any>(statsRaw)[0] ?? {};

  const nearbyRaw = await db.execute<any>(sql`
    SELECT COUNT(*)::int AS cnt
    FROM trips t
    JOIN merchant_branches mb ON mb.merchant_id = ${id}::uuid AND mb.status = 'ACTIVE'
    WHERE t.status = 'ACTIVE'
      AND t.route_geom IS NOT NULL
      AND ST_DWithin(mb.location::geometry, t.route_geom::geometry, mb.service_radius_km * 1000)
  `);
  const nearby = dbRows<any>(nearbyRaw)[0] ?? {};

  res.json({
    totalOffers: stats.total_offers || 0,
    acceptedOffers: stats.accepted_offers || 0,
    pendingOffers: stats.pending_offers || 0,
    totalRevenue: parseFloat(stats.total_revenue || "0"),
    activeTripsNearby: nearby.cnt || 0,
  });
});

// ─── COMMISSION ────────────────────────────────────────────────────────────
router.get("/commission", async (req, res) => {
  const { id } = auth(req);
  const summaryRaw = await db.execute<any>(sql`
    SELECT
      COUNT(*)::int AS total_deals,
      COALESCE(SUM(gross_amount), 0) AS total_gross,
      COALESCE(SUM(commission_amount), 0) AS total_commission,
      COALESCE(SUM(net_to_merchant), 0) AS total_net,
      COALESCE(SUM(CASE WHEN ledger_status='COLLECTED' THEN commission_amount ELSE 0 END), 0) AS collected,
      COALESCE(SUM(CASE WHEN ledger_status='PENDING' THEN commission_amount ELSE 0 END), 0) AS pending
    FROM commission_ledger WHERE merchant_id = ${id}::uuid
  `);
  const summary = dbRows<any>(summaryRaw)[0] ?? {};
  res.json({
    totalDeals: summary.total_deals || 0,
    totalGross: parseFloat(summary.total_gross || "0"),
    totalCommission: parseFloat(summary.total_commission || "0"),
    totalNet: parseFloat(summary.total_net || "0"),
    collected: parseFloat(summary.collected || "0"),
    pending: parseFloat(summary.pending || "0"),
  });
});

// ─── TRIPS (nearby) ────────────────────────────────────────────────────────
router.get("/trips", async (req, res) => {
  const { id } = auth(req);
  const branchId = req.query.branchId as string | undefined;

  let branchCondition = sql`mb.merchant_id = ${id}::uuid`;
  if (branchId) branchCondition = sql`mb.id = ${branchId}::uuid AND mb.merchant_id = ${id}::uuid`;

  const nearbyRaw = await db.execute<any>(sql`
    SELECT DISTINCT ON (t.id)
      t.*,
      mb.id AS matched_branch_id,
      mb.branch_name,
      ST_Distance(mb.location::geometry, ST_ClosestPoint(t.route_geom::geometry, mb.location::geometry)) AS dist_meters
    FROM trips t
    JOIN merchant_branches mb ON ${branchCondition}
    WHERE t.status = 'ACTIVE'
      AND mb.status = 'ACTIVE'
      AND t.route_geom IS NOT NULL
      AND ST_DWithin(mb.location::geometry, t.route_geom::geometry, mb.service_radius_km * 1000)
      AND NOT EXISTS (
        SELECT 1 FROM offers o WHERE o.trip_id = t.id AND o.merchant_id = ${id}::uuid
          AND o.status NOT IN ('CANCELLED','EXPIRED','REJECTED')
      )
    ORDER BY t.id, dist_meters ASC
    LIMIT 100
  `);

  res.json(dbRows(nearbyRaw));
});

// POST /api/merchant/trips/:tripId/offer — Send offer for a trip
router.post("/trips/:tripId/offer", async (req, res) => {
  const { id } = auth(req);
  const { tripId } = req.params;
  const { branchId, message, expiresAt, items } = req.body;

  if (!items?.length || !expiresAt) { res.status(400).json({ error: "items and expiresAt are required" }); return; }

  const tripRaw = await db.execute<any>(sql`SELECT * FROM trips WHERE id = ${tripId}::uuid AND status = 'ACTIVE' LIMIT 1`);
  const trip = dbRows<any>(tripRaw)[0];
  if (!trip) { res.status(404).json({ error: "Trip not found or not active" }); return; }

  const totalPrice = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);

  const [offer] = await db.insert(offers).values({
    tripId,
    merchantId: id,
    branchId: branchId || null,
    message: message || null,
    totalPrice: totalPrice.toString(),
    expiresAt: new Date(expiresAt),
    isAutoOffer: false,
  }).returning();

  for (const item of items) {
    await db.insert(offerItems).values({
      offerId: offer.id,
      productId: item.productId,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
    });
  }

  await writeAuditLog({ tableName: "offers", recordId: offer.id, operation: "INSERT", actorType: "MERCHANT", actorId: id, newValues: { tripId, totalPrice }, ipAddress: req.ip });

  const detail = await getOfferWithDetails(offer.id);
  res.status(201).json(detail);
});

// GET /api/merchant/offers
router.get("/offers", async (req, res) => {
  const { id } = auth(req);
  const page = parseInt(req.query.page as string || "1", 10);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const statusFilter = req.query.status as string | undefined;

  let whereClause = sql`merchant_id = ${id}::uuid`;
  if (statusFilter) whereClause = sql`merchant_id = ${id}::uuid AND status = ${statusFilter}::offer_status`;

  const countRaw = await db.execute<any>(sql`SELECT COUNT(*)::int AS total FROM offers WHERE ${whereClause}`);
  const total = (dbRows<any>(countRaw)[0] ?? {}).total ?? 0;
  const dataRaw = await db.execute<any>(sql`SELECT * FROM offers WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`);

  res.json({ data: dbRows(dataRaw), total, page, pageSize });
});

// POST /api/merchant/offers/:id/accept-counter — Merchant accepts customer counter
router.post("/offers/:id/accept-counter", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { id } = req.params;

  const [offer] = await db.select().from(offers).where(and(eq(offers.id, id), eq(offers.merchantId, merchantId))).limit(1);
  if (!offer) { res.status(404).json({ error: "Not found" }); return; }

  const lastNeg = await db.select().from(negotiations)
    .where(and(eq(negotiations.offerId, id), sql`sender_type = 'USER'`))
    .orderBy(sql`created_at DESC`).limit(1);

  const finalPrice = lastNeg[0]?.proposedPrice || offer.totalPrice;

  await db.update(offers).set({
    status: "ACCEPTED",
    finalPrice,
    respondedAt: new Date(),
    finalizedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(offers.id, id));

  await writeAuditLog({ tableName: "offers", recordId: id, operation: "STATUS_CHANGE", actorType: "MERCHANT", actorId: merchantId, oldValues: { status: offer.status }, newValues: { status: "ACCEPTED", finalPrice }, changedFields: ["status", "final_price"] });

  const detail = await getOfferWithDetails(id);
  res.json(detail);
});

// POST /api/merchant/offers/:id/counter — Merchant counter-offer
router.post("/offers/:id/counter", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { id } = req.params;
  const { proposedPrice, message } = req.body;

  if (!proposedPrice) { res.status(400).json({ error: "proposedPrice required" }); return; }

  const [offer] = await db.select().from(offers).where(and(eq(offers.id, id), eq(offers.merchantId, merchantId))).limit(1);
  if (!offer) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(offers).set({ status: "NEGOTIATING", updatedAt: new Date() }).where(eq(offers.id, id));

  const [neg] = await db.insert(negotiations).values({
    offerId: id,
    senderType: "MERCHANT",
    proposedPrice: proposedPrice.toString(),
    message: message || null,
    isAuto: false,
  }).returning();

  res.json(neg);
});

// ─── BRANCHES ─────────────────────────────────────────────────────────────
router.get("/branches", async (req, res) => {
  const { id } = auth(req);
  const raw = await db.execute<any>(sql`
    SELECT *, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
    FROM merchant_branches WHERE merchant_id = ${id}::uuid ORDER BY created_at ASC
  `);
  res.json(dbRows(raw));
});

router.post("/branches", async (req, res) => {
  const { id } = auth(req);
  const { branchName, branchCode, lat, lng, addressText, serviceRadiusKm, isPrimary, workingHours, phone } = req.body;

  if (!branchName || lat === undefined || lng === undefined) {
    res.status(400).json({ error: "branchName, lat, lng are required" });
    return;
  }

  const geog = `SRID=4326;POINT(${lng} ${lat})`;
  const branchRaw = await db.execute<any>(sql`
    INSERT INTO merchant_branches (id, merchant_id, branch_name, branch_code, location, address_text, service_radius_km, is_primary, working_hours, phone)
    VALUES (uuid_generate_v4(), ${id}::uuid, ${branchName}, ${branchCode ?? null}, ST_GeogFromText(${geog}),
      ${addressText ?? null}, ${serviceRadiusKm ?? 10.0}, ${isPrimary ?? false},
      ${workingHours ? JSON.stringify(workingHours) : null}::jsonb, ${phone ?? null})
    RETURNING *, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
  `);
  const branch = dbRows<any>(branchRaw)[0];

  await writeAuditLog({ tableName: "merchant_branches", recordId: branch.id, operation: "INSERT", actorType: "MERCHANT", actorId: id, newValues: { branchName, lat, lng } });
  res.status(201).json(branch);
});

router.put("/branches/:id", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { id } = req.params;
  const { branchName, branchCode, lat, lng, addressText, serviceRadiusKm, isPrimary, workingHours, phone, status } = req.body;

  const existingRaw = await db.execute<any>(sql`SELECT * FROM merchant_branches WHERE id = ${id}::uuid AND merchant_id = ${merchantId}::uuid LIMIT 1`);
  const existing = dbRows<any>(existingRaw)[0];
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  let geogUpdate = sql`location = location`;
  if (lat !== undefined && lng !== undefined) {
    geogUpdate = sql`location = ST_GeogFromText(${`SRID=4326;POINT(${lng} ${lat})`})`;
  }

  const updatedRaw = await db.execute<any>(sql`
    UPDATE merchant_branches SET
      branch_name = COALESCE(${branchName ?? null}, branch_name),
      branch_code = COALESCE(${branchCode ?? null}, branch_code),
      ${geogUpdate},
      address_text = COALESCE(${addressText ?? null}, address_text),
      service_radius_km = COALESCE(${serviceRadiusKm ?? null}, service_radius_km),
      is_primary = COALESCE(${isPrimary ?? null}, is_primary),
      working_hours = COALESCE(${workingHours ? JSON.stringify(workingHours) : null}::jsonb, working_hours),
      phone = COALESCE(${phone ?? null}, phone),
      status = COALESCE(${status ?? null}::branch_status, status),
      updated_at = NOW()
    WHERE id = ${id}::uuid AND merchant_id = ${merchantId}::uuid
    RETURNING *, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
  `);
  const updated = dbRows<any>(updatedRaw)[0];

  res.json(updated);
});

router.delete("/branches/:id", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { id } = req.params;
  await db.execute(sql`DELETE FROM merchant_branches WHERE id = ${id}::uuid AND merchant_id = ${merchantId}::uuid`);
  res.status(204).end();
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────
router.get("/products", async (req, res) => {
  const { id } = auth(req);
  const list = await db.select().from(products).where(eq(products.merchantId, id));
  res.json(list);
});

router.post("/products", async (req, res) => {
  const { id } = auth(req);
  const { name, description, price, category, targetFuelType, images, stockQty, isAvailable } = req.body;
  if (!name || price === undefined) { res.status(400).json({ error: "name and price are required" }); return; }

  const [product] = await db.insert(products).values({
    merchantId: id,
    name, description: description || null,
    price: price.toString(),
    category: category || null,
    targetFuelType: targetFuelType || null,
    images: images || null,
    stockQty: stockQty ?? 0,
    isAvailable: isAvailable !== false,
  }).returning();
  res.status(201).json(product);
});

router.put("/products/:id", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { id } = req.params;
  const { name, description, price, category, targetFuelType, images, stockQty, isAvailable } = req.body;

  const [existing] = await db.select().from(products).where(and(eq(products.id, id), eq(products.merchantId, merchantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(products).set({
    ...(name && { name }),
    ...(description !== undefined && { description }),
    ...(price !== undefined && { price: price.toString() }),
    ...(category !== undefined && { category }),
    ...(targetFuelType !== undefined && { targetFuelType }),
    ...(images !== undefined && { images }),
    ...(stockQty !== undefined && { stockQty }),
    ...(isAvailable !== undefined && { isAvailable }),
    updatedAt: new Date(),
  }).where(eq(products.id, id)).returning();
  res.json(updated);
});

router.delete("/products/:id", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { id } = req.params;
  await db.update(products).set({ isAvailable: false, updatedAt: new Date() }).where(and(eq(products.id, id), eq(products.merchantId, merchantId)));
  res.status(204).end();
});

// ─── AUTO-NEGOTIATOR ──────────────────────────────────────────────────────
router.get("/auto-negotiator", async (req, res) => {
  const { id } = auth(req);
  const [settings] = await db.select().from(autoNegotiatorSettings).where(eq(autoNegotiatorSettings.merchantId, id)).limit(1);
  if (!settings) { res.status(404).json({ error: "Not configured" }); return; }

  const prodsRaw = await db.execute<any>(sql`
    SELECT anp.*, p.name as product_name FROM auto_negotiator_products anp
    JOIN products p ON p.id = anp.product_id
    WHERE anp.negotiator_id = ${settings.id}::uuid
  `);

  res.json({ ...settings, products: dbRows(prodsRaw) });
});

router.put("/auto-negotiator", async (req, res) => {
  const { id } = auth(req);
  const { isEnabled, responseDelayMin, purposeRules, products: prodRules } = req.body;

  let [settings] = await db.select().from(autoNegotiatorSettings).where(eq(autoNegotiatorSettings.merchantId, id)).limit(1);

  if (!settings) {
    [settings] = await db.insert(autoNegotiatorSettings).values({
      merchantId: id,
      isEnabled: isEnabled ?? false,
      responseDelayMin: responseDelayMin ?? 5,
      purposeRules: purposeRules ?? {},
    }).returning();
  } else {
    [settings] = await db.update(autoNegotiatorSettings).set({
      ...(isEnabled !== undefined && { isEnabled }),
      ...(responseDelayMin !== undefined && { responseDelayMin }),
      ...(purposeRules !== undefined && { purposeRules }),
      updatedAt: new Date(),
    }).where(eq(autoNegotiatorSettings.id, settings.id)).returning();
  }

  if (prodRules?.length) {
    await db.delete(autoNegotiatorProducts).where(eq(autoNegotiatorProducts.negotiatorId, settings.id));
    for (const p of prodRules) {
      const minPct = p.minDiscountPct ?? p.minDiscountPercent ?? 0;
      const maxPct = p.maxDiscountPct ?? p.maxDiscountPercent ?? 0;
      await db.insert(autoNegotiatorProducts).values({
        negotiatorId: settings.id,
        productId: p.productId,
        minDiscountPct: minPct.toString(),
        maxDiscountPct: maxPct.toString(),
      });
    }
  }

  const prodsRaw2 = await db.execute<any>(sql`
    SELECT anp.*, p.name as product_name FROM auto_negotiator_products anp
    JOIN products p ON p.id = anp.product_id
    WHERE anp.negotiator_id = ${settings.id}::uuid
  `);

  res.json({ ...settings, products: dbRows(prodsRaw2) });
});

export default router;
