-- Zimplexline Database Schema
-- PostgreSQL 15

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'agent', 'subagent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE commission_type AS ENUM (
    'own_deposit', 'own_withdrawal',
    'direct_agent_deposit', 'direct_agent_withdrawal',
    'deep_team_deposit', 'deep_team_withdrawal',
    'agent_locked', 'promo_referral'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           VARCHAR NOT NULL,
  email               VARCHAR UNIQUE,
  date_of_birth       DATE NOT NULL,
  password_hash       VARCHAR NOT NULL,
  role                user_role NOT NULL,
  parent_id           UUID REFERENCES users(id),
  id_photo_url        VARCHAR,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_by         UUID REFERENCES users(id),
  network_name        VARCHAR,
  reject_reason       VARCHAR,
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);

-- Table: transactions
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  type             transaction_type NOT NULL,
  amount           DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by      UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_recorded_by ON transactions(recorded_by);

-- Table: commissions
CREATE TABLE IF NOT EXISTS commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id),
  beneficiary_id  UUID NOT NULL REFERENCES users(id),
  source_user_id  UUID NOT NULL REFERENCES users(id),
  percentage      DECIMAL(5,4) NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  commission_type commission_type NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_beneficiary_id ON commissions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_commissions_source_user_id ON commissions(source_user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_transaction_id ON commissions(transaction_id);

-- Table: monthly_agent_unlock
CREATE TABLE IF NOT EXISTS monthly_agent_unlock (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           UUID NOT NULL REFERENCES users(id),
  year               INT NOT NULL,
  month              INT NOT NULL,
  total_own_deposits DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_unlocked        BOOLEAN NOT NULL DEFAULT false,
  unlocked_at        TIMESTAMPTZ,
  UNIQUE(agent_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_agent_unlock_agent_year_month
  ON monthly_agent_unlock(agent_id, year, month);

-- Table: monthly_deposit_totals
CREATE TABLE IF NOT EXISTS monthly_deposit_totals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id),
  agent_id       UUID NOT NULL REFERENCES users(id),
  year           INT NOT NULL,
  month          INT NOT NULL,
  total_deposits DECIMAL(15,2) NOT NULL DEFAULT 0,
  rate_upgraded  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, agent_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_deposit_totals_user_agent_year_month
  ON monthly_deposit_totals(user_id, agent_id, year, month);

-- Table: commission_rates
CREATE TABLE IF NOT EXISTS commission_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key    VARCHAR UNIQUE NOT NULL,
  rate_value  DECIMAL(15,4) NOT NULL,
  description VARCHAR,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID NOT NULL REFERENCES users(id),
  action     VARCHAR NOT NULL,
  target_id  UUID,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Table: invite_links
CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  intended_role VARCHAR(20) NOT NULL,
  used_by UUID REFERENCES users(id),
  is_used BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_links_token ON invite_links(token);
CREATE INDEX IF NOT EXISTS idx_invite_links_created_by ON invite_links(created_by);
CREATE INDEX IF NOT EXISTS idx_invite_links_used_by ON invite_links(used_by);

-- Seed: default commission rates
INSERT INTO commission_rates (rate_key, rate_value, description) VALUES
  ('manager_own_deposit',                  0.0300, 'Manager earns 3% on own deposit'),
  ('manager_own_withdrawal',               0.0100, 'Manager earns 1% on own withdrawal'),
  ('manager_direct_agent_deposit',         0.0100, 'Manager earns 1% on direct agent deposit'),
  ('manager_direct_agent_withdrawal',      0.0040, 'Manager earns 0.4% on direct agent withdrawal'),
  ('manager_deep_team_deposit',            0.0030, 'Manager earns 0.3% on deep team deposit'),
  ('manager_deep_team_withdrawal',         0.0010, 'Manager earns 0.1% on deep team withdrawal'),
  ('agent_direct_subagent_deposit_low',    0.0250, 'Agent earns 2.5% when subagent monthly < 20000'),
  ('agent_direct_subagent_deposit_high',   0.0300, 'Agent earns 3% when subagent monthly >= 20000'),
  ('agent_direct_subagent_withdrawal',     0.0100, 'Agent earns 1% on direct subagent withdrawal'),
  ('agent_deep_team_deposit',              0.0030, 'Agent earns 0.3% on deep team deposit'),
  ('agent_deep_team_withdrawal',           0.0010, 'Agent earns 0.1% on deep team withdrawal'),
  ('agent_unlock_threshold',             100.0000, 'Agent own monthly deposit threshold (10000 LKR, stored as rate_value * 100)'),
  ('subagent_monthly_threshold',         200.0000, 'Subagent monthly deposit threshold (20000 LKR, stored as rate_value * 100)'),
  ('promo_referral',                       0.1000, 'Promo referral rate 10% (Phase 2)')
ON CONFLICT (rate_key) DO NOTHING;

-- Fix: agent_unlock_threshold and subagent_monthly_threshold are actual LKR amounts
-- Re-insert correct values using a separate approach
DELETE FROM commission_rates WHERE rate_key IN ('agent_unlock_threshold', 'subagent_monthly_threshold');
INSERT INTO commission_rates (rate_key, rate_value, description) VALUES
  ('agent_unlock_threshold',   10000.00, 'Agent own monthly deposit threshold in LKR'),
  ('subagent_monthly_threshold', 20000.00, 'Subagent monthly deposit threshold in LKR');
