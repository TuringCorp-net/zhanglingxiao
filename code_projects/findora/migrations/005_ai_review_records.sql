-- Migration: 005_ai_review_records.sql
-- Description: AI review workflow tables for F-020/F-021
-- Created: 2026-04-07
--
-- Tables:
--   ai_review_records: Tracks AI-generated content through human review workflow
--
-- Workflow (SRS Section 5.2):
--   1. AI generates draft (status: draft)
--   2. Human first review (status: pending_review, step: first_review)
--   3. High-risk second review (status: pending_review, step: high_risk_review) - medical/beauty/kids/electronics
--   4. Tone review (status: pending_review, step: tone_review)
--   5. Published (status: approved)

-- AI Review Records Table
CREATE TABLE IF NOT EXISTS ai_review_records (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  draft_content TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  current_step TEXT DEFAULT 'ai_generation',
  category TEXT,
  is_high_risk INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  review_notes TEXT,
  rejection_reason TEXT,
  approved_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_review_content ON ai_review_records(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_review_status ON ai_review_records(status);
CREATE INDEX IF NOT EXISTS idx_review_high_risk ON ai_review_records(is_high_risk);
CREATE INDEX IF NOT EXISTS idx_review_created_by ON ai_review_records(created_by);
CREATE INDEX IF NOT EXISTS idx_review_current_step ON ai_review_records(current_step);
