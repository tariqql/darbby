import { Router } from "express";
import { db, offers, offerItems, negotiations, transactions, commissionLedger, products, users } from "@workspace/db"
import { eq, and, sql } from "drizzle-orm";
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

async function getOfferWithDetails(offerId: string) {
  const [offer] = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  if (!offer) return null;

  const itemsRaw = await db.execute<any>(sql`
    SELECT oi.*, p.name as product_name, oi.unit_price as "unitPrice", oi.quantity as quantity
    FROM offer_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.offer_id = ${offerId}::uuid
  `);

  const items = dbRows(itemsRaw).map((r: any) => ({
    id: r.id,
    offerId: r.offer_id,
    productId: r.product_id,
    productName: r.product_name || r.name,
    quantity: Number(r.quantity),
    unitPrice: parseFloat(r.unit_price || r.unitPrice || 0),
    discountPct: parseFloat(r.discount_pct || 0),
    lineTotal: parseFloat(r.line_total || (r.unit_price * r.quantity) || 0),
  }));

  const negs = await db.select().from(negotiations).where(eq(negotiations.offerId, offerId));

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

  const [offer] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!offer) { res.status(404).json({ error: "Not found" }); return; }

  if (!["SENT", "VIEWED", "NEGOTIATING"].includes(offer.status!)) {
    res.status(400).json({ error: "Offer cannot be accepted in its current state" });
    return;
  }

  const oldStatus = offer.status;
  const finalPrice = offer.finalPrice || offer.totalPrice;

  const [updatedOffer] = await db.update(offers).set({
    status: "ACCEPTED",
    finalPrice,
    respondedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(offers.id, id)).returning();

  // Determine commission rate based on merchant subscription
  const merchantRaw = await db.execute<any>(sql`SELECT subscription_plan FROM merchants WHERE id = ${offer.merchantId}::uuid LIMIT 1`);
  const merchant = (Array.isArray(merchantRaw) ? merchantRaw : (merchantRaw?.rows ?? []))[0];
  const commissionPct = merchant?.subscription_plan === "PREMIUM" ? 1.0 : 2.0;
  const grossAmt = parseFloat(finalPrice!.toString());
  const commissionAmt = parseFloat((grossAmt * commissionPct / 100).toFixed(2));
  const netAmt = parseFloat((grossAmt - commissionAmt).toFixed(2));

  // Create transaction
  const [txn] = await db.insert(transactions).values({
    offerId: id,
    merchantId: offer.merchantId,
    grossAmount: grossAmt.toString(),
    commissionPct: commissionPct.toString(),
    commissionAmt: commissionAmt.toString(),
    netAmount: netAmt.toString(),
    status: "COMPLETED",
    settledAt: new Date(),
  }).returning();

  // Create commission ledger entry
  await db.insert(commissionLedger).values({
    offerId: id,
    transactionId: txn.id,
    merchantId: offer.merchantId,
    branchId: offer.branchId,
    grossAmount: grossAmt.toString(),
    commissionRatePct: commissionPct.toString(),
    ledgerStatus: "PENDING",
  });

  // Update user price_sensitivity
  await db.execute(sql`
    UPDATE users SET price_sensitivity = (
      SELECT COALESCE(AVG(
        CASE
          WHEN n.proposed_price < oi.unit_price * 0.95 THEN 1.0
          WHEN n.proposed_price < oi.unit_price * 0.98 THEN 0.6
          ELSE 0.2
        END
      ), 0.50)
      FROM negotiations n
      JOIN offers o ON n.offer_id = o.id
      JOIN offer_items oi ON oi.offer_id = o.id
      JOIN trips t ON o.trip_id = t.id
      WHERE t.user_id = ${userId}::uuid
        AND n.sender_type = 'USER'
        AND n.created_at > NOW() - INTERVAL '90 days'
    )
    WHERE id = ${userId}::uuid
  `);

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

  const [offer] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!offer) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(offers).set({ status: "REJECTED", respondedAt: new Date(), updatedAt: new Date() }).where(eq(offers.id, id));

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

  const [offer] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!offer) { res.status(404).json({ error: "Not found" }); return; }

  const [user] = await db.select({ priceSensitivity: users.priceSensitivity }).from(users).where(eq(users.id, userId)).limit(1);

  await db.update(offers).set({ status: "NEGOTIATING", updatedAt: new Date() }).where(eq(offers.id, id));

  const [neg] = await db.insert(negotiations).values({
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
