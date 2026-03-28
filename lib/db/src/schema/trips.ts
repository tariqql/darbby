import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { vehicleProfiles } from "./vehicleProfiles";

export const tripStatusEnum = pgEnum("trip_status", [
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const tripPurposeEnum = pgEnum("trip_purpose", [
  "WORK",
  "TOURISM",
  "UMRAH",
  "FAMILY_VISIT",
  "MEDICAL",
  "EDUCATION",
  "OTHER",
]);

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleProfileId: uuid("vehicle_profile_id").references(() => vehicleProfiles.id, { onDelete: "set null" }),
  title: varchar("title", { length: 100 }),
  tripPurpose: tripPurposeEnum("trip_purpose").notNull().default("OTHER"),
  originName: varchar("origin_name", { length: 200 }).notNull(),
  destinationName: varchar("destination_name", { length: 200 }).notNull(),
  routePolyline: text("route_polyline"),
  departureTime: timestamp("departure_time", { withTimezone: true }).notNull(),
  arrivalTime: timestamp("arrival_time", { withTimezone: true }),
  status: tripStatusEnum("status").default("ACTIVE"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  userId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  originLat: z.number(),
  originLng: z.number(),
  destLat: z.number(),
  destLng: z.number(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
