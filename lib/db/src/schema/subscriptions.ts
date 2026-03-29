import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { merchants } from "./merchants";

export const subscriptionPlanTypeEnum = pgEnum("subscription_plan_type", [
  "FREE",
  "PREMIUM",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  plan: subscriptionPlanTypeEnum("plan").notNull().default("FREE"),
  status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  currency: varchar("currency", { length: 3 }).notNull().default("SAR"),
  paymentRef: varchar("payment_ref", { length: 150 }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  merchantId: true,
  createdAt: true,
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
