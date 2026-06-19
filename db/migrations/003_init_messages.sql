-- Migration 003: Messages table
-- All inbound and outbound messages

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL,
  -- direction: 'inbound' (coach -> carditos), 'outbound' (carditos -> coach)
  content TEXT NOT NULL,
  media_url VARCHAR(500),
  media_type VARCHAR(50),
  -- media_type: 'image', 'audio', 'document', 'video'
  tokens_used INT,
  latency_ms INT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Auto-delete messages older than 30 days (privacy)
-- Note: This would be a trigger/job, for now just document the intent
