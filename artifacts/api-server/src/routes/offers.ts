import { Router } from "express";
import { sharedDb, sharedPool, merchantsDb, merchantsPool, customersDb, offers, offerItems, negotiations, transactions, commissionLedger, products, users } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { authenticate, JwtPayload } from "../lib/auth.js";
import { writeAuditLog } from "../lib/auditLog.js";

const router = Router();
router.use(authenticate);

function auth(req: any): JwtPayload { return req.auth; }

function dbRows<T = any>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && Array.isArray(result.rows)) return result.rows as T[];
  return [] as T[];
}

// Cross-DB: offer_items in sharedDb, products in merchantsDb
async function getOfferWithDetails(offerId: string) {
  const [offer] = await sharedDb.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  if (!offer) return null;

  // Get offer items from sharedDb
  const rawItems = await sharedDb.select().from(offerItems).where(eq(offerItems.offerId, offerId));

  // Get product names from merchantsDb pool (cross-DB lookup)
  let productMap: Record<string, string> = {};
  if (rawItems.length) {
    try {
      const productIds = rawItems.map(i => i.productId);
      const placeholders = productIds.map((_, i) => `$${i + 1}`).join(",");
      const r = await merchantsPool.query<{ id: string; name: string }>(
        `SELECT id::text, name FROM products WHERE id::text IN (${placeholders})`,
        productIds
      );
      for (const p of r.rows) productMap[p.id] = p.name;
    } catch (e: any) {
      console.error("[offers] product lookup error:", e.message);
    }
  }

  const items = rawItems.map(r => ({
    id: r.id,
    offerId: r.offerId,
    productId: r.productId,
    productName: productMap[r.productId] ?? "Unknown",
    quantity: Number(r.quantity),
    unitPrice: parseFloat(r.unitPrice?.toString() ?? "0"),
    negotiatedPrice: r.negotiatedPrice ? parseFloat(r.negotiatedPrice.toString()) : null,
  }));

  const negs = await sharedDb.select().from(negotiations).where(eq(negotiations.offerId, offerId));

  return { ...offer, items, negotiations: negs };
}

// GET /api/offers/:id
router.get("/:id", async (req, res) => {
  const detail = await getOfferWithDetails(req.params.id);
  if (!detail) { res.status(404).json({ error: "Offer not found" }); return; }
  res.json(detail);
});

// POST /api/offers/:id/accept — Customer accepts
router.post("/:id/accept", async (req, res) => {
  const { id: userId, actor } = auth(req);
  if (actor !== "USER") { res.status(403).json({ error: "Forbidden" }); return; }
  const { id } = req.params;

  const [offer] = await sharedDb.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!offer) { res.status(404).json({ error: "Not found" }); return; }

  if (!["SENT", "VIEWED", "NEGOTIATING"].includes(offer.status!)) {
    res.status(400).json({ error: "Offer cannot be accepted in its current state" });
    return;
  }

  const oldStatus = offer.status;
  const finalPrice = offer.finalPrice || offer.totalPrice;

  const [updatedOffer] = await sharedDb.update(offers).set({
    status: "ACCEPTED",
    finalPrice,
    respondedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(offers.id, id)).returning();

  // Get merchant subscription plan from merchantsDb
  const merchantRaw = await merchantsDb.execute<any>(sql`SELECT subscription_plan FROM merchants WHERE id = ${offer.merchantId}::uuid LIMIT 1`);
  const merchant = dbRows<any>(merchantRaw)[0];
  const commissionPct = merchant?.subscription_plan === "PREMIUM" ? 1.0 : 2.0;
  const grossAmt = parseFloat(finalPrice!.toString());
  const commissionAmt = parseFloat((grossAmt * commissionPct / 100).toFixed(2));
  const netAmt = parseFloat((grossAmt - commissionAmt).toFixed(2));

  // Create transaction in sharedDb
  const [txn] = await sharedDb.insert(transactions).values({
    offerId: id,
    merchantId: offer.merchantId,
    grossAmount: grossAmt.toString(),
    commissionPct: commissionPct.toString(),
    commissionAmt: commissionAmt.toString(),
    netAmount: netAmt.toString(),
    status: "COMPLETED",
    settledAt: new Date(),
  }).returning();

  // Create commission ledger entry — raw pool guarantees NULL (not "") for branchId
  // All NOT NULL columns: offer_id, merchant_id, gross_amount, commission_rate_pct, commission_amount, net_to_merchant
  await sharedPool.query(
    `INSERT INTO commission_ledger
       (offer_id, transaction_id, merchant_id, branch_id,
        gross_amount, commission_rate_pct, commission_amount, net_to_merchant, ledger_status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, 'PENDING')`,
    [id, txn.id, offer.merchantId, offer.branchId ?? null,
     grossAmt.toString(), commissionPct.toString(), commissionAmt.toString(), netAmt.toString()]
  );

  // Update user price_sensitivity in customersDb using cross-DB data from sharedDb
  // First compute the new sensitivity from sharedDb
  const sensitivityRaw = await sharedDb.execute<any>(sql`
    SELECT COALESCE(AVG(
      CASE
        WHEN n.proposed_price < oi.unit_price * 0.95 THEN 1.0
        WHEN n.proposed_price < oi.unit_price * 0.98 THEN 0.6
        ELSE 0.2
      END
    ), 0.50) AS sensitivity
    FROM negotiations n
    JOIN offers o ON n.offer_id = o.id
    JOIN offer_items oi ON oi.offer_id = o.id
    JOIN trips t ON o.trip_id = t.id
    WHERE t.user_id = ${userId}::uuid
      AND n.sender_type = 'USER'
      AND n.created_at > NOW() - INTERVAL '90 days'
  `);
  const newSensitivity = dbRows<any>(sensitivityRaw)[0]?.sensitivity ?? "0.50";

  // Update in customersDb
  await customersDb.update(users)
    .set({ priceSensitivity: newSensitivity.toString() })
    .where(eq(users.id, userId));

  await writeAuditLog({
    tableName: "offers", recordId: id, operation: "STATUS_CHANGE", actorType: "USER", actorId: userId,
    oldValues: { status: oldStatus }, newValues: { status: "ACCEPTED", finalPrice }, changedFields: ["status", "final_price"],
  });

  const detail = await getOfferWithDetails(id);
  res.json(detail);
});

// POST /api/offers/:id/reject — Customer rejects
router.post("/:id/reject", async (req, res) => {
  const { id: userId, actor } = auth(req);
  if (actor !== "USER") { res.status(403).json({ error: "Forbidden" }); return; }
  const { id } = req.params;

  const [offer] = await sharedDb.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!offer) { res.status(404).json({ error: "Not found" }); return; }

  await sharedDb.update(offers).set({ status: "REJECTED", respondedAt: new Date(), updatedAt: new Date() }).where(eq(offers.id, id));

  await writeAuditLog({ tableName: "offers", recordId: id, operation: "STATUS_CHANGE", actorType: "USER", actorId: userId, oldValues: { status: offer.status }, newValues: { status: "REJECTED" }, changedFields: ["status"] });

  const detail = await getOfferWithDetails(id);
  res.json(detail);
});

// POST /api/offers/:id/counter — Customer counter-offer
router.post("/:id/counter", async (req, res) => {
  const { id: userId, actor } = auth(req);
  if (actor !== "USER") { res.status(403).json({ error: "Forbidden" }); return; }
  const { id } = req.params;
  const { proposedPrice, message } = req.body;

  if (!proposedPrice) { res.status(400).json({ error: "proposedPrice is required" }); return; }

  const [offer] = await sharedDb.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!offer) { res.status(404).json({ error: "Not found" }); return; }

  const [user] = await customersDb.select({ priceSensitivity: users.priceSensitivity }).from(users).where(eq(users.id, userId)).limit(1);

  await sharedDb.update(offers).set({ status: "NEGOTIATING", updatedAt: new Date() }).where(eq(offers.id, id));

  const [neg] = await sharedDb.insert(negotiations).values({
    offerId: id,
    senderType: "USER",
    proposedPrice: proposedPrice.toString(),
    message: message || null,
    isAuto: false,
    priceSensitivitySnapshot: user?.priceSensitivity || "0.50",
  }).returning();

  res.json(neg);
});

export default router;
