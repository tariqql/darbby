import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { offers, offerItems } from "../schema/offers";
import { negotiations } from "../schema/negotiations";
import { transactions, commissionLedger } from "../schema/transactions";

const { Pool } = pg;

const url = process.env.DATABASE_ORDERS_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_ORDERS_URL is not set");

export const ordersPool = new Pool({ connectionString: url });
export const ordersDb = drizzle(ordersPool, {
  schema: { offers, offerItems, negotiations, transactions, commissionLedger },
});

export type OrdersDb = typeof ordersDb;
