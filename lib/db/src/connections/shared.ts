import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildDbUrl } from "./dbUrl";
import { trips } from "../schema/trips";
import { offers, offerItems } from "../schema/offers";
import { negotiations } from "../schema/negotiations";
import { transactions, commissionLedger } from "../schema/transactions";
import { notifications } from "../schema/notifications";
import { systemOperationsLog } from "../schema/operationsLog";
import { orders, receipts } from "../schema/orders";
import { merchantApiKeys, webhookRegistrations, webhookDeliveries } from "../schema/integrations";

const { Pool } = pg;

export const sharedPool = new Pool({ connectionString: buildDbUrl("darbby_shared") });
export const sharedDb = drizzle(sharedPool, {
  schema: {
    trips, offers, offerItems, negotiations, transactions, commissionLedger,
    notifications, systemOperationsLog, orders, receipts,
    merchantApiKeys, webhookRegistrations, webhookDeliveries,
  },
});

export type SharedDb = typeof sharedDb;
