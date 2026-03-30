import {
  pgTable,
  uuid,
  text,
  boolean,
  decimal,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const offerStatusEnum = pgEnum("offer_status", [
  "SENT",
  "VIEWED",
  "NEGOTIATING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "FINALIZED",
]);

export const offerSourceEnum = pgEnum("offer_source", [
  "MERCHANT",
  "DINA",
]);

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id").notNull(),
  merchantId: uuid("merchant_id").notNull(),
  branchId: uuid("branch_id"),
  message: text("message"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }),
  status: offerStatusEnum("status").default("SENT"),
  isAutoOffer: boolean("is_auto_offer").default(false),
  offerSource: offerSourceEnum("offer_source").notNull().default("MERCHANT"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const offerItems = pgTable("offer_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 0 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  negotiatedPrice: decimal("negotiated_price", { precision: 10, scale: 2 }),
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  merchantId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type Offer = typeof offers.$inferSelect;
export type OfferItem = typeof offerItems.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
