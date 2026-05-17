-- Migration: 20260517_100001_user_ai_messages.sql
-- Description: Create user_ai_messages table for persistent AI chat history per user
-- Date: 2026-05-17

CREATE TABLE user_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  context_statement_id UUID REFERENCES bank_statements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_ai_messages_user_id ON user_ai_messages(user_id);
CREATE INDEX idx_user_ai_messages_created_at ON user_ai_messages(created_at);
CREATE INDEX idx_user_ai_messages_context_statement ON user_ai_messages(context_statement_id);

ALTER TABLE user_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ai_messages_select" ON user_ai_messages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_ai_messages_insert" ON user_ai_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_ai_messages_delete" ON user_ai_messages
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE user_ai_messages IS 'AI chat history per user — scoped to user_id, not organisation_id. Persists across all businesses.';
COMMENT ON COLUMN user_ai_messages.context_statement_id IS 'Set when the message was sent from the statement review page.';
