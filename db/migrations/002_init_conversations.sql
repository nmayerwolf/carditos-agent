-- Migration 002: Conversations table
-- WhatsApp conversation sessions per user

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whatsapp_conversation_id VARCHAR(100),
  started_at TIMESTAMP DEFAULT now(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp ON conversations(whatsapp_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at DESC);
