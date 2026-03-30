import crypto from "crypto";
import { sharedDb, sharedPool } from "@workspace/db";
import { webhookRegistrations, webhookDeliveries } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export async function dispatchWebhook(
  merchantId: string,
  eventType: string,
  data: Record<string, any>
): Promise<void> {
  // Find active webhooks for this merchant that subscribe to this event
  const webhooks = await sharedDb
    .select()
    .from(webhookRegistrations)
    .where(
      and(
        eq(webhookRegistrations.merchantId, merchantId),
        eq(webhookRegistrations.isActive, true)
      )
    );

  const matchingWebhooks = webhooks.filter((w) => {
    const events = (w.events as string[]) || [];
    return events.includes(eventType) || events.includes("*");
  });

  if (!matchingWebhooks.length) return;

  const payload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadStr = JSON.stringify(payload);

  for (const webhook of matchingWebhooks) {
    // Create delivery record
    const [delivery] = await sharedDb.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      orderId: data.order_id || null,
      eventType,
      payload,
      status: "PENDING",
      attempts: 0,
    }).returning();

    // Fire and forget with retry logic
    sendWithRetry(webhook, delivery.id, payloadStr, payload).catch(() => {});
  }
}

async function sendWithRetry(
  webhook: any,
  deliveryId: string,
  payloadStr: string,
  payload: any,
  attempt = 1
): Promise<void> {
  const signature = crypto
    .createHmac("sha256", webhook.secret)
    .update(payloadStr)
    .digest("hex");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Darbby-Signature": `sha256=${signature}`,
        "X-Darbby-Event": payload.event,
        "X-Darbby-Delivery": deliveryId,
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      // Success
      await sharedPool.query(
        `UPDATE webhook_deliveries
         SET status = 'DELIVERED', http_status = $1, response_body = $2,
             attempts = $3, delivered_at = NOW(), last_attempt_at = NOW()
         WHERE id = $4::uuid`,
        [response.status, responseBody.slice(0, 1000), attempt, deliveryId]
      );

      await sharedPool.query(
        `UPDATE webhook_registrations
         SET last_success_at = NOW(), failure_count = 0 WHERE id = $1::uuid`,
        [webhook.id]
      );
    } else {
      throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
    }
  } catch (err: any) {
    const maxAttempts = 3;
    const nextAttempt = attempt + 1;
    const retryDelays = [0, 60000, 300000]; // 0, 1min, 5min

    await sharedPool.query(
      `UPDATE webhook_deliveries
       SET status = $1, attempts = $2, last_attempt_at = NOW(),
           next_retry_at = $3, response_body = $4
       WHERE id = $5::uuid`,
      [
        attempt >= maxAttempts ? "FAILED" : "RETRYING",
        attempt,
        attempt < maxAttempts ? new Date(Date.now() + retryDelays[attempt]) : null,
        err.message?.slice(0, 500) || "Unknown error",
        deliveryId,
      ]
    );

    await sharedPool.query(
      `UPDATE webhook_registrations
       SET last_failure_at = NOW(), failure_count = failure_count + 1 WHERE id = $1::uuid`,
      [webhook.id]
    );

    if (attempt < maxAttempts) {
      setTimeout(() => {
        sendWithRetry(webhook, deliveryId, payloadStr, payload, nextAttempt).catch(() => {});
      }, retryDelays[attempt]);
    }
  }
}
