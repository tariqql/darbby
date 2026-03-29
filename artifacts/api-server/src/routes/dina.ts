/**
 * DINA Constraints API
 * POST /api/dina/constraints      — Create constraint (validates S01-S03)
 * GET  /api/dina/constraints      — List merchant constraints
 * GET  /api/dina/constraints/:id  — Get single constraint
 * PATCH /api/dina/constraints/:id — Update constraint
 * DELETE /api/dina/constraints/:id — Deactivate constraint
 * POST /api/dina/session/check    — Simulate DINA constraint check (tests S04)
 */

import { Router } from "express";
import { dinaDb, sharedDb, merchantsDb, dinaConstraints, dinaConstraintProducts, dinaMerchants, dinaTenants, notifications } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, requireActor, JwtPayload } from "../lib/auth.js";

const router = Router();
router.use(authenticate);
router.use(requireActor("MERCHANT"));

function auth(req: any): JwtPayload { return req.auth; }

function dbRows<T>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

// ─── AUTO-ENROLL HELPER ──────────────────────────────────────────────────────
// Ensures the merchant exists in dina_merchants, auto-enrolling with BASIC if needed
async function ensureDinaMerchant(externalMerchantId: string): Promise<string> {
  // Get the default Darbby tenant
  const [tenant] = await dinaDb.select({ id: dinaTenants.id })
    .from(dinaTenants)
    .where(eq(dinaTenants.name, "Darbby Platform"))
    .limit(1);

  if (!tenant) throw new Error("DINA tenant not found — contact support");

  // Check if already enrolled
  const [existing] = await dinaDb.select()
    .from(dinaMerchants)
    .where(and(
      eq(dinaMerchants.tenantId, tenant.id),
      eq(dinaMerchants.externalMerchantId, externalMerchantId),
    ))
    .limit(1);

  if (existing) return existing.id;

  // Auto-enroll with BASIC plan (1 year expiry)
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const [enrolled] = await dinaDb.insert(dinaMerchants).values({
    tenantId: tenant.id,
    externalMerchantId,
    plan: "BASIC",
    autonomyLevel: "LEVEL_1",
    hitlTimeoutMin: 5,
    isActive: true,
    subscriptionExpiresAt: expiresAt,
  }).returning();

  return enrolled.id;
}

// ─── CONSTRAINT VALIDATION HELPER ────────────────────────────────────────────
function validateConstraint(min: number, max: number, step: number): { valid: false; error: string; code: string } | { valid: true } {
  // S02: min must be less than max
  if (min >= max) {
    return {
      valid: false,
      code: "CONSTRAINT_MIN_GTE_MAX",
      error: `الحد الأدنى للخصم (${min}%) يجب أن يكون أصغر من الحد الأقصى (${max}%). قيمة min=${min} ≥ max=${max} غير مقبولة.`,
    };
  }
  // S03: step must not exceed the range
  const range = max - min;
  if (step > range) {
    return {
      valid: false,
      code: "CONSTRAINT_STEP_EXCEEDS_RANGE",
      error: `حجم الخطوة (${step}%) أكبر من نطاق الخصم (${range}% = ${max}% - ${min}%). الخطوة يجب أن تكون ≤ ${range}%.`,
    };
  }
  if (step <= 0) {
    return {
      valid: false,
      code: "CONSTRAINT_STEP_ZERO",
      error: `حجم الخطوة (${step}%) يجب أن يكون أكبر من صفر.`,
    };
  }
  return { valid: true };
}

// S01: Auto-calculate max_rounds from (max - min) / step
function calcMaxRounds(min: number, max: number, step: number): number {
  // Possible discount levels: min, min+step, min+2*step, ... ≤ max
  // Count = floor((max - min) / step) + 1
  return Math.floor((max - min) / step) + 1;
}

// ─── POST /api/dina/constraints ───────────────────────────────────────────────
router.post("/constraints", async (req, res) => {
  const { id: merchantId } = auth(req);
  const {
    name,
    minDiscountPct,
    maxDiscountPct,
    stepPct,
    noResponseTimeoutMin,
    lifetime,
    startsAt,
    expiresAt,
    products: productList,
  } = req.body;

  if (!name || minDiscountPct === undefined || maxDiscountPct === undefined || stepPct === undefined) {
    res.status(400).json({ error: "name, minDiscountPct, maxDiscountPct, stepPct are required" });
    return;
  }

  const min = parseFloat(minDiscountPct);
  const max = parseFloat(maxDiscountPct);
  const step = parseFloat(stepPct);

  // ── S02 + S03: Validate constraint boundaries ──────────────────────────────
  const check = validateConstraint(min, max, step);
  if (!check.valid) {
    res.status(422).json({
      error: check.error,
      code: check.code,
      details: { minDiscountPct: min, maxDiscountPct: max, stepPct: step, range: max - min },
    });
    return;
  }

  // ── S01: Auto-calculate max_rounds ────────────────────────────────────────
  const maxRounds = calcMaxRounds(min, max, step);

  // ── Validate lifetime + expiresAt ─────────────────────────────────────────
  const lifetimeValue = lifetime ?? "PERMANENT";
  if (lifetimeValue === "TEMPORARY" && !expiresAt) {
    res.status(400).json({ error: "expiresAt is required for TEMPORARY constraints" });
    return;
  }
  if (lifetimeValue === "TEMPORARY" && new Date(expiresAt) <= new Date()) {
    res.status(422).json({
      error: "تاريخ انتهاء القيد يجب أن يكون في المستقبل",
      code: "CONSTRAINT_EXPIRES_IN_PAST",
    });
    return;
  }

  try {
    const dinaMerchantId = await ensureDinaMerchant(merchantId);

    const [constraint] = await dinaDb.insert(dinaConstraints).values({
      merchantId: dinaMerchantId,
      name,
      minDiscountPct: min.toString(),
      maxDiscountPct: max.toString(),
      stepPct: step.toString(),
      maxRounds,
      noResponseTimeoutMin: noResponseTimeoutMin ?? 3,
      lifetime: lifetimeValue,
      startsAt: startsAt ? new Date(startsAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    }).returning();

    // Insert product links if provided
    const insertedProducts = [];
    if (productList?.length) {
      for (const p of productList) {
        const [cp] = await dinaDb.insert(dinaConstraintProducts).values({
          constraintId: constraint.id,
          externalProductId: p.productId,
          productName: p.productName,
          basePrice: p.basePrice.toString(),
        }).returning();
        insertedProducts.push(cp);
      }
    }

    res.status(201).json({
      ...constraint,
      products: insertedProducts,
      _calculated: {
        maxRounds,
        formula: `floor((${max} - ${min}) / ${step}) + 1 = floor(${max - min} / ${step}) + 1 = ${Math.floor((max - min) / step)} + 1 = ${maxRounds}`,
        discountLevels: Array.from({ length: maxRounds }, (_, i) =>
          parseFloat((min + i * step).toFixed(2))
        ),
      },
    });
  } catch (err: any) {
    if (err.code === "23514") { // check constraint violation
      res.status(422).json({ error: "قيم الخصم غير صالحة — تحقق من min < max و step ≤ range", code: "DB_CHECK_VIOLATION" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ─── GET /api/dina/constraints ────────────────────────────────────────────────
router.get("/constraints", async (req, res) => {
  const { id: merchantId } = auth(req);
  try {
    const dinaMerchantId = await ensureDinaMerchant(merchantId);
    const list = await dinaDb.select().from(dinaConstraints)
      .where(eq(dinaConstraints.merchantId, dinaMerchantId))
      .orderBy(sql`${dinaConstraints.createdAt} DESC`);

    const now = new Date();
    const enriched = list.map(c => ({
      ...c,
      isExpired: c.lifetime === "TEMPORARY" && c.expiresAt ? c.expiresAt < now : false,
      _calculated: {
        maxRounds: c.maxRounds,
        formula: `floor((${c.maxDiscountPct} - ${c.minDiscountPct}) / ${c.stepPct}) + 1`,
      },
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/dina/session/check ─────────────────────────────────────────────
// S04: Simulate DINA checking a constraint before starting a negotiation session
router.post("/session/check", async (req, res) => {
  const { id: merchantId } = auth(req);
  const { constraintId, tripId } = req.body;

  if (!constraintId) {
    res.status(400).json({ error: "constraintId is required" });
    return;
  }

  try {
    const dinaMerchantId = await ensureDinaMerchant(merchantId);

    const [constraint] = await dinaDb.select().from(dinaConstraints)
      .where(and(
        eq(dinaConstraints.id, constraintId),
        eq(dinaConstraints.merchantId, dinaMerchantId),
      ))
      .limit(1);

    if (!constraint) {
      res.status(404).json({ error: "القيد غير موجود أو لا يخصك" });
      return;
    }

    const now = new Date();
    const checks: Record<string, { passed: boolean; detail: string }> = {};

    // Check 1: Is constraint active?
    checks.isActive = {
      passed: constraint.isActive ?? false,
      detail: constraint.isActive ? "القيد مفعّل ✅" : "القيد معطل ❌",
    };

    // Check 2: Has started?
    checks.hasStarted = {
      passed: !constraint.startsAt || constraint.startsAt <= now,
      detail: constraint.startsAt && constraint.startsAt > now
        ? `القيد لم يبدأ بعد (يبدأ ${constraint.startsAt.toISOString()}) ❌`
        : "القيد في نطاق الوقت الصحيح ✅",
    };

    // Check 3: S04 — Is it expired?
    const isExpired = constraint.lifetime === "TEMPORARY" &&
      constraint.expiresAt !== null &&
      constraint.expiresAt < now;

    checks.notExpired = {
      passed: !isExpired,
      detail: isExpired
        ? `القيد منتهي الصلاحية منذ ${constraint.expiresAt?.toISOString()} ❌ — سيتم إرسال تنبيه للتاجر`
        : `القيد ساري ${constraint.lifetime === "TEMPORARY" ? `حتى ${constraint.expiresAt?.toISOString()}` : "(دائم)"} ✅`,
    };

    const allPassed = Object.values(checks).every(c => c.passed);

    // S04: If expired, write notification to merchant in sharedDb
    if (isExpired) {
      await sharedDb.insert(notifications).values({
        recipientType: "MERCHANT",
        recipientId: merchantId,
        type: "DINA_CONSTRAINT_EXPIRED",
        title: "قيد تفاوض منتهي الصلاحية",
        body: `القيد "${constraint.name}" انتهت صلاحيته في ${constraint.expiresAt?.toISOString()}. الرجاء تجديد القيد لاستمرار المفاوضات التلقائية.`,
        data: {
          constraintId: constraint.id,
          constraintName: constraint.name,
          expiredAt: constraint.expiresAt?.toISOString(),
          action: "RENEW_CONSTRAINT",
        },
        isRead: false,
      });
    }

    res.json({
      constraintId: constraint.id,
      constraintName: constraint.name,
      canNegotiate: allPassed,
      outcome: allPassed ? "DINA_READY" : "DINA_BLOCKED",
      checks,
      constraint: {
        minDiscountPct: constraint.minDiscountPct,
        maxDiscountPct: constraint.maxDiscountPct,
        stepPct: constraint.stepPct,
        maxRounds: constraint.maxRounds,
        lifetime: constraint.lifetime,
        expiresAt: constraint.expiresAt,
      },
      ...(isExpired && {
        notification: "تم إرسال تنبيه للتاجر بانتهاء صلاحية القيد ✅",
      }),
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
