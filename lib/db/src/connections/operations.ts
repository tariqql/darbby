import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { systemOperationsLog } from "../schema/operationsLog";

const { Pool } = pg;

const url = process.env.DATABASE_OPERATIONS_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_OPERATIONS_URL is not set");

export const operationsPool = new Pool({ connectionString: url });
export const operationsDb = drizzle(operationsPool, {
  schema: { systemOperationsLog },
});

export type OperationsDb = typeof operationsDb;
