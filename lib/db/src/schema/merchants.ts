import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const merchantStatusEnum = pgEnum("merchant_status", [
  "PENDING",
  "DOCUMENTS_UPLOADED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "FREE",
  "BASIC",
  "PRO",
  "PREMIUM",
]);

export const merchants = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessName: varchar("business_name", { length: 150 }).notNull(),
  ownerName: varchar("owner_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fcmToken: text("fcm_token"),
  commercialRegNo: varchar("commercial_reg_no", { length: 50 }).notNull().unique(),
  commercialRegDocUrl: text("commercial_reg_doc_url").notNull(),
  commercialRegExpiry: date("commercial_reg_expiry").notNull(),
  status: merchantStatusEnum("status").default("PENDING"),
  rejectionReason: text("rejection_reason"),
  reviewedByAdminId: uuid("reviewed_by_admin_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  nationalAddress: text("national_address"),
  nafathVerified: boolean("nafath_verified").default(false),
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").default("FREE"),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertMerchantSchema = createInsertSchema(merchants).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(8),
});

export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
