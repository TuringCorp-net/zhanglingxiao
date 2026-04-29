-- Migration 022: AI Update Logs for Idempotency (F-040-22)
-- SRS requirement: ai_update_logs table for request_id-based idempotency guarantee
-- Purpose: Ensure external AI operations are not duplicated on request_id replay

-- Drop existing table if any (for clean migration)
DROP TABLE IF EXISTS ai_update_logs;

-- Create ai_update_logs table
CREATE TABLE IF NOT EXISTS ai_update_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  error_message TEXT,
  metadata TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create unique index on request_id for idempotency check
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_update_logs_request_id ON ai_update_logs(request_id);

-- Create index on status for monitoring queries
CREATE INDEX IF NOT EXISTS idx_ai_update_logs_status ON ai_update_logs(status);

-- Create index on operation_type for filtering
CREATE INDEX IF NOT EXISTS idx_ai_update_logs_operation_type ON ai_update_logs(operation_type);

-- Create index on created_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_ai_update_logs_created_at ON ai_update_logs(created_at);