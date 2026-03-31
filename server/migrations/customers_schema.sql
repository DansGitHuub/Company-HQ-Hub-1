-- ============================================================
-- Migration: Customers Schema
-- Tables: customers, customer_phones, customer_emails,
--         customer_contacts, properties
-- Triggers: updated_at for customers and properties
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ------------------------------------------------------------
-- 1. updated_at trigger function
--    Creates or replaces — will not affect existing triggers
--    on other tables.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 2. customers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT        NOT NULL,
  last_name       TEXT        NOT NULL,
  company_name    TEXT,
  billing_address TEXT,
  billing_city    TEXT,
  billing_state   TEXT,
  billing_zip     TEXT,
  source          TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 3. customer_phones
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_phones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  phone_type  TEXT,
  is_primary  BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. customer_emails
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_emails (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  email_type  TEXT,
  is_primary  BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 5. customer_contacts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_contacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  first_name  TEXT        NOT NULL,
  last_name   TEXT,
  role        TEXT,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 6. properties
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address       TEXT        NOT NULL,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  property_type TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS properties_updated_at ON properties;
CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
