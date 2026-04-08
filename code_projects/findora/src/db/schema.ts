// D1 Schema Types - matching migrations/001_initial_schema.sql

export interface Product {
  id: string;
  source_platform: string;
  source_url: string;
  original_title: string;
  rewritten_title: string | null;
  category: string;
  subcategory: string | null;
  tags: string; // JSON array
  price_min: number | null;
  price_max: number | null;
  currency: string;
  images: string; // JSON array
  summary: string | null;
  pros: string; // JSON array
  cons: string; // JSON array
  use_cases: string; // JSON array
  target_audience: string; // JSON array
  shipping_notes: string | null;
  merchant_name: string | null;
  affiliate_url: string | null;
  last_checked_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string | null;
  anonymous_id: string | null;
  subscribed_categories: string; // JSON array
  price_preference: string | null;
  liked_tags: string; // JSON array
  disliked_tags: string; // JSON array
  click_history: string; // JSON array
  saved_items: string; // JSON array
  locale: string;
  frequency_preference: string;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Click {
  id: string;
  product_id: string;
  user_id: string | null;
  anonymous_id: string | null;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referer: string | null;
  ip_country: string | null;
  clicked_at: string;
}

export interface List {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  why_these: string | null;
  cover_image: string | null;
  category: string | null;
  status: string;
  content_type: string; // O-F030-06: organic | affiliate | sponsored
  disclosure: string | null; // O-F030-06: Required for affiliate/sponsored
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  layer: string;
  parent_id: string | null;
  created_at: string;
}

// AI Review Record (F-021)
export interface AIReviewRecord {
  id: string;
  content_type: string;
  content_id: string;
  draft_content: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'revision_requested' | 'published';
  current_step: 'ai_generation' | 'first_review' | 'high_risk_review' | 'tone_review' | 'published';
  category: string | null;
  is_high_risk: boolean;
  created_by: string;
  reviewed_by: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// Translation Keys (F-022)
export interface TranslationKey {
  id: string;
  key_name: string;
  module: string;
  description: string | null;
  source_locale: string;
  created_at: string;
  updated_at: string;
}

// Translations (F-022)
export interface Translation {
  id: string;
  translation_key_id: string;
  locale: string;
  translated_text: string;
  status: 'draft' | 'approved' | 'rejected';
  translator_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Content Translations (F-022)
export interface ContentTranslation {
  id: string;
  content_type: string;
  content_id: string;
  locale: string;
  field_name: string;
  original_text: string | null;
  translated_text: string | null;
  status: 'draft' | 'approved' | 'rejected';
  translator_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Supported Locale (F-022)
export interface SupportedLocale {
  code: string;
  name: string;
  native_name: string;
  is_rtl: number;
  is_default: number;
  is_active: number;
  sort_order: number;
  created_at: string;
}

// Membership Tier (F-023)
export interface MembershipTier {
  id: string;
  code: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: string;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// User Membership (F-023)
export interface UserMembership {
  id: string;
  user_id: string;
  tier_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  plan_interval: 'monthly' | 'yearly';
  external_subscription_id: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
}

// Subscription Event (F-023)
export interface SubscriptionEvent {
  id: string;
  user_membership_id: string;
  user_id: string;
  event_type: string;
  old_tier_id: string | null;
  new_tier_id: string | null;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  amount_charged: number | null;
  currency: string | null;
  metadata: string | null;
  created_at: string;
}

// Membership Entitlement (F-023)
export interface MembershipEntitlement {
  id: string;
  tier_id: string;
  feature_code: string;
  feature_name: string;
  value: string | null;
  is_allowed: number;
  created_at: string;
}

// Exclusive Content (F-023)
export interface ExclusiveContent {
  id: string;
  content_type: string;
  content_id: string;
  required_tier_id: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

// Payment (F-023)
export interface Payment {
  id: string;
  user_membership_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string | null;
  external_payment_id: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
}

// === Enterprise Management System (EMS) ===

// Enterprise - Organization/Company entity
export interface Enterprise {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
  size: string | null; // 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  verified_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Enterprise Member - User membership in an enterprise
export interface EnterpriseMember {
  id: string;
  enterprise_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'inactive' | 'pending' | 'removed';
  joined_at: string;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

// Record - Business record/document entity
export interface Record {
  id: string;
  enterprise_id: string;
  title: string;
  description: string | null;
  record_type: string; // 'document' | 'certificate' | 'license' | 'contract' | 'report' | 'other'
  record_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issuing_authority: string | null;
  file_url: string | null;
  file_hash: string | null;
  metadata: string; // JSON object for flexible fields
  status: 'draft' | 'active' | 'expired' | 'revoked' | 'archived';
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Audit Log - Tracks all actions for compliance
export interface AuditLog {
  id: string;
  enterprise_id: string | null;
  user_id: string | null;
  action: string; // 'create' | 'update' | 'delete' | 'login' | 'logout' | 'access' | 'export' | 'approve' | 'reject'
  resource_type: string; // 'enterprise' | 'member' | 'record' | 'user' | 'auth'
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  changes: string | null; // JSON object showing before/after values
  metadata: string | null; // Additional context
  created_at: string;
}

// User (EMS) - Enterprise system user
export interface EMSUser {
  id: string;
  email: string;
  password_hash: string | null;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// User Session (EMS) - Active session tracking
export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
}

// Content Topic (F-030) - Content workflow选题
export interface ContentTopic {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: 'idea' | 'in_review' | 'approved' | 'published' | 'archived';
  priority: number;
  target_week: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  approved_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  scheduled_publish_at: string | null; // O-F030-03: Flexible publish scheduling
  weekly_output: number;
  created_at: string;
  updated_at: string;
}

// Topic-Product Association (F-030) - 候选商品
export interface TopicProduct {
  id: string;
  topic_id: string;
  product_id: string;
  position: number;
  ai_score: number | null;
  ai_reason: string | null;
  human_verified: number;
  is_selected: number;
  notes: string | null;
  product_url: string | null; // O-F030-01: Enhanced structured fields
  highlight_tags: string | null; // O-F030-01: JSON array for key features
  comparison_notes: string | null; // O-F030-01: Pros/Cons summary
  created_at: string;
  updated_at: string;
}

// Content Production Tracking (F-030) - 周产出统计
export interface ContentProduction {
  id: string;
  topic_id: string | null;
  list_id: string | null;
  week_start: string;
  week_end: string;
  products_published: number;
  content_type: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  review_notes: string | null;
  review_completed: number;
  review_completed_at: string | null;
  version: number; // O-F030-04: Version tracking for rollback
  parent_version_id: string | null; // O-F030-04: Version chain for rollback
  created_at: string;
  updated_at: string;
}

// Workflow Audit Log (F-030) - 合规追踪
export interface WorkflowAuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string | null;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  metadata: string | null;
  created_at: string;
}

// List-Product Association Table (F-004)
export interface ListProduct {
  id: string;
  list_id: string;
  product_id: string;
  position: number;
  created_at: string;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // Admin authentication (C-02: Admin key for admin endpoints)
  ADMIN_KEY?: string;
  // Email provider settings (F-013-07)
  EMAIL_PROVIDER?: 'resend' | 'sendgrid';
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  // AI provider settings (F-016, F-020)
  AI_PROVIDER?: 'openai' | 'anthropic';
  AI_API_KEY?: string;
}
