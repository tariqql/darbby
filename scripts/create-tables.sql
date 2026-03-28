-- Darbby Database Schema
-- Run with: psql darbby < ~/darbby/scripts/create-tables.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enums
DO $$ BEGIN
  CREATE TYPE merchant_status AS ENUM ('PENDING','DOCUMENTS_UPLOADED','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('FREE','PREMIUM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE branch_status AS ENUM ('ACTIVE','INACTIVE','TEMPORARILY_CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fuel_type AS ENUM ('PETROL_91','PETROL_95','DIESEL','ELECTRIC','HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('ACTIVE','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trip_purpose AS ENUM ('WORK','TOURISM','UMRAH','FAMILY_VISIT','MEDICAL','EDUCATION','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('OFFER_RECEIVED','OFFER_ACCEPTED','OFFER_REJECTED','NEGOTIATION_UPDATE','TRIP_UPDATE','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users
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

-- Merchants
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

-- Merchant Branches
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

-- Vehicle Profiles
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

-- Products
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

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_profile_id UUID REFERENCES vehicle_profiles(id) ON DELETE SET NULL,
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

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  branch_id UUID REFERENCES merchant_branches(id) ON DELETE SET NULL,
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

-- Offer Items
CREATE TABLE IF NOT EXISTS offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(10,0) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  negotiated_price DECIMAL(10,2)
);

-- Negotiations
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

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL UNIQUE REFERENCES offers(id),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  gross_amount DECIMAL(10,2) NOT NULL,
  commission_pct DECIMAL(5,2) NOT NULL,
  commission_amt DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  status txn_status DEFAULT 'PENDING',
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commission Ledger
CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL UNIQUE REFERENCES offers(id),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  branch_id UUID REFERENCES merchant_branches(id),
  gross_amount DECIMAL(10,2) NOT NULL,
  commission_pct DECIMAL(5,2) NOT NULL,
  commission_amt DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  status ledger_status DEFAULT 'PENDING',
  invoice_no VARCHAR(50),
  period_start DATE,
  period_end DATE,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'SYSTEM',
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto Negotiator Settings
CREATE TABLE IF NOT EXISTS auto_negotiator_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  response_delay_min INTEGER DEFAULT 5,
  purpose_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto Negotiator Products
CREATE TABLE IF NOT EXISTS auto_negotiator_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiator_id UUID NOT NULL REFERENCES auto_negotiator_settings(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  min_discount_pct DECIMAL(5,2) NOT NULL,
  max_discount_pct DECIMAL(5,2) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_offers_trip_id ON offers(trip_id);
CREATE INDEX IF NOT EXISTS idx_offers_merchant_id ON offers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_negotiations_offer_id ON negotiations(offer_id);
CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_merchant_id ON notifications(merchant_id);

\echo 'All tables created successfully!'
