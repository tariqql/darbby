import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  decimal,
  integer,
  smallint,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ═══════════════════════════════════════════
// DINA ENUM TYPES
// ═══════════════════════════════════════════

export const dinaBillingModelEnum = pgEnum("dina_billing_model", [
  "PER_SESSION",
  "MONTHLY_CAP",
  "REVENUE_SHARE",
  "ENTERPRISE",
]);

export const dinaTenantTypeEnum = pgEnum("dina_tenant_type", [
  "SAAS",
  "WHITE_LABEL",
  "API",
]);

export const dinaMerchantPlanEnum = pgEnum("dina_merchant_plan", [
  "BASIC",
  "PRO",
  "PREMIUM",
]);

export const dinaAutonomyLevelEnum = pgEnum("dina_autonomy_level", [
  "LEVEL_1",
  "LEVEL_2",
]);

export const dinaConstraintLifetimeEnum = pgEnum("dina_constraint_lifetime", [
  "PERMANENT",
  "TEMPORARY",
]);

export const dinaSessionStatusEnum = pgEnum("dina_session_status", [
  "PENDING",
  "ACTIVE",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

export const dinaSessionOutcomeEnum = pgEnum("dina_session_outcome", [
  "DEAL_CLOSED",
  "REJECTED_BY_CUSTOMER",
  "REJECTED_BY_MERCHANT",
  "TIMEOUT",
  "NO_POLICY",
  "SUBSCRIPTION_EXPIRED",
  "BRANCH_PASSED",
]);

export const dinaRoundStatusEnum = pgEnum("dina_round_status", [
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "COUNTER_OFFER",
  "TIMEOUT",
  "SKIPPED",
]);

export const dinaRoundActorEnum = pgEnum("dina_round_actor", [
  "DINA",
  "CUSTOMER",
  "MERCHANT",
]);

export const dinaBarcodeStatusEnum = pgEnum("dina_barcode_status", [
  "ACTIVE",
  "USED",
  "EXPIRED",
  "TRANSFERRED",
  "CANCELLED",
]);

export const dinaSkipReasonEnum = pgEnum("dina_skip_reason", [
  "NO_ACTIVE_TRIP",
  "ROUTE_TOO_FAR",
  "CUSTOMER_NO_OFFERS",
  "INTEREST_MISMATCH",
  "BRANCH_CLOSED",
  "NO_POLICY",
  "SUBSCRIPTION_EXPIRED",
]);

export const dinaHitlStatusEnum = pgEnum("dina_hitl_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "TIMEOUT",
]);

export const dinaLearningEventEnum = pgEnum("dina_learning_event", [
  "DEAL_CLOSED_ROUND_1",
  "DEAL_CLOSED_ROUND_2",
  "DEAL_CLOSED_ROUND_3",
  "CUSTOMER_REJECTED_ALL",
  "COUNTER_ACCEPTED",
  "TIMEOUT_LOSS",
]);

// ═══════════════════════════════════════════
// 1. TENANT LAYER
// ═══════════════════════════════════════════

export const dinaTenants = pgTable("dina_tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull(),
  tenantType: dinaTenantTypeEnum("tenant_type").notNull(),
  apiKey: varchar("api_key", { length: 255 }).notNull().unique(),
  apiKeyHash: varchar("api_key_hash", { length: 255 }).notNull(),
  billingModel: dinaBillingModelEnum("billing_model").notNull(),
  rateLimitRpm: integer("rate_limit_rpm").default(60),
  monthlySessionCap: integer("monthly_session_cap"),
  revenueSharePct: decimal("revenue_share_pct", { precision: 5, scale: 2 }),
  webhookUrl: text("webhook_url"),
  webhookSecret: varchar("webhook_secret", { length: 255 }),
  isActive: boolean("is_active").default(true),
  platformMaxDiscountPct: decimal("platform_max_discount_pct", { precision: 5, scale: 2 }).default("30.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const dinaTenantSubscriptions = pgTable("dina_tenant_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => dinaTenants.id, { onDelete: "cascade" }),
  planName: varchar("plan_name", { length: 100 }).notNull(),
  pricePaid: decimal("price_paid", { precision: 10, scale: 2 }).notNull(),
  sessionsUsed: integer("sessions_used").default(0),
  sessionsLimit: integer("sessions_limit"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════
// 2. MERCHANT LAYER (DINA side)
// ═══════════════════════════════════════════

export const dinaMerchants = pgTable("dina_merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => dinaTenants.id, { onDelete: "cascade" }),
  externalMerchantId: uuid("external_merchant_id").notNull(),
  plan: dinaMerchantPlanEnum("plan").notNull().default("BASIC"),
  autonomyLevel: dinaAutonomyLevelEnum("autonomy_level"),
  hitlTimeoutMin: integer("hitl_timeout_min").default(5),
  isActive: boolean("is_active").default(true),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════
// 3. CONSTRAINT LAYER
// ═══════════════════════════════════════════

export const dinaConstraints = pgTable("dina_constraints", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull().references(() => dinaMerchants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  minDiscountPct: decimal("min_discount_pct", { precision: 5, scale: 2 }).notNull(),
  maxDiscountPct: decimal("max_discount_pct", { precision: 5, scale: 2 }).notNull(),
  stepPct: decimal("step_pct", { precision: 5, scale: 2 }).notNull(),
  maxRounds: integer("max_rounds").notNull().default(1),
  noResponseTimeoutMin: integer("no_response_timeout_min").default(3),
  lifetime: dinaConstraintLifetimeEnum("lifetime").notNull().default("PERMANENT"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const dinaConstraintProducts = pgTable("dina_constraint_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  constraintId: uuid("constraint_id").notNull().references(() => dinaConstraints.id, { onDelete: "cascade" }),
  externalProductId: uuid("external_product_id").notNull(),
  productName: varchar("product_name", { length: 150 }).notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════
// 4. TRIP INTERESTS
// ═══════════════════════════════════════════

export const dinaTripInterests = pgTable("dina_trip_interests", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalTripId: uuid("external_trip_id").notNull(),
  externalCustomerId: uuid("external_customer_id").notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => dinaTenants.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull(),
  categoryName: varchar("category_name", { length: 100 }).notNull(),
  subcategoryId: uuid("subcategory_id"),
  subcategoryName: varchar("subcategory_name", { length: 100 }),
  priority: smallint("priority").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════
// 5. SESSION LAYER
// ═══════════════════════════════════════════

export const dinaSessions = pgTable("dina_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => dinaTenants.id, { onDelete: "cascade" }),
  merchantId: uuid("merchant_id").notNull().references(() => dinaMerchants.id, { onDelete: "cascade" }),
  externalTripId: uuid("external_trip_id").notNull(),
  externalOfferId: uuid("external_offer_id"),
  externalCustomerId: uuid("external_customer_id").notNull(),
  externalBranchId: uuid("external_branch_id").notNull(),
  constraintId: uuid("constraint_id").references(() => dinaConstraints.id, { onDelete: "set null" }),
  autonomyLevel: dinaAutonomyLevelEnum("autonomy_level").notNull(),
  status: dinaSessionStatusEnum("status").notNull().default("PENDING"),
  outcome: dinaSessionOutcomeEnum("outcome"),
  totalRounds: integer("total_rounds").default(0),
  openingPrice: decimal("opening_price", { precision: 10, scale: 2 }).notNull(),
  agreedPrice: decimal("agreed_price", { precision: 10, scale: 2 }),
  agreedDiscountPct: decimal("agreed_discount_pct", { precision: 5, scale: 2 }),
  triggerChecks: jsonb("trigger_checks").notNull().default({}),
  customerProfileSnapshot: jsonb("customer_profile_snapshot").notNull().default({}),
  merchantProfileSnapshot: jsonb("merchant_profile_snapshot").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
});

// ═══════════════════════════════════════════
// 6. ROUND LAYER
// ═══════════════════════════════════════════

export const dinaRounds = pgTable("dina_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => dinaSessions.id, { onDelete: "cascade" }),
  roundNumber: smallint("round_number").notNull(),
  actor: dinaRoundActorEnum("actor").notNull(),
  proposedPrice: decimal("proposed_price", { precision: 10, scale: 2 }).notNull(),
  proposedDiscountPct: decimal("proposed_discount_pct", { precision: 5, scale: 2 }).notNull(),
  status: dinaRoundStatusEnum("status").notNull(),
  rejectionReason: text("rejection_reason"),
  isWithinConstraint: boolean("is_within_constraint").notNull(),
  dinaDecisionFactors: jsonb("dina_decision_factors"),
  responseTimeSeconds: integer("response_time_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

// ═══════════════════════════════════════════
// 7. HUMAN-IN-THE-LOOP
// ═══════════════════════════════════════════

export const dinaHitlRequests = pgTable("dina_hitl_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => dinaSessions.id, { onDelete: "cascade" }),
  roundId: uuid("round_id").notNull().references(() => dinaRounds.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  proposedAction: text("proposed_action").notNull(),
  status: dinaHitlStatusEnum("status").notNull().default("PENDING"),
  merchantResponse: text("merchant_response"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════
// 8. BARCODE LAYER
// ═══════════════════════════════════════════

export const dinaBarcodes = pgTable("dina_barcodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().unique().references(() => dinaSessions.id, { onDelete: "cascade" }),
  externalOfferId: uuid("external_offer_id").notNull(),
  barcodeValue: varchar("barcode_value", { length: 100 }).notNull().unique(),
  qrData: text("qr_data").notNull(),
  originalBranchId: uuid("original_branch_id").notNull(),
  currentBranchId: uuid("current_branch_id").notNull(),
  agreedPrice: decimal("agreed_price", { precision: 10, scale: 2 }).notNull(),
  commissionPct: decimal("commission_pct", { precision: 5, scale: 2 }).notNull(),
  status: dinaBarcodeStatusEnum("status").notNull().default("ACTIVE"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dinaBarcodeTransfers = pgTable("dina_barcode_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  barcodeId: uuid("barcode_id").notNull().references(() => dinaBarcodes.id, { onDelete: "cascade" }),
  fromBranchId: uuid("from_branch_id").notNull(),
  toBranchId: uuid("to_branch_id").notNull(),
  reason: text("reason").notNull(),
  customerApproved: boolean("customer_approved").notNull(),
  distancePassedKm: decimal("distance_passed_km", { precision: 8, scale: 2 }),
  transferredAt: timestamp("transferred_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════
// 9. INTELLIGENCE LAYER
// ═══════════════════════════════════════════

export const dinaLearningEvents = pgTable("dina_learning_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => dinaTenants.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => dinaSessions.id, { onDelete: "cascade" }),
  eventType: dinaLearningEventEnum("event_type").notNull(),
  winningRound: smallint("winning_round"),
  winningDiscountPct: decimal("winning_discount_pct", { precision: 5, scale: 2 }),
  context: jsonb("context").notNull().default({}),
  outcomeValue: decimal("outcome_value", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dinaCustomerProfiles = pgTable("dina_customer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => dinaTenants.id, { onDelete: "cascade" }),
  externalCustomerId: uuid("external_customer_id").notNull().unique(),
  totalSessions: integer("total_sessions").default(0),
  successfulSessions: integer("successful_sessions").default(0),
  avgWinningRound: decimal("avg_winning_round", { precision: 4, scale: 2 }),
  avgDiscountAccepted: decimal("avg_discount_accepted", { precision: 5, scale: 2 }),
  priceSensitivity: decimal("price_sensitivity", { precision: 3, scale: 2 }).default("0.50"),
  preferredCategories: jsonb("preferred_categories").default([]),
  bestContactHours: jsonb("best_contact_hours").default({}),
  lastSessionAt: timestamp("last_session_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const dinaMerchantProfiles = pgTable("dina_merchant_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull().unique().references(() => dinaMerchants.id, { onDelete: "cascade" }),
  totalSessions: integer("total_sessions").default(0),
  successfulSessions: integer("successful_sessions").default(0),
  avgRoundsToClose: decimal("avg_rounds_to_close", { precision: 4, scale: 2 }),
  avgCommissionGenerated: decimal("avg_commission_generated", { precision: 10, scale: 2 }),
  topPerformingProducts: jsonb("top_performing_products").default([]),
  constraintEfficiency: jsonb("constraint_efficiency").default({}),
  recommendedAdjustments: jsonb("recommended_adjustments").default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════
// INSERT SCHEMAS & TYPES
// ═══════════════════════════════════════════

export const insertDinaTenantSchema = createInsertSchema(dinaTenants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDinaConstraintSchema = createInsertSchema(dinaConstraints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDinaSessionSchema = createInsertSchema(dinaSessions).omit({ id: true, startedAt: true });
export const insertDinaRoundSchema = createInsertSchema(dinaRounds).omit({ id: true, createdAt: true });
export const insertDinaBarcodeSchema = createInsertSchema(dinaBarcodes).omit({ id: true, createdAt: true });
export const insertDinaMerchantSchema = createInsertSchema(dinaMerchants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDinaTripInterestSchema = createInsertSchema(dinaTripInterests).omit({ id: true, createdAt: true });

export type DinaTenant = typeof dinaTenants.$inferSelect;
export type DinaMerchantDina = typeof dinaMerchants.$inferSelect;
export type DinaConstraint = typeof dinaConstraints.$inferSelect;
export type DinaConstraintProduct = typeof dinaConstraintProducts.$inferSelect;
export type DinaSession = typeof dinaSessions.$inferSelect;
export type DinaRound = typeof dinaRounds.$inferSelect;
export type DinaBarcodeRecord = typeof dinaBarcodes.$inferSelect;
export type DinaCustomerProfile = typeof dinaCustomerProfiles.$inferSelect;
export type DinaMerchantProfile = typeof dinaMerchantProfiles.$inferSelect;
export type DinaTripInterest = typeof dinaTripInterests.$inferSelect;
export type DinaHitlRequest = typeof dinaHitlRequests.$inferSelect;
