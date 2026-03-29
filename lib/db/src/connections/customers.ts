import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildDbUrl } from "./dbUrl";
import { users } from "../schema/users";
import { vehicleProfiles } from "../schema/vehicleProfiles";

const { Pool } = pg;

export const customersPool = new Pool({ connectionString: buildDbUrl("darbby_customers") });
export const customersDb = drizzle(customersPool, {
  schema: { users, vehicleProfiles },
});

export type CustomersDb = typeof customersDb;
