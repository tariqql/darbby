import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderStatusEnum = pgEnum("order_status", [
  "OPEN",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "CARD",
  "WALLET",
]);

export const receiptStatusEnum = pgEnum("receipt_status", [
  "ACTIVE",
  "VOIDED",
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  offerId: uuid("offer_id").notNull().unique(),
  tripId: uuid("trip_id").notNull(),
  userId: uuid("user_id").notNull(),
  merchantId: uuid("merchant_id").notNull(),
  branchId: uuid("branch_id"),
  barcode: varchar("barcode", { length: 30 }).notNull().unique(),
  status: orderStatusEnum("status").notNull().default("OPEN"),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: varchar("cancel_reason", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).notNull(),
  totalWithVat: decimal("total_with_vat", { precision: 10, scale: 2 }).notNull(),
  cashierId: varchar("cashier_id", { length: 50 }),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("CASH"),
  posReceiptNumber: varchar("pos_receipt_number", { length: 100 }),
  invoiceNumber: varchar("invoice_number", { length: 50 }).unique(),
  status: receiptStatusEnum("status").notNull().default("ACTIVE"),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: varchar("void_reason", { length: 500 }),
  voidedByCashierId: varchar("voided_by_cashier_id", { length: 50 }),
  closeTime: timestamp("close_time", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true, createdAt: true });

export type Order = typeof orders.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
