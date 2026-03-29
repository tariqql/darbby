import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { notifications } from "../schema/notifications";

const { Pool } = pg;

const url = process.env.DATABASE_NOTIFICATIONS_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_NOTIFICATIONS_URL is not set");

export const notificationsPool = new Pool({ connectionString: url });
export const notificationsDb = drizzle(notificationsPool, {
  schema: { notifications },
});

export type NotificationsDb = typeof notificationsDb;
