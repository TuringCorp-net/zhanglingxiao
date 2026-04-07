-- Findora D1 Schema Migration 007: F-023 Membership System
-- Based on SRS Section 5.8

-- Membership tiers definition
CREATE TABLE IF NOT EXISTS membership_tiers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly REAL DEFAULT 0,
  price_yearly REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  features TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- User memberships (subscription records)
CREATE TABLE IF NOT EXISTS user_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  started_at TEXT NOT NULL,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancelled_at TEXT,
  plan_interval TEXT DEFAULT 'monthly',
  external_subscription_id TEXT,
  payment_method TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tier_id) REFERENCES membership_tiers(id)
);

-- Subscription events (audit log for subscription changes)
CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,
  user_membership_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  old_tier_id TEXT,
  new_tier_id TEXT,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  amount_charged REAL,
  currency TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_membership_id) REFERENCES user_memberships(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Membership entitlements (defines what each tier can access)
CREATE TABLE IF NOT EXISTS membership_entitlements (
  id TEXT PRIMARY KEY,
  tier_id TEXT NOT NULL,
  feature_code TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  value TEXT,
  is_allowed INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tier_id) REFERENCES membership_tiers(id)
);

-- Exclusive content access (marks content as tier-restricted)
CREATE TABLE IF NOT EXISTS exclusive_content (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  required_tier_id TEXT NOT NULL,
  access_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (required_tier_id) REFERENCES membership_tiers(id)
);

-- Payment records (for tracking subscription payments)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_membership_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  external_payment_id TEXT,
  receipt_url TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_membership_id) REFERENCES user_memberships(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for membership tables
CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON user_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_status ON user_memberships(status);
CREATE INDEX IF NOT EXISTS idx_user_memberships_period ON user_memberships(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_membership ON subscription_events(user_membership_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_membership_entitlements_tier ON membership_entitlements(tier_id);
CREATE INDEX IF NOT EXISTS idx_exclusive_content_lookup ON exclusive_content(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_membership ON payments(user_membership_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Seed membership tiers (Free, Basic, Pro)
INSERT OR REPLACE INTO membership_tiers (id, code, name, display_name, description, price_monthly, price_yearly, features, is_active, sort_order, created_at, updated_at) VALUES
  ('tier_free', 'free', 'Free', 'Free Member', 'Basic access with limited features', 0, 0,
   '["basic_recommendations", "email_notifications", "wishlist"]',
   1, 1, datetime('now'), datetime('now')),
  ('tier_basic', 'basic', 'Basic', 'Basic Member', 'Enhanced recommendations and early access', 4.99, 49.99,
   '["enhanced_recommendations", "early_access", "priority_support", "ad_free", "wishlist"]',
   1, 2, datetime('now'), datetime('now')),
  ('tier_pro', 'pro', 'Pro', 'Pro Member', 'Full access with exclusive content and features', 9.99, 99.99,
   '["enhanced_recommendations", "early_access", "priority_support", "ad_free", "wishlist", "exclusive_content", "advanced_analytics", "api_access", "bulk_export"]',
   1, 3, datetime('now'), datetime('now'));

-- Seed entitlements
INSERT OR REPLACE INTO membership_entitlements (id, tier_id, feature_code, feature_name, value, is_allowed, created_at) VALUES
  -- Free tier
  ('ent_free_1', 'tier_free', 'basic_recommendations', 'Basic Recommendations', '50', 1, datetime('now')),
  ('ent_free_2', 'tier_free', 'email_notifications', 'Email Notifications', '10', 1, datetime('now')),
  ('ent_free_3', 'tier_free', 'wishlist', 'Wishlist', '20', 1, datetime('now')),
  ('ent_free_4', 'tier_free', 'exclusive_content', 'Exclusive Content', null, 0, datetime('now')),
  ('ent_free_5', 'tier_free', 'advanced_analytics', 'Advanced Analytics', null, 0, datetime('now')),
  ('ent_free_6', 'tier_free', 'api_access', 'API Access', null, 0, datetime('now')),
  ('ent_free_7', 'tier_free', 'bulk_export', 'Bulk Export', null, 0, datetime('now')),
  -- Basic tier
  ('ent_basic_1', 'tier_basic', 'enhanced_recommendations', 'Enhanced Recommendations', '200', 1, datetime('now')),
  ('ent_basic_2', 'tier_basic', 'early_access', 'Early Access', '7', 1, datetime('now')),
  ('ent_basic_3', 'tier_basic', 'priority_support', 'Priority Support', null, 1, datetime('now')),
  ('ent_basic_4', 'tier_basic', 'ad_free', 'Ad Free Experience', null, 1, datetime('now')),
  ('ent_basic_5', 'tier_basic', 'wishlist', 'Wishlist', '100', 1, datetime('now')),
  ('ent_basic_6', 'tier_basic', 'exclusive_content', 'Exclusive Content', null, 0, datetime('now')),
  ('ent_basic_7', 'tier_basic', 'advanced_analytics', 'Advanced Analytics', null, 0, datetime('now')),
  ('ent_basic_8', 'tier_basic', 'api_access', 'API Access', null, 0, datetime('now')),
  ('ent_basic_9', 'tier_basic', 'bulk_export', 'Bulk Export', null, 0, datetime('now')),
  -- Pro tier
  ('ent_pro_1', 'tier_pro', 'enhanced_recommendations', 'Enhanced Recommendations', 'unlimited', 1, datetime('now')),
  ('ent_pro_2', 'tier_pro', 'early_access', 'Early Access', '30', 1, datetime('now')),
  ('ent_pro_3', 'tier_pro', 'priority_support', 'Priority Support', null, 1, datetime('now')),
  ('ent_pro_4', 'tier_pro', 'ad_free', 'Ad Free Experience', null, 1, datetime('now')),
  ('ent_pro_5', 'tier_pro', 'wishlist', 'Wishlist', 'unlimited', 1, datetime('now')),
  ('ent_pro_6', 'tier_pro', 'exclusive_content', 'Exclusive Content', 'full', 1, datetime('now')),
  ('ent_pro_7', 'tier_pro', 'advanced_analytics', 'Advanced Analytics', 'full', 1, datetime('now')),
  ('ent_pro_8', 'tier_pro', 'api_access', 'API Access', 'standard', 1, datetime('now')),
  ('ent_pro_9', 'tier_pro', 'bulk_export', 'Bulk Export', '1000', 1, datetime('now'));
