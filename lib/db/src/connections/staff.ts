import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildDbUrl } from "./dbUrl";
import { staffUsers, auditLog } from "../schema/staff";

const { Pool } = pg;

export const staffPool = new Pool({ connectionString: buildDbUrl("darbby_staff") });
export const staffDb = drizzle(staffPool, {
  schema: { staffUsers, auditLog },
});

export type StaffDb = typeof staffDb;
