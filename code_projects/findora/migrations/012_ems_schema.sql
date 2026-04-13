-- EMS (Enterprise Management System) Schema Migration
-- Migration: 012_ems_schema.sql
-- Description: Create EMS tables for enterprise management
-- Created: 2026-04-13

-- Enterprise - Organization/Company entity
CREATE TABLE IF NOT EXISTS enterprises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  industry TEXT,
  size TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  verified_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Enterprise Member - User membership in an enterprise
CREATE TABLE IF NOT EXISTS enterprise_members (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending', 'removed')),
  joined_at TEXT NOT NULL,
  invited_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES ems_users(id) ON DELETE CASCADE
);

-- Record - Business record/document entity
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  record_type TEXT NOT NULL CHECK(record_type IN ('document', 'certificate', 'license', 'contract', 'report', 'other')),
  record_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  file_url TEXT,
  file_hash TEXT,
  metadata TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'expired', 'revoked', 'archived')),
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
);

-- Audit Log - Tracks all actions for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'login', 'logout', 'access', 'export', 'approve', 'reject')),
  resource_type TEXT NOT NULL CHECK(resource_type IN ('enterprise', 'member', 'record', 'user', 'auth', 'product', 'list', 'content')),
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  changes TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

-- EMS User - Enterprise system user
CREATE TABLE IF NOT EXISTS ems_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT,
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  email_verified_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- User Session - Active session tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES ems_users(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_enterprise_members_enterprise ON enterprise_members(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_user ON enterprise_members(user_id);
CREATE INDEX IF NOT EXISTS idx_records_enterprise ON records(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
CREATE INDEX IF NOT EXISTS idx_records_expiry ON records(expiry_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_enterprise ON audit_logs(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
