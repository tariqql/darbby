import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { merchants } from "../schema/merchants";
import { merchantBranches } from "../schema/merchantBranches";
import { products } from "../schema/products";
import { subscriptions } from "../schema/subscriptions";

const { Pool } = pg;

const url = process.env.DATABASE_MERCHANTS_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_MERCHANTS_URL is not set");

export const merchantsPool = new Pool({ connectionString: url });
export const merchantsDb = drizzle(merchantsPool, {
  schema: { merchants, merchantBranches, products, subscriptions },
});

export type MerchantsDb = typeof merchantsDb;
