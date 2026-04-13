-- Findora D1 Schema Migration 001
-- Based on SRS F-050

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  source_url TEXT NOT NULL,
  original_title TEXT NOT NULL,
  rewritten_title TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  tags TEXT DEFAULT '[]',
  price_min REAL,
  price_max REAL,
  currency TEXT DEFAULT 'USD',
  cover_image TEXT,
  r2_object_key TEXT NOT NULL DEFAULT '',
  images TEXT DEFAULT '[]',
  summary TEXT,
  pros TEXT DEFAULT '[]',
  cons TEXT DEFAULT '[]',
  use_cases TEXT DEFAULT '[]',
  target_audience TEXT DEFAULT '[]',
  shipping_notes TEXT,
  merchant_name TEXT,
  affiliate_url TEXT,
  last_checked_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  anonymous_id TEXT UNIQUE,
  subscribed_categories TEXT DEFAULT '[]',
  price_preference TEXT,
  liked_tags TEXT DEFAULT '[]',
  disliked_tags TEXT DEFAULT '[]',
  click_history TEXT DEFAULT '[]',
  saved_items TEXT DEFAULT '[]',
  locale TEXT DEFAULT 'en',
  frequency_preference TEXT DEFAULT 'daily',
  subscribed_at TEXT,
  unsubscribed_at TEXT,
  session_expires_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT,
  anonymous_id TEXT,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referer TEXT,
  ip_country TEXT,
  clicked_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  why_these TEXT,
  cover_image TEXT,
  category TEXT,
  status TEXT DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  layer TEXT DEFAULT 'function' CHECK(layer IN ('category', 'function', 'audience', 'style', 'price')),
  dimension_level INTEGER DEFAULT 2,
  parent_id TEXT,
  featured_products TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS list_products (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(list_id, product_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_list_products_list_id ON list_products(list_id);
CREATE INDEX IF NOT EXISTS idx_list_products_product_id ON list_products(product_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_r2_key_unique ON products(r2_object_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_anonymous_id ON users(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_clicks_product_id ON clicks(product_id);
CREATE INDEX IF NOT EXISTS idx_clicks_anonymous_id ON clicks(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_lists_slug ON lists(slug);
CREATE INDEX IF NOT EXISTS idx_lists_status ON lists(status);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
