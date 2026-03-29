import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { autoNegotiatorSettings, autoNegotiatorProducts } from "../schema/autoNegotiator";

const { Pool } = pg;

const url = process.env.DATABASE_DINA_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_DINA_URL is not set");

export const dinaPool = new Pool({ connectionString: url });
export const dinaDb = drizzle(dinaPool, {
  schema: { autoNegotiatorSettings, autoNegotiatorProducts },
});

export type DinaDb = typeof dinaDb;
