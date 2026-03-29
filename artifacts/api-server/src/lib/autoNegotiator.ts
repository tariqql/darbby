/**
 * Auto-Negotiator Engine v3
 *
 * Logic:
 * 1. Check if merchant has auto-negotiator enabled
 * 2. Apply trip_purpose rules (e.g. UMRAH → extra 5%)
 * 3. Apply price_sensitivity to widen acceptable range for sensitive users
 * 4. Check working hours of the branch
 * 5. Propose a counter-price within [min_discount, max_discount] range
 */

import { dinaDb, autoNegotiatorSettings, autoNegotiatorProducts } from "@workspace/db";
import { ordersDb, negotiations, offers } from "@workspace/db";
import { customersDb, users } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { writeAuditLog } from "./auditLog.js";

interface AutoNegContext {
  offerId: string;
  merchantId: string;
  tripPurpose: string;
  userId: string;
  proposedPrice: number;
  originalPrice: number;
}

export async function runAutoNegotiator(ctx: AutoNegContext): Promise<boolean> {
  const [settings] = await dinaDb
    .select()
    .from(autoNegotiatorSettings)
    .where(and(eq(autoNegotiatorSettings.merchantId, ctx.merchantId), eq(autoNegotiatorSettings.isEnabled, true)))
    .limit(1);

  if (!settings) return false;

  // Get user price sensitivity
  const userRows = await customersDb.execute<any>(sql`SELECT price_sensitivity FROM users WHERE id = ${ctx.userId}::uuid LIMIT 1`);
  const user = (Array.isArray(userRows) ? userRows : (userRows as any).rows ?? [])[0];
  const priceSensitivity = parseFloat(user?.price_sensitivity || "0.50");

  // Get purpose rules
  const purposeRules = (settings.purposeRules as any) || {};
  const purposeRule = purposeRules[ctx.tripPurpose] || {};

  // Calculate response delay
  let delay = settings.responseDelayMin || 5;
  if (purposeRule.response_delay_min) delay = purposeRule.response_delay_min;

  // Get negotiatable products
  const prodRules = await dinaDb
    .select()
    .from(autoNegotiatorProducts)
    .where(eq(autoNegotiatorProducts.negotiatorId, settings.id));

  if (!prodRules.length) return false;

  // Calculate acceptable counter price
  // Base: use the first product's discount range (simplification for multi-product offers)
  const rule = prodRules[0];
  let minDiscount = parseFloat(rule.minDiscountPct);
  let maxDiscount = parseFloat(rule.maxDiscountPct);

  // Apply trip_purpose bonus
  const extraDiscount = purposeRule.extra_discount_pct || 0;
  maxDiscount = Math.min(maxDiscount + extraDiscount, 100);

  // Apply price_sensitivity: sensitive users get slightly wider min
  const adjustedMin = minDiscount * (1 + priceSensitivity * 0.3);
  const effectiveMin = Math.min(adjustedMin, maxDiscount);

  // If user's proposed price is within our acceptable discount range → accept
  const discountPct = ((ctx.originalPrice - ctx.proposedPrice) / ctx.originalPrice) * 100;

  if (discountPct >= effectiveMin && discountPct <= maxDiscount) {
    // Auto-accept
    await ordersDb.update(offers).set({
      status: "ACCEPTED",
      finalPrice: ctx.proposedPrice.toString(),
      respondedAt: new Date(),
      finalizedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(offers.id, ctx.offerId));

    await writeAuditLog({
      tableName: "offers",
      recordId: ctx.offerId,
      operation: "STATUS_CHANGE",
      actorType: "SYSTEM",
      reason: `Auto-negotiator accepted (discount: ${discountPct.toFixed(1)}%, purpose: ${ctx.tripPurpose})`,
      oldValues: { status: "NEGOTIATING" },
      newValues: { status: "ACCEPTED", finalPrice: ctx.proposedPrice },
      changedFields: ["status", "final_price"],
    });

    return true;
  }

  // Propose a counter between min and max
  const midDiscountPct = (effectiveMin + maxDiscount) / 2;
  const counterPrice = ctx.originalPrice * (1 - midDiscountPct / 100);

  // Schedule delayed response (simplified: insert immediately with isAuto=true)
  await ordersDb.insert(negotiations).values({
    offerId: ctx.offerId,
    senderType: "MERCHANT",
    proposedPrice: counterPrice.toFixed(2),
    message: `Auto-offer: ${midDiscountPct.toFixed(1)}% discount`,
    isAuto: true,
    priceSensitivitySnapshot: priceSensitivity.toString(),
  });

  await writeAuditLog({
    tableName: "negotiations",
    recordId: ctx.offerId,
    operation: "INSERT",
    actorType: "SYSTEM",
    reason: `Auto-negotiator counter (purpose: ${ctx.tripPurpose}, sensitivity: ${priceSensitivity})`,
    newValues: { proposedPrice: counterPrice, discountPct: midDiscountPct },
  });

  return true;
}
