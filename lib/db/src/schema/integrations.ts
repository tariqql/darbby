import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiKeyTypeEnum = pgEnum("api_key_type", [
  "LIVE",
  "TEST",
]);

export const webhookStatusEnum = pgEnum("webhook_status", [
  "PENDING",
  "DELIVERED",
  "FAILED",
  "RETRYING",
]);

export const merchantApiKeys = pgTable("merchant_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),
  apiKey: varchar("api_key", { length: 80 }).notNull().unique(),
  keyType: apiKeyTypeEnum("key_type").notNull().default("LIVE"),
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),
  description: varchar("description", { length: 200 }),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const webhookRegistrations = pgTable("webhook_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  events: jsonb("events").notNull().default(["order.created", "order.confirmed", "order.expired", "order.cancelled"]),
  secret: varchar("secret", { length: 100 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  description: varchar("description", { length: 200 }),
  failureCount: integer("failure_count").notNull().default(0),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id").notNull(),
  orderId: uuid("order_id"),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: webhookStatusEnum("status").notNull().default("PENDING"),
  httpStatus: integer("http_status"),
  responseBody: text("response_body"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertMerchantApiKeySchema = createInsertSchema(merchantApiKeys).omit({ id: true, createdAt: true });
export const insertWebhookSchema = createInsertSchema(webhookRegistrations).omit({ id: true, createdAt: true, updatedAt: true });

export type MerchantApiKey = typeof merchantApiKeys.$inferSelect;
export type WebhookRegistration = typeof webhookRegistrations.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
