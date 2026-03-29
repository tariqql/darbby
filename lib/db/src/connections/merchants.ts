import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildDbUrl } from "./dbUrl";
import { merchants } from "../schema/merchants";
import { merchantBranches } from "../schema/merchantBranches";
import { products } from "../schema/products";
import { productCategories } from "../schema/productCategories";
import { subscriptions } from "../schema/subscriptions";
import { autoNegotiatorSettings, autoNegotiatorProducts } from "../schema/autoNegotiator";

const { Pool } = pg;

export const merchantsPool = new Pool({ connectionString: buildDbUrl("darbby_merchants") });
export const merchantsDb = drizzle(merchantsPool, {
  schema: { merchants, merchantBranches, products, productCategories, subscriptions, autoNegotiatorSettings, autoNegotiatorProducts },
});

export type MerchantsDb = typeof merchantsDb;
