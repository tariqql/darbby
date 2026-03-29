import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffRoleEnum = pgEnum("staff_role", [
  "SUPER_ADMIN",
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "MODERATOR",
]);

export const staffStatusEnum = pgEnum("staff_status", [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

export const staffUsers = pgTable("staff_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: staffRoleEnum("role").notNull().default("SUPPORT"),
  status: staffStatusEnum("status").notNull().default("ACTIVE"),
  permissions: jsonb("permissions").default({}),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertStaffUserSchema = createInsertSchema(staffUsers).omit({ id: true, createdAt: true, updatedAt: true });
export type StaffUser = typeof staffUsers.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertStaffUser = z.infer<typeof insertStaffUserSchema>;
