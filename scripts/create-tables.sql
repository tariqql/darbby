-- Darbby Database Schema — 7 Independent Databases
-- Step 1: Create databases → sudo -u postgres psql < ~/darbby/scripts/create-databases.sql
-- Step 2: Create tables  → sudo -u postgres bash ~/darbby/scripts/run-all-tables.sh

-- ═══════════════════════════════════════════════════════
-- 1. darbby_customers — قاعدة العملاء
--    Tables: users · vehicle_profiles
-- ═══════════════════════════════════════════════════════
\connect darbby_customers

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE fuel_type AS ENUM ('PETROL_91','PETROL_95','DIESEL','ELECTRIC','HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  profile_image TEXT,
  fcm_token TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  price_sensitivity DECIMAL(3,2) DEFAULT 0.50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  make VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  year SMALLINT NOT NULL,
  color VARCHAR(50),
  fuel_type fuel_type NOT NULL,
  plate_no VARCHAR(20) UNIQUE,
  tank_capacity_liters DECIMAL(5,1),
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_profiles_user_id ON vehicle_profiles(user_id);

\echo '✓ darbby_customers tables created'


-- ═══════════════════════════════════════════════════════
-- 2. darbby_merchants — قاعدة المنشآت التجارية
--    Tables: merchants · merchant_branches · products · subscriptions
-- ═══════════════════════════════════════════════════════
\connect darbby_merchants

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

DO $$ BEGIN
  CREATE TYPE merchant_status AS ENUM ('PENDING','DOCUMENTS_UPLOADED','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('FREE','PREMIUM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('ACTIVE','EXPIRED','CANCELLED','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE branch_status AS ENUM ('ACTIVE','INACTIVE','TEMPORARILY_CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fuel_type AS ENUM ('PETROL_91','PETROL_95','DIESEL','ELECTRIC','HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(150) NOT NULL,
  owner_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  fcm_token TEXT,
  commercial_reg_no VARCHAR(50) NOT NULL UNIQUE,
  commercial_reg_doc_url TEXT NOT NULL,
  commercial_reg_expiry DATE NOT NULL,
  status merchant_status DEFAULT 'PENDING',
  rejection_reason TEXT,
  reviewed_by_admin_id UUID,
  reviewed_at TIMESTAMPTZ,
  national_address TEXT,
  nafath_verified BOOLEAN DEFAULT false,
  subscription_plan subscription_plan DEFAULT 'FREE',
  subscription_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  branch_name VARCHAR(150) NOT NULL,
  branch_code VARCHAR(20),
  address_text TEXT,
  location GEOGRAPHY(POINT, 4326),
  service_radius_km DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  status branch_status NOT NULL DEFAULT 'ACTIVE',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  working_hours JSONB,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  target_fuel_type fuel_type,
  images TEXT[],
  stock_qty INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'FREE',
  status subscription_status NOT NULL DEFAULT 'ACTIVE',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  payment_ref VARCHAR(150),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_branches_merchant_id ON merchant_branches(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_merchant_id ON subscriptions(merchant_id);

\echo '✓ darbby_merchants tables created'


-- ═══════════════════════════════════════════════════════
-- 3. darbby_dina — قاعدة المفاوض الآلي DINA
--    Tables: auto_negotiator_settings · auto_negotiator_products
-- ═══════════════════════════════════════════════════════
\connect darbby_dina

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS auto_negotiator_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT false,
  response_delay_min INTEGER DEFAULT 5,
  purpose_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_negotiator_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiator_id UUID NOT NULL REFERENCES auto_negotiator_settings(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  min_discount_pct DECIMAL(5,2) NOT NULL,
  max_discount_pct DECIMAL(5,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_neg_products_negotiator ON auto_negotiator_products(negotiator_id);

\echo '✓ darbby_dina tables created'


-- ═══════════════════════════════════════════════════════
-- 4. darbby_trips — قاعدة الرحلات
--    Tables: trips
-- ═══════════════════════════════════════════════════════
\connect darbby_trips

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('ACTIVE','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trip_purpose AS ENUM ('WORK','TOURISM','UMRAH','FAMILY_VISIT','MEDICAL','EDUCATION','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  vehicle_profile_id UUID,
  title VARCHAR(100),
  trip_purpose trip_purpose NOT NULL DEFAULT 'OTHER',
  origin_name VARCHAR(200) NOT NULL,
  origin_location GEOGRAPHY(POINT, 4326),
  destination_name VARCHAR(200) NOT NULL,
  destination_location GEOGRAPHY(POINT, 4326),
  route_polyline TEXT,
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ,
  status trip_status DEFAULT 'ACTIVE',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

\echo '✓ darbby_trips tables created'


-- ═══════════════════════════════════════════════════════
-- 5. darbby_orders — قاعدة الطلبات
--    Tables: offers · offer_items · negotiations · transactions · commission_ledger
-- ═══════════════════════════════════════════════════════
\connect darbby_orders

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE offer_status AS ENUM ('SENT','VIEWED','NEGOTIATING','ACCEPTED','REJECTED','CANCELLED','EXPIRED','FINALIZED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sender_type AS ENUM ('USER','MERCHANT','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE txn_status AS ENUM ('PENDING','COMPLETED','REFUNDED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ledger_status AS ENUM ('PENDING','INVOICED','COLLECTED','DISPUTED','WAIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL,
  merchant_id UUID NOT NULL,
  branch_id UUID,
  message TEXT,
  total_price DECIMAL(10,2) NOT NULL,
  final_price DECIMAL(10,2),
  status offer_status DEFAULT 'SENT',
  is_auto_offer BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity DECIMAL(10,0) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  negotiated_price DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  sender_type sender_type NOT NULL,
  proposed_price DECIMAL(10,2) NOT NULL,
  message TEXT,
  is_auto BOOLEAN DEFAULT false,
  price_sensitivity_snapshot DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL UNIQUE REFERENCES offers(id),
  merchant_id UUID NOT NULL,
  gross_amount DECIMAL(10,2) NOT NULL,
  commission_pct DECIMAL(5,2) NOT NULL,
  commission_amt DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  status txn_status DEFAULT 'PENDING',
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL UNIQUE REFERENCES offers(id),
  transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id),
  merchant_id UUID NOT NULL,
  branch_id UUID,
  gross_amount DECIMAL(10,2) NOT NULL,
  commission_rate_pct DECIMAL(5,2) NOT NULL,
  ledger_status ledger_status NOT NULL DEFAULT 'PENDING',
  invoice_no VARCHAR(50) UNIQUE,
  invoiced_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  collection_method VARCHAR(50),
  collection_ref VARCHAR(150),
  dispute_reason VARCHAR(500),
  rate_set_by UUID,
  rate_set_at TIMESTAMPTZ DEFAULT NOW(),
  notes VARCHAR(1000),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_trip_id ON offers(trip_id);
CREATE INDEX IF NOT EXISTS idx_offers_merchant_id ON offers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offer_items_offer_id ON offer_items(offer_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_offer_id ON negotiations(offer_id);

\echo '✓ darbby_orders tables created'


-- ═══════════════════════════════════════════════════════
-- 6. darbby_notifications — قاعدة الإشعارات
--    Tables: notifications (Polymorphic — no FK)
-- ═══════════════════════════════════════════════════════
\connect darbby_notifications

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE notification_recip AS ENUM ('USER','MERCHANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type notification_recip NOT NULL,
  recipient_id UUID NOT NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(recipient_id, is_read);

\echo '✓ darbby_notifications tables created'


-- ═══════════════════════════════════════════════════════
-- 7. darbby_operations — قاعدة العمليات (Append-Only Audit Log)
--    Tables: system_operations_log
-- ═══════════════════════════════════════════════════════
\connect darbby_operations

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE actor_type AS ENUM ('USER','MERCHANT','SYSTEM','ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS system_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type actor_type NOT NULL,
  actor_id UUID,
  operation_type VARCHAR(100) NOT NULL,
  target_entity VARCHAR(100),
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_log_actor ON system_operations_log(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_ops_log_operation ON system_operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_ops_log_target ON system_operations_log(target_entity, target_id);
CREATE INDEX IF NOT EXISTS idx_ops_log_created ON system_operations_log(created_at DESC);

\echo '✓ darbby_operations tables created'

\echo ''
\echo '════════════════════════════════════════'
\echo '✅ All 7 databases and 17 tables ready!'
\echo '════════════════════════════════════════'
