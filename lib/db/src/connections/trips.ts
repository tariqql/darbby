import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { trips } from "../schema/trips";

const { Pool } = pg;

const url = process.env.DATABASE_TRIPS_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_TRIPS_URL is not set");

export const tripsPool = new Pool({ connectionString: url });
export const tripsDb = drizzle(tripsPool, {
  schema: { trips },
});

export type TripsDb = typeof tripsDb;
