-- Findora D1 Seed Script - Development Testing Data
-- Run with: wrangler d1 execute findora-dev --file=migrations/003_seed_data.sql --local
-- Or for production: wrangler d1 execute findora-staging --file=migrations/003_seed_data.sql

-- Clear existing data (optional, for fresh seed)
-- DELETE FROM clicks;
-- DELETE FROM users;
-- DELETE FROM products;
-- DELETE FROM lists;
-- DELETE FROM tags;
-- DELETE FROM list_products;

-- ============================================
-- TAGS (F-011) - Tag Layer System
-- ============================================

-- Category tags
INSERT INTO tags (id, name, slug, layer, parent_id, created_at) VALUES
  ('tag-cat-kitchen', 'Kitchen', 'kitchen', 'category', NULL, datetime('now')),
  ('tag-cat-home', 'Home', 'home', 'category', NULL, datetime('now')),
  ('tag-cat-beauty', 'Beauty', 'beauty', 'category', NULL, datetime('now')),
  ('tag-cat-electronics', 'Electronics', 'electronics', 'category', NULL, datetime('now')),
  ('tag-cat-pet', 'Pet', 'pet', 'category', NULL, datetime('now')),
  ('tag-cat-outdoor', 'Outdoor', 'outdoor', 'category', NULL, datetime('now')),
  ('tag-cat-office', 'Office', 'office', 'category', NULL, datetime('now')),
  ('tag-cat-travel', 'Travel', 'travel', 'category', NULL, datetime('now'));

-- Function tags
INSERT INTO tags (id, name, slug, layer, parent_id, created_at) VALUES
  ('tag-func-organizing', 'Organizing', 'organizing', 'function', NULL, datetime('now')),
  ('tag-func-cleaning', 'Cleaning', 'cleaning', 'function', NULL, datetime('now')),
  ('tag-func-decorating', 'Decorating', 'decorating', 'function', NULL, datetime('now')),
  ('tag-func-cooking', 'Cooking', 'cooking', 'function', NULL, datetime('now')),
  ('tag-func-gifting', 'Gifting', 'gifting', 'function', NULL, datetime('now')),
  ('tag-func-fitness', 'Fitness', 'fitness', 'function', NULL, datetime('now')),
  ('tag-func-tech', 'Tech Gadgets', 'tech', 'function', NULL, datetime('now')),
  ('tag-func-storage', 'Storage', 'storage', 'function', NULL, datetime('now'));

-- Audience tags
INSERT INTO tags (id, name, slug, layer, parent_id, created_at) VALUES
  ('tag-aud-moms', 'For Moms', 'for-moms', 'audience', NULL, datetime('now')),
  ('tag-aud-students', 'For Students', 'for-students', 'audience', NULL, datetime('now')),
  ('tag-aud-pet-owners', 'For Pet Owners', 'for-pet-owners', 'audience', NULL, datetime('now')),
  ('tag-aud-cooks', 'For Home Cooks', 'for-cooks', 'audience', NULL, datetime('now')),
  ('tag-aud-remote', 'For Remote Workers', 'for-remote-workers', 'audience', NULL, datetime('now')),
  ('tag-aud-travelers', 'For Travelers', 'for-travelers', 'audience', NULL, datetime('now'));

-- Style tags
INSERT INTO tags (id, name, slug, layer, parent_id, created_at) VALUES
  ('tag-style-minimalist', 'Minimalist', 'minimalist', 'style', NULL, datetime('now')),
  ('tag-style-cute', 'Cute', 'cute', 'style', NULL, datetime('now')),
  ('tag-style-luxury', 'Luxury-Looking', 'luxury', 'style', NULL, datetime('now')),
  ('tag-style-eco', 'Eco-Friendly', 'eco-friendly', 'style', NULL, datetime('now')),
  ('tag-style-weird', 'Unique/Weird', 'weird', 'style', NULL, datetime('now'));

-- Price tags
INSERT INTO tags (id, name, slug, layer, parent_id, created_at) VALUES
  ('tag-price-budget', 'Budget Friendly', 'budget', 'price', NULL, datetime('now')),
  ('tag-price-mid', 'Mid-Range', 'mid-range', 'price', NULL, datetime('now')),
  ('tag-price-premium', 'Premium', 'premium', 'price', NULL, datetime('now')),
  ('tag-price-impulse', 'Impulse Buy', 'impulse', 'price', NULL, datetime('now'));

-- ============================================
-- PRODUCTS (F-010) - Sample Product Data
-- ============================================

-- Kitchen products
INSERT INTO products (id, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, status, created_at, updated_at) VALUES
  (
    'prod-001',
    'amazon',
    'https://amazon.com/dp/B08XXXXX01',
    'Instant Pot Duo 7-in-1 Electric Pressure Cooker',
    'The All-in-One Kitchen Must-Have: Instant Pot Duo',
    'kitchen',
    'cookware',
    '["tag-cat-kitchen", "tag-func-cooking", "tag-func-organizing", "tag-price-mid", "tag-aud-cooks"]',
    79.99,
    99.99,
    'USD',
    '["https://images.unsplash.com/photo-1585237672818-a72f3b1e5192?w=400"]',
    'Transform your cooking with this 7-in-1 powerhouse that replaces multiple appliances.',
    '["Easy one-touch cooking", "Saves counter space", "Multiple cooking functions", "Programmable timer"]',
    '["Takes time to learn all features", "Large footprint"]',
    '["Pressure cooking", "Slow cooking", "Rice cooking", "Steaming"]',
    '["tag-aud-cooks", "tag-aud-moms"]',
    'Free shipping for Prime members',
    'Instant Pot',
    'https://amazon.com/dp/B08XXXXX01?tag=findora-20',
    'active',
    datetime('now', '-30 days'),
    datetime('now')
  ),
  (
    'prod-002',
    'amazon',
    'https://amazon.com/dp/B09YYYYY02',
    'Magnetic Knife Strip Wall Mount',
    'End Counter Clutter: This Minimalist Knife Strip Is Genius',
    'kitchen',
    'organization',
    '["tag-cat-kitchen", "tag-func-organizing", "tag-style-minimalist", "tag-price-budget", "tag-aud-moms"]',
    19.99,
    24.99,
    'USD',
    '["https://images.unsplash.com/photo-1593618998160-e34014e67546?w=400"]',
    'Keep your knives within reach without taking up precious counter space.',
    '["Saves counter space", "Easy installation", "Modern look", "Keeps knives sharp"]',
    '["Requires wall mounting", "May not fit all knife sets"]',
    '["Knife storage", "Wall organization", "Kitchen organization"]',
    '["tag-aud-moms", "tag-style-minimalist"]',
    'Ships from US',
    'KitchenAid',
    'https://amazon.com/dp/B09YYYYY02?tag=findora-20',
    'active',
    datetime('now', '-25 days'),
    datetime('now')
  ),
  (
    'prod-003',
    'amazon',
    'https://amazon.com/dp/B07ZZZZZ03',
    'Silicone Stretch Lids Set - 12 Pack',
    'The $10 Solution That Replaces Plastic Wrap Forever',
    'kitchen',
    'storage',
    '["tag-cat-kitchen", "tag-func-storage", "tag-style-eco", "tag-price-budget", "tag-aud-moms"]',
    9.99,
    12.99,
    'USD',
    '["https://images.unsplash.com/photo-1610725664285-7c57e6eeac3c?w=400"]',
    'Stretchy, reusable silicone lids that fit almost anything.',
    '["Eco-friendly alternative to plastic wrap", "Versatile fit", "Easy to clean", "Dishwasher safe"]',
    '["May not fit very large bowls", "Can stretch out over time"]',
    '["Food storage", "Fridge organization", "Meal prep"]',
    '["tag-aud-moms", "tag-style-eco"]',
    'Free shipping on orders over $25',
    'Lid-Cious',
    'https://amazon.com/dp/B07ZZZZZ03?tag=findora-20',
    'active',
    datetime('now', '-20 days'),
    datetime('now')
  );

-- Home/Office products
INSERT INTO products (id, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, status, created_at, updated_at) VALUES
  (
    'prod-004',
    'amazon',
    'https://amazon.com/dp/B08AAAAAA04',
    'Cable Management Kit - 300pcs',
    'Tame the Cable Chaos: This Kit Transforms Any Desk',
    'home',
    'office',
    '["tag-cat-home", "tag-cat-office", "tag-func-organizing", "tag-style-minimalist", "tag-price-budget", "tag-aud-remote"]',
    14.99,
    19.99,
    'USD',
    '["https://images.unsplash.com/photo-1589939705384-5185137a8f53?w=400"]',
    'Everything you need to organize cables behind your desk or TV.',
    '["Complete kit with multiple organizer types", "Self-adhesive backing", " reusable clips", "Versatile use"]',
    '["Adhesive may lose stickiness over time", "Some clips too small for thick cables"]',
    '["Desk cable management", "TV cable hiding", "Wire organization"]',
    '["tag-aud-remote", "tag-style-minimalist"]',
    'Ships in original packaging',
    'CableClip Pro',
    'https://amazon.com/dp/B08AAAAAA04?tag=findora-20',
    'active',
    datetime('now', '-15 days'),
    datetime('now')
  ),
  (
    'prod-005',
    'amazon',
    'https://amazon.com/dp/B09BBBBBB05',
    'Ergonomic Mesh Office Chair',
    'The Chair That Actually Supports Your Back During Long Workdays',
    'office',
    'furniture',
    '["tag-cat-office", "tag-func-fitness", "tag-style-minimalist", "tag-price-premium", "tag-aud-remote"]',
    249.99,
    299.99,
    'USD',
    '["https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=400"]',
    'Breathable mesh back with full lumbar support for all-day comfort.',
    '["Excellent lumbar support", "Breathable material", "Adjustable armrests", "360° swivel"]',
    '["Assembly required", "May be too firm for some"]',
    '["Home office work", "Gaming", "Long sitting sessions"]',
    '["tag-aud-remote", "tag-aud-students"]',
    'Free white-glove delivery',
    'ErgoMax',
    'https://amazon.com/dp/B09BBBBBB05?tag=findora-20',
    'active',
    datetime('now', '-10 days'),
    datetime('now')
  ),
  (
    'prod-006',
    'amazon',
    'https://amazon.com/dp/B10CCCCCC06',
    'Monitor Stand with Drawers',
    'This Monitor Stand Gave Me Back My Desk Space',
    'office',
    'organization',
    '["tag-cat-office", "tag-func-organizing", "tag-func-storage", "tag-style-minimalist", "tag-price-mid", "tag-aud-remote"]',
    39.99,
    49.99,
    'USD',
    '["https://images.unsplash.com/photo-1593640408182-31c228f54abb?w=400"]',
    'Raise your monitor to eye level while storing keyboard and accessories underneath.',
    '["Built-in storage drawer", "Raises monitor to ergonomic height", "Sturdy build", "Modern design"]',
    '["Limited drawer space", "May wobble on uneven surfaces"]',
    '["Monitor riser", "Desk organization", "Ergonomic setup"]',
    '["tag-aud-remote"]',
    'Ships flat, easy assembly',
    'DeskMate',
    'https://amazon.com/dp/B10CCCCCC06?tag=findora-20',
    'active',
    datetime('now', '-8 days'),
    datetime('now')
  );

-- Beauty products
INSERT INTO products (id, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, status, created_at, updated_at) VALUES
  (
    'prod-007',
    'amazon',
    'https://amazon.com/dp/B11DDDDD07',
    'LED Face Mask for Skincare',
    'Spa-Quality Skincare at Home: This LED Mask Actually Works',
    'beauty',
    'skincare-devices',
    '["tag-cat-beauty", "tag-func-fitness", "tag-price-premium", "tag-aud-moms"]',
    89.99,
    129.99,
    'USD',
    '["https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400"]',
    'Professional-grade LED light therapy for clearer, younger-looking skin.',
    '["Multiple light modes", "Easy to use at home", "Visible results over time", "Rechargeable"]',
    '["Requires consistent use", "Pricey for some budgets"]',
    '["Anti-aging treatment", "Acne reduction", "Skin rejuvenation"]',
    '["tag-aud-moms"]',
    'Ships from US, 30-day returns',
    'GlowPro',
    'https://amazon.com/dp/B11DDDDD07?tag=findora-20',
    'active',
    datetime('now', '-12 days'),
    datetime('now')
  );

-- Electronics/Gadgets
INSERT INTO products (id, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, status, created_at, updated_at) VALUES
  (
    'prod-008',
    'amazon',
    'https://amazon.com/dp/B12EEEEEE08',
    'Wireless Charging Pad - 3-in-1',
    'Declutter Your Nightstand: This 3-in-1 Charger Does It All',
    'electronics',
    'charging',
    '["tag-cat-electronics", "tag-func-tech", "tag-style-minimalist", "tag-price-mid", "tag-aud-remote", "tag-aud-students"]',
    29.99,
    39.99,
    'USD',
    '["https://images.unsplash.com/photo-1592432678016-e910b452f9a9?w=400"]',
    'Charge your phone, earbuds, and watch all at once.',
    '["Charges 3 devices simultaneously", "Clean minimal design", "Works with most phone cases", "LED indicator"]',
    '["Charging speed slower than wired", "Watch charger may not fit all bands"]',
    '["Nightstand charging", "Desk charging", "Travel charging"]',
    '["tag-aud-remote", "tag-aud-students"]',
    'Free shipping with Prime',
    'ChargeSync',
    'https://amazon.com/dp/B12EEEEEE08?tag=findora-20',
    'active',
    datetime('now', '-5 days'),
    datetime('now')
  ),
  (
    'prod-009',
    'amazon',
    'https://amazon.com/dp/B13FFFFFF09',
    'Mini Projector for Streaming',
    'Movie Night Anywhere: This Pocket-Sized Projector Is Surprising',
    'electronics',
    'entertainment',
    '["tag-cat-electronics", "tag-func-tech", "tag-style-cute", "tag-price-mid", "tag-aud-students", "tag-aud-travelers"]',
    99.99,
    149.99,
    'USD',
    '["https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400"]',
    'Compact projector with built-in streaming apps, perfect for movie nights anywhere.',
    '["Built-in streaming apps", "Portable size", "Keystone correction", "Built-in speakers"]',
    '["Lower resolution than TVs", "Battery life limited"]',
    '["Outdoor movie nights", "Travel entertainment", "Presentation"]',
    '["tag-aud-students", "tag-aud-travelers"]',
    '2-year warranty included',
    'PicoView',
    'https://amazon.com/dp/B13FFFFFF09?tag=findora-20',
    'active',
    datetime('now', '-3 days'),
    datetime('now')
  );

-- Pet products
INSERT INTO products (id, source_platform, source_url, original_title, rewritten_title, category, subcategory, tags, price_min, price_max, currency, images, summary, pros, cons, use_cases, target_audience, shipping_notes, merchant_name, affiliate_url, status, created_at, updated_at) VALUES
  (
    'prod-010',
    'amazon',
    'https://amazon.com/dp/B14GGGGG10',
    'Automatic Pet Water Fountain',
    'Keep Your Cat Hydrated: The Fountain That Cats Actually Love',
    'pet',
    'hydration',
    '["tag-cat-pet", "tag-func-cleaning", "tag-style-eco", "tag-price-mid", "tag-aud-pet-owners"]',
    34.99,
    44.99,
    'USD',
    '["https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400"]',
    '5L大容量自动循环饮水机，过滤系统保证水质新鲜，适合猫咪和小型犬',
    '["5L大容量", "三重过滤系统", "自动循环水流", "超静音设计", "防干烧保护"]',
    '["需要定期清洗水箱", "滤芯需要每月更换"]',
    '["宠物日常饮水", "多宠物家庭", "上班族外出时使用"]',
    '["tag-aud-pet-owners"]',
    '全国包邮，正品保证',
    'Pawaii宠物用品旗舰店',
    'https://amazon.com/dp/B14GGGGG10?tag=findora-20',
    'active',
    datetime('now', '-18 days'),
    datetime('now')
  );

-- ============================================
-- LISTS (F-004) - Sample Lists
-- ============================================

INSERT INTO lists (id, slug, title, description, why_these, cover_image, category, status, published_at, created_at, updated_at) VALUES
  (
    'list-001',
    '20-best-kitchen-gadgets-under-30',
    '20 Best Kitchen Gadgets Under $30 That Actually Work',
    'These affordable kitchen tools will transform how you cook without breaking the bank.',
    'We tested over 50 budget kitchen gadgets and picked the 20 that genuinely made our lives easier in the kitchen. No gimmicks, no overpriced items - just tools that work.',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
    'kitchen',
    'published',
    datetime('now', '-10 days'),
    datetime('now', '-12 days'),
    datetime('now', '-10 days')
  ),
  (
    'list-002',
    'home-office-essentials-remote-workers',
    'Home Office Essentials: 15 Things Every Remote Worker Needs',
    'Set up the perfect productive workspace with these editor-tested essentials.',
    'After working remotely for 3+ years, we''ve refined our setup to the essentials that actually make a difference in daily comfort and productivity.',
    'https://images.unsplash.com/photo-1593640408182-31c228f54abb?w=800',
    'office',
    'published',
    datetime('now', '-5 days'),
    datetime('now', '-7 days'),
    datetime('now', '-5 days')
  ),
  (
    'list-003',
    'tech-gifts-under-100',
    'Tech Gifts Under $100 That Will Impress Anyone',
    'Looking for the perfect tech gift? These picks prove you don''t need to spend a fortune.',
    'We curated these gifts based on actual usage and gift-giving success. Each item has been tested or verified to be genuinely useful and well-made.',
    'https://images.unsplash.com/photo-1593640408182-31c228f54abb?w=800',
    'electronics',
    'published',
    datetime('now', '-2 days'),
    datetime('now', '-3 days'),
    datetime('now', '-2 days')
  );

-- Associate products with lists
INSERT INTO list_products (list_id, product_id, position) VALUES
  ('list-001', 'prod-001', 1),
  ('list-001', 'prod-002', 2),
  ('list-001', 'prod-003', 3),
  ('list-002', 'prod-004', 1),
  ('list-002', 'prod-005', 2),
  ('list-002', 'prod-006', 3),
  ('list-003', 'prod-008', 1),
  ('list-003', 'prod-009', 2);

-- ============================================
-- USERS (F-013) - Sample User Data
-- ============================================

INSERT INTO users (id, email, anonymous_id, subscribed_categories, price_preference, liked_tags, disliked_tags, click_history, saved_items, locale, frequency_preference, subscribed_at, status, created_at, updated_at) VALUES
  (
    'user-001',
    'alex.kitchen@example.com',
    NULL,
    '["kitchen"]',
    'mid-range',
    '["tag-func-cooking", "tag-func-organizing"]',
    '[]',
    '["prod-001", "prod-002"]',
    '["prod-003"]',
    'en',
    'weekly',
    datetime('now', '-45 days'),
    'active',
    datetime('now', '-45 days'),
    datetime('now', '-5 days')
  ),
  (
    'user-002',
    'mike.remote@example.com',
    NULL,
    '["office", "electronics"]',
    'premium',
    '["tag-style-minimalist", "tag-func-organizing", "tag-func-tech"]',
    '["tag-style-weird"]',
    '["prod-004", "prod-005", "prod-006", "prod-008"]',
    '["prod-005"]',
    'en',
    'weekly',
    datetime('now', '-30 days'),
    'active',
    datetime('now', '-30 days'),
    datetime('now', '-1 days')
  ),
  (
    'user-003',
    'sarah.busy@example.com',
    NULL,
    '["kitchen", "home", "beauty"]',
    'budget',
    '["tag-func-organizing", "tag-aud-moms", "tag-style-eco"]',
    '[]',
    '["prod-001", "prod-003", "prod-007"]',
    '["prod-001", "prod-007"]',
    'en',
    'biweekly',
    datetime('now', '-60 days'),
    'active',
    datetime('now', '-60 days'),
    datetime('now', '-7 days')
  ),
  (
    'user-004',
    'david.student@example.com',
    NULL,
    '["electronics", "office"]',
    'budget',
    '["tag-func-tech", "tag-aud-students"]',
    '[]',
    '["prod-008", "prod-009"]',
    '["prod-009"]',
    'en',
    'weekly',
    datetime('now', '-20 days'),
    'active',
    datetime('now', '-20 days'),
    datetime('now', '-2 days')
  ),
  (
    'user-005',
    'emma.traveler@example.com',
    NULL,
    '["electronics", "outdoor"]',
    'mid-range',
    '["tag-aud-travelers", "tag-func-tech"]',
    '[]',
    '["prod-009"]',
    '[]',
    'en',
    'monthly',
    datetime('now', '-90 days'),
    'dormant',
    datetime('now', '-90 days'),
    datetime('now', '-35 days')
  ),
  (
    'user-006',
    NULL,
    'anon-abc123',
    '["kitchen", "pet"]',
    'mid-range',
    '["tag-func-cooking", "tag-aud-pet-owners"]',
    '[]',
    '["prod-001", "prod-010"]',
    '["prod-010"]',
    'en',
    'weekly',
    datetime('now', '-15 days'),
    'active',
    datetime('now', '-15 days'),
    datetime('now', '-3 days')
  );

-- ============================================
-- CLICKS (F-012) - Sample Click Data
-- ============================================

INSERT INTO clicks (id, product_id, user_id, anonymous_id, source, utm_source, utm_medium, utm_campaign, referer, ip_country, clicked_at) VALUES
  ('click-001', 'prod-001', 'user-001', NULL, 'list', 'findora', 'internal', 'weekly-picks', NULL, 'US', datetime('now', '-5 days')),
  ('click-002', 'prod-002', 'user-001', NULL, 'list', 'findora', 'internal', 'weekly-picks', NULL, 'US', datetime('now', '-4 days')),
  ('click-003', 'prod-004', 'user-002', NULL, 'category', 'google', 'organic', NULL, 'https://www.google.com/search?q=desk+organization', 'US', datetime('now', '-3 days')),
  ('click-004', 'prod-005', 'user-002', NULL, 'product', 'google', 'organic', NULL, 'https://www.google.com/search?q=ergonomic+office+chair', 'US', datetime('now', '-2 days')),
  ('click-005', 'prod-006', 'user-002', NULL, 'recommendation', NULL, NULL, NULL, NULL, 'CA', datetime('now', '-1 days')),
  ('click-006', 'prod-008', 'user-004', NULL, 'list', 'pinterest', 'social', 'tech-gifts', 'https://www.pinterest.com/', 'UK', datetime('now', '-2 days')),
  ('click-007', 'prod-009', 'user-004', NULL, 'recommendation', NULL, NULL, NULL, NULL, 'UK', datetime('now', '-1 days')),
  ('click-008', 'prod-010', NULL, 'anon-abc123', 'category', 'tiktok', 'social', NULL, 'https://tiktok.com/', 'AU', datetime('now', '-3 days')),
  ('click-009', 'prod-001', NULL, 'anon-abc123', 'product', NULL, NULL, NULL, NULL, 'AU', datetime('now', '-1 days'));

-- ============================================
-- SUMMARY
-- ============================================

-- SELECT 'Seed Data Summary' as info;
-- SELECT 'Tags: ' || COUNT(*) FROM tags;
-- SELECT 'Products: ' || COUNT(*) FROM products WHERE status = 'active';
-- SELECT 'Lists: ' || COUNT(*) FROM lists WHERE status = 'published';
-- SELECT 'Users: ' || COUNT(*) FROM users;
-- SELECT 'Clicks: ' || COUNT(*) FROM clicks;
