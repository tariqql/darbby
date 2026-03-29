import {
  pgTable,
  uuid,
  decimal,
  timestamp,
  pgEnum,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { offers } from "./offers";

export const txnStatusEnum = pgEnum("txn_status", [
  "PENDING",
  "COMPLETED",
  "REFUNDED",
  "FAILED",
]);

export const ledgerStatusEnum = pgEnum("ledger_status", [
  "PENDING",
  "INVOICED",
  "COLLECTED",
  "DISPUTED",
  "WAIVED",
]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  offerId: uuid("offer_id").notNull().unique().references(() => offers.id),
  merchantId: uuid("merchant_id").notNull(),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(),
  commissionPct: decimal("commission_pct", { precision: 5, scale: 2 }).notNull(),
  commissionAmt: decimal("commission_amt", { precision: 10, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }).notNull(),
  status: txnStatusEnum("status").default("PENDING"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const commissionLedger = pgTable("commission_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  offerId: uuid("offer_id").notNull().unique().references(() => offers.id),
  transactionId: uuid("transaction_id"),  // nullable in DB
  merchantId: uuid("merchant_id").notNull(),
  branchId: uuid("branch_id"),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(),
  commissionRatePct: decimal("commission_rate_pct", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  netToMerchant: decimal("net_to_merchant", { precision: 10, scale: 2 }).notNull(),
  ledgerStatus: ledgerStatusEnum("ledger_status").notNull().default("PENDING"),
  invoiceNo: varchar("invoice_no", { length: 50 }).unique(),
  invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
  collectedAt: timestamp("collected_at", { withTimezone: true }),
  collectionMethod: varchar("collection_method", { length: 50 }),
  collectionRef: varchar("collection_ref", { length: 150 }),
  disputeReason: varchar("dispute_reason", { length: 500 }),
  rateSetBy: uuid("rate_set_by"),
  rateSetAt: timestamp("rate_set_at", { withTimezone: true }).defaultNow(),
  notes: varchar("notes", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type Transaction = typeof transactions.$inferSelect;
export type CommissionLedger = typeof commissionLedger.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
