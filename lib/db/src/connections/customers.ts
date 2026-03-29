import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users } from "../schema/users";
import { vehicleProfiles } from "../schema/vehicleProfiles";

const { Pool } = pg;

const url = process.env.DATABASE_CUSTOMERS_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_CUSTOMERS_URL is not set");

export const customersPool = new Pool({ connectionString: url });
export const customersDb = drizzle(customersPool, {
  schema: { users, vehicleProfiles },
});

export type CustomersDb = typeof customersDb;
