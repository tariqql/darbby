/**
 * DINA Constraints API
 * POST /api/dina/constraints        — Create constraint (validates S01-S03)
 * GET  /api/dina/constraints        — List merchant constraints
 * POST /api/dina/session/check      — Expired constraint check (S04)
 * POST /api/dina/session/trigger    — Full trigger evaluation (S05-S09)
 */

import { Router } from "express";
import { dinaDb, sharedDb, merchantsDb, customersDb,
  dinaConstraints, dinaConstraintProducts, dinaMerchants, dinaTenants, dinaSessions,
  notifications, trips } from "@workspace/db";
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

// ─── POST /api/dina/session/trigger ──────────────────────────────────────────
// S05-S09: Full pre-negotiation trigger evaluation
// Accepts real IDs or _mock overrides for each check
//
// Skip reasons (dinaSkipReasonEnum):
//   S05 → ROUTE_TOO_FAR
//   S06 → CUSTOMER_NO_OFFERS
//   S07 → BRANCH_CLOSED
//   S08 → INTEREST_MISMATCH
//   S09 → NO_POLICY
router.post("/session/trigger", async (req, res) => {
  const { id: merchantId } = auth(req);
  const {
    // Real IDs (optional — use _mock if not provided)
    tripId,
    customerId,
    branchId,
    productId,
    // Mock overrides for each check
    _mock = {},
  } = req.body;

  const {
    tripDistanceKm,          // S05: km distance from branch (number)
    branchRadiusKm,          // S05: branch service radius (number)
    customerAcceptOffers,    // S06: boolean override
    branchWorkingHours,      // S07: { monday: {open:"08:00",close:"22:00"}, ... }
    nowDayTime,              // S07: { day:"monday", time:"03:00" } to simulate closed time
    tripInterests,           // S08: string[] of interest categories
    merchantCategories,      // S08: string[] of merchant product categories
    productHasConstraint,    // S09: boolean override
    noPolicyWaitMinutes,     // S09: simulate wait time (default 3)
  } = _mock as Record<string, any>;

  type CheckResult = { passed: boolean; skipReason?: string; detail: string; data?: Record<string, any> };
  const checks: Record<string, CheckResult> = {};
  let firstFailReason: string | null = null;

  // ── HELPER: record first failure ────────────────────────────────────────────
  function fail(key: string, skipReason: string, detail: string, data?: Record<string, any>) {
    checks[key] = { passed: false, skipReason, detail, data };
    if (!firstFailReason) firstFailReason = skipReason;
  }
  function pass(key: string, detail: string, data?: Record<string, any>) {
    checks[key] = { passed: true, detail, data };
  }

  try {
    const dinaMerchantId = await ensureDinaMerchant(merchantId);

    // ══════════════════════════════════════════════════════════════════
    // CHECK 1 — S06: Trip accept_offers flag
    // accept_offers lives on the trips table (sharedDb), not the user
    // ══════════════════════════════════════════════════════════════════
    let acceptOffers: boolean;
    if (customerAcceptOffers !== undefined) {
      acceptOffers = Boolean(customerAcceptOffers);
    } else if (tripId) {
      const [trip] = await sharedDb.select({ acceptOffers: trips.acceptOffers })
        .from(trips).where(eq(trips.id, tripId)).limit(1);
      acceptOffers = trip?.acceptOffers ?? true;
    } else {
      acceptOffers = true; // default when no data provided
    }

    if (!acceptOffers) {
      fail("acceptOffers", "CUSTOMER_NO_OFFERS",
        "الرحلة معطّلة لاستقبال العروض (accept_offers=false) — DINA صامتة تماماً ✅",
        { tripId, acceptOffers });
    } else {
      pass("acceptOffers", `الرحلة تقبل العروض ✅`, { acceptOffers });
    }

    // ══════════════════════════════════════════════════════════════════
    // CHECK 2 — S05: Route within branch radius
    // ══════════════════════════════════════════════════════════════════
    if (!firstFailReason) {
      let withinRadius: boolean;
      let distKm: number | null = null;
      let radiusKm: number | null = null;

      if (tripDistanceKm !== undefined && branchRadiusKm !== undefined) {
        distKm = parseFloat(tripDistanceKm);
        radiusKm = parseFloat(branchRadiusKm);
        withinRadius = distKm <= radiusKm;
      } else if (tripId && branchId) {
        // Real PostGIS check: minimum distance from trip route to branch location
        const result = await sharedDb.execute(sql`
          SELECT ST_Distance(
            (SELECT route_geom FROM trips WHERE id = ${tripId}::uuid),
            (SELECT location FROM darbby_merchants.merchant_branches WHERE id = ${branchId}::uuid),
            true
          ) / 1000.0 AS dist_km,
          (SELECT service_radius_km FROM darbby_merchants.merchant_branches WHERE id = ${branchId}::uuid) AS radius_km
        `);
        const rows = (result as any).rows ?? (result as any);
        const row = rows[0];
        distKm = parseFloat(row?.dist_km ?? "999");
        radiusKm = parseFloat(row?.radius_km ?? "10");
        withinRadius = distKm <= radiusKm;
      } else {
        withinRadius = true; // no data to check
      }

      if (!withinRadius) {
        fail("routeWithinRadius", "ROUTE_TOO_FAR",
          `الرحلة بعيدة ${distKm?.toFixed(1)}km عن الفرع — النطاق الأقصى ${radiusKm}km ❌ — DINA توقف وتسجل ROUTE_TOO_FAR`,
          { distanceKm: distKm, radiusKm, withinRadius });
      } else {
        pass("routeWithinRadius", `الرحلة ضمن نطاق الفرع ✅`, { distanceKm: distKm, radiusKm });
      }
    } else {
      checks.routeWithinRadius = { passed: true, detail: "تخطي — فحص سابق فشل" };
    }

    // ══════════════════════════════════════════════════════════════════
    // CHECK 3 — S07: Branch is open now
    // ══════════════════════════════════════════════════════════════════
    if (!firstFailReason) {
      let branchOpen: boolean;
      let workingHoursUsed: any = null;
      let dayUsed: string = "";
      let timeUsed: string = "";

      const DAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

      if (branchWorkingHours !== undefined) {
        workingHoursUsed = branchWorkingHours;
        // Use provided nowDayTime or actual current time
        const now = new Date();
        dayUsed = nowDayTime?.day ?? DAYS[now.getDay()];
        timeUsed = nowDayTime?.time ?? `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

        const todayHours = workingHoursUsed[dayUsed];
        if (!todayHours || todayHours.closed) {
          branchOpen = false;
        } else {
          branchOpen = timeUsed >= todayHours.open && timeUsed <= todayHours.close;
        }
      } else if (branchId) {
        const result = await merchantsDb.execute(sql`
          SELECT working_hours FROM merchant_branches WHERE id = ${branchId}::uuid
        `);
        const wRows = (result as any).rows ?? (result as any);
        const row = wRows[0];
        workingHoursUsed = row?.working_hours;
        if (!workingHoursUsed) {
          branchOpen = true; // no hours set = always open
        } else {
          const now = new Date();
          dayUsed = DAYS[now.getDay()];
          timeUsed = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
          const todayHours = workingHoursUsed[dayUsed];
          branchOpen = !todayHours?.closed && timeUsed >= (todayHours?.open ?? "00:00") && timeUsed <= (todayHours?.close ?? "23:59");
        }
      } else {
        branchOpen = true;
      }

      if (!branchOpen) {
        fail("branchOpen", "BRANCH_CLOSED",
          `الفرع مغلق الآن (${dayUsed} ${timeUsed}) ❌ — ساعات العمل: ${JSON.stringify(workingHoursUsed?.[dayUsed])}`,
          { day: dayUsed, time: timeUsed, workingHours: workingHoursUsed?.[dayUsed] });
      } else {
        pass("branchOpen", `الفرع مفتوح الآن ✅`, { day: dayUsed, time: timeUsed });
      }
    } else {
      checks.branchOpen = { passed: true, detail: "تخطي — فحص سابق فشل" };
    }

    // ══════════════════════════════════════════════════════════════════
    // CHECK 4 — S08: Interest match
    // ══════════════════════════════════════════════════════════════════
    if (!firstFailReason) {
      let interestMatched: boolean;
      let interests: string[] = [];
      let categories: string[] = [];

      if (tripInterests !== undefined && merchantCategories !== undefined) {
        interests = (tripInterests as string[]).map(s => s.toLowerCase().trim());
        categories = (merchantCategories as string[]).map(s => s.toLowerCase().trim());
        interestMatched = interests.some(i => categories.includes(i));
      } else if (tripId) {
        // Look up dina_trip_interests for this trip and merchant's product categories
        const [tenant] = await dinaDb.select({ id: dinaTenants.id })
          .from(dinaTenants).where(eq(dinaTenants.name, "Darbby Platform")).limit(1);
        const dinaInterests = tenant ? await dinaDb.execute(sql`
          SELECT category_name FROM dina_trip_interests
          WHERE external_trip_id = ${tripId}::uuid AND tenant_id = ${tenant.id}::uuid
        `) : { rows: [] };
        interests = ((dinaInterests as any).rows ?? []).map((r: any) => r.category_name.toLowerCase());
        interestMatched = interests.length === 0 ? true : false; // no interests = no filter
      } else {
        interestMatched = true;
      }

      if (!interestMatched && interests.length > 0) {
        const matched = interests.filter(i => categories.includes(i));
        fail("interestMatch", "INTEREST_MISMATCH",
          `لا تطابق: العميل مهتم بـ [${interests.join(", ")}] والتاجر يبيع [${categories.join(", ")}] ❌`,
          { tripInterests: interests, merchantCategories: categories, matched });
      } else {
        const matched = interests.filter(i => categories.includes(i));
        pass("interestMatch", `تطابق الاهتمامات ✅ — مشترك: [${matched.join(", ") || "الكل"}]`,
          { tripInterests: interests, merchantCategories: categories });
      }
    } else {
      checks.interestMatch = { passed: true, detail: "تخطي — فحص سابق فشل" };
    }

    // ══════════════════════════════════════════════════════════════════
    // CHECK 5 — S09: Product has active DINA constraint
    // ══════════════════════════════════════════════════════════════════
    if (!firstFailReason) {
      let hasConstraint: boolean;
      let waitMinutes = noPolicyWaitMinutes ?? 3;
      let constraintFound: any = null;

      if (productHasConstraint !== undefined) {
        hasConstraint = Boolean(productHasConstraint);
      } else if (productId) {
        const now = new Date();
        const result = await dinaDb.execute(sql`
          SELECT dc.id, dc.name FROM dina_constraint_products dcp
          JOIN dina_constraints dc ON dc.id = dcp.constraint_id
          JOIN dina_merchants dm ON dm.id = dc.merchant_id
          WHERE dcp.external_product_id = ${productId}::uuid
            AND dm.external_merchant_id = ${merchantId}::uuid
            AND dc.is_active = true
            AND (dc.expires_at IS NULL OR dc.expires_at > NOW())
          LIMIT 1
        `);
        const row = (result as any).rows?.[0] ?? (result as any)[0];
        hasConstraint = !!row;
        constraintFound = row ?? null;
      } else {
        hasConstraint = false; // no productId = simulate no policy
      }

      if (!hasConstraint) {
        fail("hasConstraint", "NO_POLICY",
          `لا يوجد قيد تفاوض نشط للمنتج — DINA انتظرت ${waitMinutes} دقائق ثم سجّلت no_policy_found ❌`,
          { productId, waitedMinutes: waitMinutes, constraintFound: null });
      } else {
        pass("hasConstraint", `يوجد قيد تفاوض نشط ✅`, { constraintFound });
      }
    } else {
      checks.hasConstraint = { passed: true, detail: "تخطي — فحص سابق فشل" };
    }

    // ══════════════════════════════════════════════════════════════════
    // LOG: Write CANCELLED dina_session with trigger_checks JSONB
    // ══════════════════════════════════════════════════════════════════
    const allPassed = !firstFailReason;
    const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

    let sessionId: string | null = null;
    if (!allPassed) {
      const [tenant] = await dinaDb.select({ id: dinaTenants.id })
        .from(dinaTenants).where(eq(dinaTenants.name, "Darbby Platform")).limit(1);

      if (tenant) {
        const [session] = await dinaDb.insert(dinaSessions).values({
          tenantId: tenant.id,
          merchantId: dinaMerchantId,
          externalTripId: tripId ?? DUMMY_UUID,
          externalCustomerId: customerId ?? DUMMY_UUID,
          externalBranchId: branchId ?? DUMMY_UUID,
          constraintId: null,
          autonomyLevel: "LEVEL_1",
          status: "CANCELLED",
          outcome: null,
          openingPrice: "0",
          triggerChecks: {
            evaluatedAt: new Date().toISOString(),
            skipReason: firstFailReason,
            checks,
            isMockTest: Object.keys(_mock).length > 0,
          },
          customerProfileSnapshot: {},
          merchantProfileSnapshot: {},
        }).returning({ id: dinaSessions.id });
        sessionId = session?.id ?? null;
      }
    }

    // Build human-readable summary
    const summary: Record<string, string> = {
      acceptOffers:     checks.acceptOffers?.detail ?? "—",
      routeWithinRadius: checks.routeWithinRadius?.detail ?? "—",
      branchOpen:       checks.branchOpen?.detail ?? "—",
      interestMatch:    checks.interestMatch?.detail ?? "—",
      hasConstraint:    checks.hasConstraint?.detail ?? "—",
    };

    res.json({
      canNegotiate: allPassed,
      outcome: allPassed ? "DINA_READY" : "DINA_BLOCKED",
      skipReason: firstFailReason,
      sessionLogged: sessionId ? { id: sessionId, status: "CANCELLED" } : null,
      checks,
      summary,
      ...(allPassed && {
        next: "DINA جاهزة لبدء جلسة التفاوض — استدعِ POST /api/dina/session/start",
      }),
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

