/**
 * DINA Negotiation Engine
 *
 * POST /api/dina/negotiate/start               — DINA sends first offer (round 1)
 * POST /api/dina/negotiate/:sessionId/respond  — Customer responds (ACCEPT/REJECT/COUNTER_OFFER)
 * GET  /api/dina/negotiate/:sessionId          — Get session + all rounds
 *
 * S10: Customer accepts in round 1
 *        Level 1 → HITL created, merchant must approve
 *        Level 2 → DEAL_CLOSED immediately
 * S11: Customer rejects every round → REJECTED_BY_CUSTOMER + notification
 * S12: Counter offer 1.8% ≤ max 2% → DINA accepts (is_within_constraint=true)
 * S13: Counter offer 3%  > max 2% → DINA rejects, counter-offers at max (2%)
 */

import { Router } from "express";
import {
  dinaDb, sharedDb, merchantsDb,
  dinaConstraints, dinaMerchants, dinaTenants,
  dinaSessions, dinaRounds, dinaHitlRequests,
  notifications,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, requireActor, JwtPayload } from "../lib/auth.js";

const router = Router();
router.use(authenticate);
router.use(requireActor("MERCHANT"));

function auth(req: any): JwtPayload { return req.auth; }

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function getDinaMerchant(merchantId: string) {
  const [tenant] = await dinaDb.select({ id: dinaTenants.id })
    .from(dinaTenants).where(eq(dinaTenants.name, "Darbby Platform")).limit(1);
  if (!tenant) throw new Error("DINA tenant not found");

  const [dm] = await dinaDb.select()
    .from(dinaMerchants)
    .where(and(
      eq(dinaMerchants.tenantId, tenant.id),
      eq(dinaMerchants.externalMerchantId, merchantId),
    )).limit(1);
  if (!dm) throw new Error("التاجر غير مسجّل في DINA — أنشئ قيداً أولاً");
  return { tenant, dinaMerchant: dm };
}

function calcPrice(base: number, discountPct: number): number {
  return parseFloat((base * (1 - discountPct / 100)).toFixed(2));
}

// Build dinaDecisionFactors JSONB for a DINA round
function buildDecisionFactors(opts: {
  roundNumber: number;
  currentDiscount: number;
  maxDiscount: number;
  basePrice: number;
  proposedPrice: number;
  action: "INITIAL" | "STEP_UP" | "ACCEPT_COUNTER" | "REJECT_COUNTER" | "MAX_REACHED";
}) {
  return {
    roundNumber: opts.roundNumber,
    currentDiscountPct: opts.currentDiscount,
    maxDiscountPct: opts.maxDiscount,
    remainingBudget: parseFloat((opts.maxDiscount - opts.currentDiscount).toFixed(2)),
    priceDropAmount: parseFloat((opts.basePrice - opts.proposedPrice).toFixed(2)),
    action: opts.action,
    decidedAt: new Date().toISOString(),
  };
}

// ─── POST /api/dina/negotiate/start ──────────────────────────────────────────
// DINA creates an ACTIVE session and sends the first offer
router.post("/start", async (req, res) => {
  const { id: merchantId } = auth(req);
  const {
    constraintId,
    basePrice: basePriceRaw,
    tripId,
    customerId,
    branchId,
    // For testing: override autonomy level
    _mock: { autonomyLevel: mockAutonomyLevel } = {} as any,
  } = req.body;

  if (!constraintId || basePriceRaw === undefined) {
    res.status(400).json({ error: "constraintId و basePrice مطلوبان" });
    return;
  }

  const basePrice = parseFloat(basePriceRaw);

  try {
    const { tenant, dinaMerchant } = await getDinaMerchant(merchantId);

    // Load constraint
    const [constraint] = await dinaDb.select().from(dinaConstraints)
      .where(and(
        eq(dinaConstraints.id, constraintId),
        eq(dinaConstraints.merchantId, dinaMerchant.id),
        eq(dinaConstraints.isActive, true),
      )).limit(1);

    if (!constraint) {
      res.status(404).json({ error: "القيد غير موجود أو غير نشط" });
      return;
    }

    const minPct = parseFloat(constraint.minDiscountPct);
    const maxPct = parseFloat(constraint.maxDiscountPct);
    const stepPct = parseFloat(constraint.stepPct);
    const maxRounds = constraint.maxRounds;

    const autonomyLevel = mockAutonomyLevel ?? dinaMerchant.autonomyLevel ?? "LEVEL_1";
    const DUMMY = "00000000-0000-0000-0000-000000000000";

    // Create ACTIVE session
    const [session] = await dinaDb.insert(dinaSessions).values({
      tenantId: tenant.id,
      merchantId: dinaMerchant.id,
      externalTripId: tripId ?? DUMMY,
      externalCustomerId: customerId ?? DUMMY,
      externalBranchId: branchId ?? DUMMY,
      constraintId: constraint.id,
      autonomyLevel,
      status: "ACTIVE",
      openingPrice: basePrice.toString(),
      totalRounds: 0,
      triggerChecks: { skipped: false, note: "All trigger checks passed" },
      customerProfileSnapshot: {},
      merchantProfileSnapshot: {},
    }).returning();

    // DINA sends round 1: start at minDiscountPct
    const round1Price = calcPrice(basePrice, minPct);
    const [round1] = await dinaDb.insert(dinaRounds).values({
      sessionId: session.id,
      roundNumber: 1,
      actor: "DINA",
      proposedPrice: round1Price.toString(),
      proposedDiscountPct: minPct.toString(),
      status: "SENT",
      isWithinConstraint: true,
      dinaDecisionFactors: buildDecisionFactors({
        roundNumber: 1,
        currentDiscount: minPct,
        maxDiscount: maxPct,
        basePrice,
        proposedPrice: round1Price,
        action: "INITIAL",
      }),
    }).returning();

    // Update totalRounds
    await dinaDb.update(dinaSessions)
      .set({ totalRounds: 1 })
      .where(eq(dinaSessions.id, session.id));

    res.status(201).json({
      sessionId: session.id,
      status: "ACTIVE",
      autonomyLevel,
      constraint: {
        minDiscountPct: minPct,
        maxDiscountPct: maxPct,
        stepPct,
        maxRounds,
      },
      basePrice,
      dinaOffer: {
        roundId: round1.id,
        roundNumber: 1,
        proposedPrice: round1Price,
        discountPct: minPct,
        isWithinConstraint: true,
      },
      awaiting: "CUSTOMER_RESPONSE",
      hint: `POST /api/dina/negotiate/${session.id}/respond with action: ACCEPT | REJECT | COUNTER_OFFER`,
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/dina/negotiate/:sessionId/respond ──────────────────────────────
// Customer responds to DINA's latest offer
router.post("/:sessionId/respond", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { sessionId } = req.params;
  const {
    action,           // "ACCEPT" | "REJECT" | "COUNTER_OFFER"
    counterOfferPct,  // number — for COUNTER_OFFER
  } = req.body;

  if (!["ACCEPT", "REJECT", "COUNTER_OFFER"].includes(action)) {
    res.status(400).json({ error: "action يجب أن يكون ACCEPT أو REJECT أو COUNTER_OFFER" });
    return;
  }
  if (action === "COUNTER_OFFER" && counterOfferPct === undefined) {
    res.status(400).json({ error: "counterOfferPct مطلوب مع COUNTER_OFFER" });
    return;
  }

  try {
    const { dinaMerchant } = await getDinaMerchant(merchantId);

    // Load session
    const [session] = await dinaDb.select().from(dinaSessions)
      .where(and(
        eq(dinaSessions.id, sessionId),
        eq(dinaSessions.merchantId, dinaMerchant.id),
        eq(dinaSessions.status, "ACTIVE"),
      )).limit(1);

    if (!session) {
      res.status(404).json({ error: "الجلسة غير موجودة أو غير نشطة" });
      return;
    }

    // Load constraint
    const [constraint] = await dinaDb.select().from(dinaConstraints)
      .where(eq(dinaConstraints.id, session.constraintId!)).limit(1);
    if (!constraint) {
      res.status(400).json({ error: "لا يوجد قيد مرتبط بالجلسة" });
      return;
    }

    const minPct = parseFloat(constraint.minDiscountPct);
    const maxPct = parseFloat(constraint.maxDiscountPct);
    const stepPct = parseFloat(constraint.stepPct);
    const maxRounds = constraint.maxRounds;
    const basePrice = parseFloat(session.openingPrice);
    const currentRound = session.totalRounds ?? 0;

    // Determine DINA's current offer (last DINA round)
    const allRounds = await dinaDb.select().from(dinaRounds)
      .where(eq(dinaRounds.sessionId, sessionId))
      .orderBy(dinaRounds.roundNumber);

    const lastDinaRound = [...allRounds].reverse().find(r => r.actor === "DINA");
    const currentDiscountPct = parseFloat(lastDinaRound?.proposedDiscountPct ?? minPct.toString());
    const currentDinaPrice = parseFloat(lastDinaRound?.proposedPrice ?? calcPrice(basePrice, minPct).toString());

    // ══════════════════════════════════════════════════════════════════
    // CASE 1: Customer ACCEPTS DINA's offer
    // ══════════════════════════════════════════════════════════════════
    if (action === "ACCEPT") {
      const agreedPrice = currentDinaPrice;
      const agreedPct = currentDiscountPct;

      // Write customer ACCEPT round
      const [customerRound] = await dinaDb.insert(dinaRounds).values({
        sessionId,
        roundNumber: currentRound + 1,
        actor: "CUSTOMER",
        proposedPrice: agreedPrice.toString(),
        proposedDiscountPct: agreedPct.toString(),
        status: "ACCEPTED",
        isWithinConstraint: true,
        dinaDecisionFactors: { action: "CUSTOMER_ACCEPTED", roundNumber: currentRound + 1 },
        respondedAt: new Date(),
      }).returning();

      // ── S10: Level 1 → HITL (merchant must approve) ──────────────────────────
      if (session.autonomyLevel === "LEVEL_1") {
        const hitlExpiry = new Date(Date.now() + (dinaMerchant.hitlTimeoutMin ?? 5) * 60_000);

        const [hitl] = await dinaDb.insert(dinaHitlRequests).values({
          sessionId,
          roundId: customerRound.id,
          reason: `العميل قبل العرض في الجولة ${currentRound + 1} بخصم ${agreedPct}% (سعر ${agreedPrice})`,
          proposedAction: `إتمام الصفقة بسعر ${agreedPrice} (خصم ${agreedPct}%)`,
          status: "PENDING",
          expiresAt: hitlExpiry,
        }).returning();

        await dinaDb.update(dinaSessions).set({ totalRounds: currentRound + 1 })
          .where(eq(dinaSessions.id, sessionId));

        // Notify merchant of HITL
        await sharedDb.insert(notifications).values({
          recipientType: "MERCHANT",
          recipientId: merchantId,
          type: "DINA_HITL_APPROVAL_NEEDED",
          title: "DINA تطلب موافقتك على الصفقة",
          body: `عميل قبل خصم ${agreedPct}% (سعر ${agreedPrice}). لديك ${dinaMerchant.hitlTimeoutMin ?? 5} دقائق للموافقة أو الرفض.`,
          data: {
            sessionId,
            hitlRequestId: hitl.id,
            agreedPrice,
            agreedDiscountPct: agreedPct,
            expiresAt: hitlExpiry.toISOString(),
            action: "HITL_APPROVE_OR_REJECT",
          },
          isRead: false,
        });

        res.json({
          outcome: "PENDING_HITL_APPROVAL",
          message: "Level 1: العميل قبل العرض — DINA أرسلت طلب موافقة للتاجر قبل إتمام الصفقة",
          sessionId,
          agreedPrice,
          agreedDiscountPct: agreedPct,
          totalRounds: currentRound + 1,
          hitlRequest: {
            id: hitl.id,
            status: "PENDING",
            expiresAt: hitlExpiry.toISOString(),
            timeoutMinutes: dinaMerchant.hitlTimeoutMin ?? 5,
          },
          notificationSent: true,
          s10_level1: "✅ HITL request created — merchant must approve within timeout",
        });
        return;
      }

      // ── S10: Level 2 → DEAL_CLOSED immediately ───────────────────────────────
      const now = new Date();
      await dinaDb.update(dinaSessions).set({
        status: "COMPLETED",
        outcome: "DEAL_CLOSED",
        totalRounds: currentRound + 1,
        agreedPrice: agreedPrice.toString(),
        agreedDiscountPct: agreedPct.toString(),
        completedAt: now,
        durationSeconds: Math.floor((now.getTime() - session.startedAt!.getTime()) / 1000),
      }).where(eq(dinaSessions.id, sessionId));

      // Notify merchant of deal closed
      await sharedDb.insert(notifications).values({
        recipientType: "MERCHANT",
        recipientId: merchantId,
        type: "DINA_DEAL_CLOSED",
        title: "صفقة مكتملة",
        body: `DINA أتمّت صفقة بخصم ${agreedPct}% — السعر المتفق عليه: ${agreedPrice}`,
        data: { sessionId, agreedPrice, agreedDiscountPct: agreedPct },
        isRead: false,
      });

      res.json({
        outcome: "DEAL_CLOSED",
        message: "Level 2: DINA أتمّت الصفقة مباشرة دون الرجوع للتاجر",
        sessionId,
        agreedPrice,
        agreedDiscountPct: agreedPct,
        totalRounds: currentRound + 1,
        s10_level2: "✅ DEAL_CLOSED immediately — no merchant approval needed",
      });
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // CASE 2: Customer sends COUNTER_OFFER
    // ══════════════════════════════════════════════════════════════════
    if (action === "COUNTER_OFFER") {
      const offerPct = parseFloat(counterOfferPct);
      const isWithinConstraint = offerPct <= maxPct;

      // Write customer counter-offer round
      const counterPrice = calcPrice(basePrice, offerPct);
      await dinaDb.insert(dinaRounds).values({
        sessionId,
        roundNumber: currentRound + 1,
        actor: "CUSTOMER",
        proposedPrice: counterPrice.toString(),
        proposedDiscountPct: offerPct.toString(),
        status: "COUNTER_OFFER",
        isWithinConstraint,
        dinaDecisionFactors: {
          action: "CUSTOMER_COUNTER_OFFER",
          counterOfferPct: offerPct,
          isWithinConstraint,
          maxDiscountPct: maxPct,
          decision: isWithinConstraint ? "DINA_WILL_ACCEPT" : "DINA_WILL_REJECT_AND_COUNTER",
        },
        respondedAt: new Date(),
      });

      // ── S12: Counter ≤ max → DINA accepts ────────────────────────────────────
      if (isWithinConstraint) {
        const agreedPrice = counterPrice;
        const agreedPct = offerPct;
        const now = new Date();

        await dinaDb.update(dinaSessions).set({
          status: "COMPLETED",
          outcome: "DEAL_CLOSED",
          totalRounds: currentRound + 1,
          agreedPrice: agreedPrice.toString(),
          agreedDiscountPct: agreedPct.toString(),
          completedAt: now,
          durationSeconds: Math.floor((now.getTime() - session.startedAt!.getTime()) / 1000),
        }).where(eq(dinaSessions.id, sessionId));

        await sharedDb.insert(notifications).values({
          recipientType: "MERCHANT",
          recipientId: merchantId,
          type: "DINA_DEAL_CLOSED",
          title: "صفقة مكتملة — عرض مضاد",
          body: `DINA قبلت عرض العميل المضاد: خصم ${agreedPct}% ≤ الحد الأقصى ${maxPct}% — السعر: ${agreedPrice}`,
          data: { sessionId, agreedPrice, agreedDiscountPct: agreedPct, isCounterOffer: true },
          isRead: false,
        });

        res.json({
          outcome: "DEAL_CLOSED",
          message: `S12 ✅: العرض المضاد ${offerPct}% ≤ max ${maxPct}% — DINA قبلت is_within_constraint=true`,
          sessionId,
          agreedPrice,
          agreedDiscountPct: agreedPct,
          totalRounds: currentRound + 1,
          isWithinConstraint: true,
          s12: `✅ counter ${offerPct}% ≤ max ${maxPct}% → DEAL_CLOSED`,
        });
        return;
      }

      // ── S13: Counter > max → DINA rejects and offers max ─────────────────────
      const dinaCounterPct = maxPct;
      const dinaCounterPrice = calcPrice(basePrice, dinaCounterPct);

      const [dinaCounterRound] = await dinaDb.insert(dinaRounds).values({
        sessionId,
        roundNumber: currentRound + 2,
        actor: "DINA",
        proposedPrice: dinaCounterPrice.toString(),
        proposedDiscountPct: dinaCounterPct.toString(),
        status: "COUNTER_OFFER",
        rejectionReason: `العرض المضاد ${offerPct}% يتجاوز الحد الأقصى ${maxPct}%`,
        isWithinConstraint: true,
        dinaDecisionFactors: buildDecisionFactors({
          roundNumber: currentRound + 2,
          currentDiscount: dinaCounterPct,
          maxDiscount: maxPct,
          basePrice,
          proposedPrice: dinaCounterPrice,
          action: "MAX_REACHED",
        }),
      }).returning();

      await dinaDb.update(dinaSessions).set({ totalRounds: currentRound + 2 })
        .where(eq(dinaSessions.id, sessionId));

      res.json({
        outcome: "DINA_COUNTER_OFFERED",
        message: `S13 ✅: العرض المضاد ${offerPct}% > max ${maxPct}% — DINA رفضت وعرضت الحد الأقصى ${maxPct}%`,
        sessionId,
        customerCounterOffer: { pct: offerPct, price: counterPrice, isWithinConstraint: false },
        dinaCounterOffer: {
          roundId: dinaCounterRound.id,
          roundNumber: currentRound + 2,
          proposedPrice: dinaCounterPrice,
          discountPct: dinaCounterPct,
          isWithinConstraint: true,
          note: `الحد الأقصى للقيد هو ${maxPct}% — DINA لا تتجاوزه`,
        },
        totalRounds: currentRound + 2,
        awaiting: "CUSTOMER_RESPONSE",
        s13: `✅ counter ${offerPct}% > max ${maxPct}% → DINA rejected + offered max`,
      });
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // CASE 3: Customer REJECTS — DINA steps up or ends session
    // ══════════════════════════════════════════════════════════════════
    // Write customer REJECT round
    await dinaDb.insert(dinaRounds).values({
      sessionId,
      roundNumber: currentRound + 1,
      actor: "CUSTOMER",
      proposedPrice: currentDinaPrice.toString(),
      proposedDiscountPct: currentDiscountPct.toString(),
      status: "REJECTED",
      isWithinConstraint: true,
      dinaDecisionFactors: { action: "CUSTOMER_REJECTED", roundNumber: currentRound + 1 },
      respondedAt: new Date(),
    });

    const newCurrentRound = currentRound + 1;

    // ── S11: All rounds exhausted → REJECTED_BY_CUSTOMER ─────────────────────
    if (newCurrentRound >= maxRounds || currentDiscountPct >= maxPct) {
      const now = new Date();
      await dinaDb.update(dinaSessions).set({
        status: "COMPLETED",
        outcome: "REJECTED_BY_CUSTOMER",
        totalRounds: newCurrentRound,
        completedAt: now,
        durationSeconds: Math.floor((now.getTime() - session.startedAt!.getTime()) / 1000),
      }).where(eq(dinaSessions.id, sessionId));

      // Notify merchant
      await sharedDb.insert(notifications).values({
        recipientType: "MERCHANT",
        recipientId: merchantId,
        type: "DINA_NEGOTIATION_FAILED",
        title: "تفاوض DINA انتهى بدون اتفاق",
        body: `العميل رفض جميع العروض حتى الجولة ${newCurrentRound} (أقصى خصم: ${currentDiscountPct}%) — النتيجة: REJECTED_BY_CUSTOMER`,
        data: {
          sessionId,
          totalRounds: newCurrentRound,
          maxDiscountOffered: currentDiscountPct,
          outcome: "REJECTED_BY_CUSTOMER",
        },
        isRead: false,
      });

      res.json({
        outcome: "REJECTED_BY_CUSTOMER",
        message: `S11 ✅: العميل رفض جميع الجولات (${newCurrentRound}/${maxRounds}) — DINA أنهت الجلسة وأرسلت إشعاراً للتاجر`,
        sessionId,
        totalRounds: newCurrentRound,
        maxRoundsAllowed: maxRounds,
        lastOfferPct: currentDiscountPct,
        notificationSent: true,
        s11: `✅ outcome=REJECTED_BY_CUSTOMER + merchant notified`,
      });
      return;
    }

    // ── DINA steps up to next discount level ─────────────────────────────────
    const nextDiscountPct = parseFloat((currentDiscountPct + stepPct).toFixed(2));
    const cappedDiscount = Math.min(nextDiscountPct, maxPct);
    const nextPrice = calcPrice(basePrice, cappedDiscount);

    const [nextRound] = await dinaDb.insert(dinaRounds).values({
      sessionId,
      roundNumber: newCurrentRound + 1,
      actor: "DINA",
      proposedPrice: nextPrice.toString(),
      proposedDiscountPct: cappedDiscount.toString(),
      status: "SENT",
      isWithinConstraint: true,
      dinaDecisionFactors: buildDecisionFactors({
        roundNumber: newCurrentRound + 1,
        currentDiscount: cappedDiscount,
        maxDiscount: maxPct,
        basePrice,
        proposedPrice: nextPrice,
        action: "STEP_UP",
      }),
    }).returning();

    await dinaDb.update(dinaSessions).set({ totalRounds: newCurrentRound + 1 })
      .where(eq(dinaSessions.id, sessionId));

    res.json({
      outcome: "NEGOTIATING",
      message: `DINA رفعت الخصم من ${currentDiscountPct}% إلى ${cappedDiscount}%`,
      sessionId,
      roundsUsed: newCurrentRound + 1,
      roundsRemaining: maxRounds - (newCurrentRound + 1),
      dinaOffer: {
        roundId: nextRound.id,
        roundNumber: newCurrentRound + 1,
        proposedPrice: nextPrice,
        discountPct: cappedDiscount,
        isWithinConstraint: true,
      },
      awaiting: "CUSTOMER_RESPONSE",
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/dina/negotiate/:sessionId ───────────────────────────────────────
router.get("/:sessionId", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { sessionId } = req.params;

  try {
    const { dinaMerchant } = await getDinaMerchant(merchantId);

    const [session] = await dinaDb.select().from(dinaSessions)
      .where(and(
        eq(dinaSessions.id, sessionId),
        eq(dinaSessions.merchantId, dinaMerchant.id),
      )).limit(1);

    if (!session) {
      res.status(404).json({ error: "الجلسة غير موجودة" });
      return;
    }

    const rounds = await dinaDb.select().from(dinaRounds)
      .where(eq(dinaRounds.sessionId, sessionId))
      .orderBy(dinaRounds.roundNumber);

    res.json({ session, rounds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
