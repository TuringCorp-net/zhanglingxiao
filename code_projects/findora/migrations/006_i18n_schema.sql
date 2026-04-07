-- Findora D1 Schema Migration 006: F-022 Multi-language Support
-- Based on SRS Section 5.7

-- Translation keys table (stores all translatable strings)
CREATE TABLE IF NOT EXISTS translation_keys (
  id TEXT PRIMARY KEY,
  key_name TEXT NOT NULL,
  module TEXT DEFAULT 'common',
  description TEXT,
  source_locale TEXT DEFAULT 'en',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Translations table (stores translated content)
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  translation_key_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  translator_id TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (translation_key_id) REFERENCES translation_keys(id)
);

-- Content translations table (stores translated product/list content)
CREATE TABLE IF NOT EXISTS content_translations (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_text TEXT,
  translated_text TEXT,
  status TEXT DEFAULT 'draft',
  translator_id TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Translation sync queue (tracks content needing re-translation)
CREATE TABLE IF NOT EXISTS translation_sync_queue (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  processed_at TEXT
);

-- Supported locales configuration
CREATE TABLE IF NOT EXISTS supported_locales (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  is_rtl INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Indexes for i18n tables
CREATE INDEX IF NOT EXISTS idx_translations_key_locale ON translations(translation_key_id, locale);
CREATE INDEX IF NOT EXISTS idx_translations_locale ON translations(locale);
CREATE INDEX IF NOT EXISTS idx_content_translations_lookup ON content_translations(content_type, content_id, locale, field_name);
CREATE INDEX IF NOT EXISTS idx_content_translations_locale ON content_translations(locale);
CREATE INDEX IF NOT EXISTS idx_translation_sync_queue_status ON translation_sync_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_supported_locales_active ON supported_locales(is_active, sort_order);

-- Seed default locales
INSERT OR REPLACE INTO supported_locales (code, name, native_name, is_rtl, is_default, is_active, sort_order, created_at) VALUES
  ('en', 'English', 'English', 0, 1, 1, 1, datetime('now')),
  ('es', 'Spanish', 'Español', 0, 0, 1, 2, datetime('now')),
  ('fr', 'French', 'Français', 0, 0, 1, 3, datetime('now')),
  ('de', 'German', 'Deutsch', 0, 0, 1, 4, datetime('now')),
  ('ja', 'Japanese', '日本語', 0, 0, 0, 5, datetime('now')),
  ('zh', 'Chinese', '中文', 0, 0, 0, 6, datetime('now'));
