import { Router } from "express";
import { sharedDb, sharedPool } from "@workspace/db";
import { webhookRegistrations, webhookDeliveries } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, JwtPayload } from "../lib/auth.js";
import crypto from "crypto";

const router = Router();
router.use(authenticate);

function auth(req: any): JwtPayload { return req.auth; }

function generateWebhookSecret(): string {
  return "whsec_" + crypto.randomBytes(32).toString("hex");
}

// POST /api/webhooks/configure
// تسجيل webhook جديد لنظام POS الخارجي
router.post("/configure", async (req, res) => {
  const { actor, merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN", message: "يتطلب صلاحية تاجر" });
    return;
  }

  const { url, events, description } = req.body;

  if (!url) {
    res.status(400).json({ error: "MISSING_URL", message: "URL مطلوب" });
    return;
  }

  try { new URL(url); } catch {
    res.status(400).json({ error: "INVALID_URL", message: "الرابط غير صالح" });
    return;
  }

  const validEvents = ["order.created", "order.confirmed", "order.expired", "order.cancelled", "*"];
  const requestedEvents: string[] = Array.isArray(events)
    ? events.filter((e: string) => validEvents.includes(e))
    : ["order.created", "order.confirmed", "order.expired", "order.cancelled"];

  const secret = generateWebhookSecret();

  const [webhook] = await sharedDb.insert(webhookRegistrations).values({
    merchantId,
    url,
    events: requestedEvents,
    secret,
    description: description || null,
    isActive: true,
  }).returning();

  res.status(201).json({
    success: true,
    webhook: {
      webhook_id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret,
      is_active: webhook.isActive,
      created_at: webhook.createdAt,
    },
    note: "احتفظ بالـ secret لأنه لن يُعرض مرة أخرى. استخدمه للتحقق من صحة الإشعارات الواردة (HMAC-SHA256).",
  });
});

// GET /api/webhooks
// قائمة webhooks التاجر
router.get("/", async (req, res) => {
  const { actor, merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const webhooks = await sharedDb
    .select({
      id: webhookRegistrations.id,
      url: webhookRegistrations.url,
      events: webhookRegistrations.events,
      isActive: webhookRegistrations.isActive,
      description: webhookRegistrations.description,
      failureCount: webhookRegistrations.failureCount,
      lastSuccessAt: webhookRegistrations.lastSuccessAt,
      lastFailureAt: webhookRegistrations.lastFailureAt,
      createdAt: webhookRegistrations.createdAt,
    })
    .from(webhookRegistrations)
    .where(eq(webhookRegistrations.merchantId, merchantId))
    .orderBy(desc(webhookRegistrations.createdAt));

  res.json({ webhooks });
});

// PUT /api/webhooks/:webhook_id
// تفعيل/تعطيل webhook
router.put("/:webhook_id", async (req, res) => {
  const { actor, merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const { is_active, url, events } = req.body;

  const [webhook] = await sharedDb
    .select()
    .from(webhookRegistrations)
    .where(
      and(
        eq(webhookRegistrations.id, req.params.webhook_id),
        eq(webhookRegistrations.merchantId, merchantId)
      )
    )
    .limit(1);

  if (!webhook) {
    res.status(404).json({ error: "WEBHOOK_NOT_FOUND" });
    return;
  }

  const updateData: any = { updatedAt: new Date() };
  if (is_active !== undefined) updateData.isActive = is_active;
  if (url) updateData.url = url;
  if (events) updateData.events = events;

  const [updated] = await sharedDb
    .update(webhookRegistrations)
    .set(updateData)
    .where(eq(webhookRegistrations.id, webhook.id))
    .returning();

  res.json({ success: true, webhook: updated });
});

// DELETE /api/webhooks/:webhook_id
router.delete("/:webhook_id", async (req, res) => {
  const { actor, merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const [webhook] = await sharedDb
    .select()
    .from(webhookRegistrations)
    .where(
      and(
        eq(webhookRegistrations.id, req.params.webhook_id),
        eq(webhookRegistrations.merchantId, merchantId)
      )
    )
    .limit(1);

  if (!webhook) {
    res.status(404).json({ error: "WEBHOOK_NOT_FOUND" });
    return;
  }

  await sharedDb.delete(webhookRegistrations).where(eq(webhookRegistrations.id, webhook.id));

  res.json({ success: true, message: "تم حذف الـ webhook" });
});

// GET /api/webhooks/:webhook_id/deliveries
// سجل التسليمات
router.get("/:webhook_id/deliveries", async (req, res) => {
  const { actor, merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const [webhook] = await sharedDb
    .select()
    .from(webhookRegistrations)
    .where(
      and(
        eq(webhookRegistrations.id, req.params.webhook_id),
        eq(webhookRegistrations.merchantId, merchantId)
      )
    )
    .limit(1);

  if (!webhook) {
    res.status(404).json({ error: "WEBHOOK_NOT_FOUND" });
    return;
  }

  const deliveries = await sharedDb
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhook.id))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(50);

  res.json({ deliveries });
});

// POST /api/webhooks/:webhook_id/test
// إرسال حدث تجريبي للتحقق من الاتصال
router.post("/:webhook_id/test", async (req, res) => {
  const { actor, merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const [webhook] = await sharedDb
    .select()
    .from(webhookRegistrations)
    .where(
      and(
        eq(webhookRegistrations.id, req.params.webhook_id),
        eq(webhookRegistrations.merchantId, merchantId)
      )
    )
    .limit(1);

  if (!webhook) {
    res.status(404).json({ error: "WEBHOOK_NOT_FOUND" });
    return;
  }

  const testPayload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    data: {
      message: "هذا اختبار من منصة درباي — دربي",
      webhook_id: webhook.id,
    },
  };

  const payloadStr = JSON.stringify(testPayload);
  const signature = crypto
    .createHmac("sha256", webhook.secret)
    .update(payloadStr)
    .digest("hex");

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Darbby-Signature": `sha256=${signature}`,
        "X-Darbby-Event": "webhook.test",
      },
      body: payloadStr,
      signal: controller.signal,
    });

    res.json({
      success: response.ok,
      http_status: response.status,
      message: response.ok ? "الاتصال ناجح ✓" : `فشل الاتصال: HTTP ${response.status}`,
    });
  } catch (err: any) {
    res.json({
      success: false,
      message: `فشل الاتصال: ${err.message}`,
    });
  }
});

export default router;
