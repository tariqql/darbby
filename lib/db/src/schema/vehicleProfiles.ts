import {
  pgTable,
  uuid,
  varchar,
  boolean,
  decimal,
  timestamp,
  smallint,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const fuelTypeEnum = pgEnum("fuel_type", [
  "PETROL_91",
  "PETROL_95",
  "DIESEL",
  "ELECTRIC",
  "HYBRID",
]);

export const vehicleProfiles = pgTable("vehicle_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nickname: varchar("nickname", { length: 100 }).notNull(),
  vehicleType: varchar("vehicle_type", { length: 50 }).notNull(),
  make: varchar("make", { length: 80 }).notNull(),
  model: varchar("model", { length: 80 }).notNull(),
  year: smallint("year").notNull(),
  color: varchar("color", { length: 50 }),
  fuelType: fuelTypeEnum("fuel_type").notNull(),
  plateNo: varchar("plate_no", { length: 20 }).unique(),
  tankCapacityLiters: decimal("tank_capacity_liters", { precision: 5, scale: 1 }),
  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertVehicleProfileSchema = createInsertSchema(vehicleProfiles).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type VehicleProfile = typeof vehicleProfiles.$inferSelect;
export type InsertVehicleProfile = z.infer<typeof insertVehicleProfileSchema>;
