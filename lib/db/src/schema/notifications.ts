import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationRecipEnum = pgEnum("notification_recip", [
  "USER",
  "MERCHANT",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientType: notificationRecipEnum("recipient_type").notNull(),
  recipientId: uuid("recipient_id").notNull(),
  type: varchar("type", { length: 60 }).notNull(),
  title: varchar("title", { length: 150 }).notNull(),
  body: text("body").notNull(),
  data: jsonb("data"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
