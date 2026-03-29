import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const actorTypeEnum = pgEnum("actor_type", [
  "USER",
  "MERCHANT",
  "SYSTEM",
  "ADMIN",
]);

export const systemOperationsLog = pgTable("system_operations_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: actorTypeEnum("actor_type").notNull(),
  actorId: uuid("actor_id"),
  operationType: varchar("operation_type", { length: 100 }).notNull(),
  targetEntity: varchar("target_entity", { length: 100 }),
  targetId: uuid("target_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertOperationLogSchema = createInsertSchema(systemOperationsLog).omit({
  id: true,
  createdAt: true,
});

export type SystemOperationLog = typeof systemOperationsLog.$inferSelect;
export type InsertOperationLog = z.infer<typeof insertOperationLogSchema>;
