import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  decimal,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { merchants } from "./merchants";

export const branchStatusEnum = pgEnum("branch_status", [
  "ACTIVE",
  "INACTIVE",
  "TEMPORARILY_CLOSED",
]);

export const merchantBranches = pgTable("merchant_branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  branchName: varchar("branch_name", { length: 150 }).notNull(),
  branchCode: varchar("branch_code", { length: 20 }),
  addressText: text("address_text"),
  serviceRadiusKm: decimal("service_radius_km", { precision: 5, scale: 2 }).notNull().default("10.00"),
  status: branchStatusEnum("status").notNull().default("ACTIVE"),
  isPrimary: boolean("is_primary").notNull().default(false),
  workingHours: jsonb("working_hours"),
  phone: varchar("phone", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertMerchantBranchSchema = createInsertSchema(merchantBranches).omit({
  id: true,
  merchantId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  lat: z.number(),
  lng: z.number(),
});

export type MerchantBranch = typeof merchantBranches.$inferSelect;
export type InsertMerchantBranch = z.infer<typeof insertMerchantBranchSchema>;
