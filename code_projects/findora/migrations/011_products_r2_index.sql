ALTER TABLE products ADD COLUMN cover_image TEXT;
ALTER TABLE products ADD COLUMN r2_object_key TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE tags ADD COLUMN dimension_level INTEGER DEFAULT 2;
ALTER TABLE tags ADD COLUMN featured_products TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN session_expires_at TEXT;

UPDATE products
SET cover_image = CASE
  WHEN cover_image IS NULL OR cover_image = '' THEN json_extract(images, '$[0]')
  ELSE cover_image
END;

UPDATE products
SET r2_object_key = CASE
  WHEN r2_object_key = '' OR r2_object_key IS NULL THEN ('products/' || id || '.md')
  ELSE r2_object_key
END;

UPDATE products
SET title = CASE
  WHEN title IS NULL OR title = '' THEN COALESCE(rewritten_title, original_title, '')
  ELSE title
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_r2_key_unique ON products(r2_object_key);
