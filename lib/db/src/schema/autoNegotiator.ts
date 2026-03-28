import {
  pgTable,
  uuid,
  boolean,
  decimal,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { merchants } from "./merchants";
import { products } from "./products";

export const autoNegotiatorSettings = pgTable("auto_negotiator_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull().unique().references(() => merchants.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").default(false),
  responseDelayMin: integer("response_delay_min").default(5),
  purposeRules: jsonb("purpose_rules").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const autoNegotiatorProducts = pgTable("auto_negotiator_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiatorId: uuid("negotiator_id").notNull().references(() => autoNegotiatorSettings.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  minDiscountPct: decimal("min_discount_pct", { precision: 5, scale: 2 }).notNull(),
  maxDiscountPct: decimal("max_discount_pct", { precision: 5, scale: 2 }).notNull(),
});

export const insertAutoNegSettingsSchema = createInsertSchema(autoNegotiatorSettings).omit({
  id: true,
  merchantId: true,
  createdAt: true,
  updatedAt: true,
});

export type AutoNegotiatorSettings = typeof autoNegotiatorSettings.$inferSelect;
export type InsertAutoNegSettings = z.infer<typeof insertAutoNegSettingsSchema>;
