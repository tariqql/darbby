import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildDbUrl } from "./dbUrl";
import {
  dinaTenants,
  dinaTenantSubscriptions,
  dinaMerchants,
  dinaConstraints,
  dinaConstraintProducts,
  dinaTripInterests,
  dinaSessions,
  dinaRounds,
  dinaHitlRequests,
  dinaBarcodes,
  dinaBarcodeTransfers,
  dinaLearningEvents,
  dinaCustomerProfiles,
  dinaMerchantProfiles,
} from "../schema/dina";

const { Pool } = pg;

export const dinaPool = new Pool({ connectionString: buildDbUrl("darbby_dina") });
export const dinaDb = drizzle(dinaPool, {
  schema: {
    dinaTenants,
    dinaTenantSubscriptions,
    dinaMerchants,
    dinaConstraints,
    dinaConstraintProducts,
    dinaTripInterests,
    dinaSessions,
    dinaRounds,
    dinaHitlRequests,
    dinaBarcodes,
    dinaBarcodeTransfers,
    dinaLearningEvents,
    dinaCustomerProfiles,
    dinaMerchantProfiles,
  },
});

export type DinaDb = typeof dinaDb;
