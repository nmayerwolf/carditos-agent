# Data Model — Carditos

## Tables

### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  club_role VARCHAR(50), -- 'coach_infantil', 'coach_juvenil', 'admin'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_users_phone ON users(phone_number);
```

### `conversations`
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whatsapp_conversation_id VARCHAR(100), -- from Kapso
  started_at TIMESTAMP DEFAULT now(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_whatsapp ON conversations(whatsapp_conversation_id);
```

### `messages`
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction VARCHAR(10), -- 'inbound' or 'outbound'
  content TEXT NOT NULL,
  media_url VARCHAR(500),
  media_type VARCHAR(50), -- 'image', 'audio', 'document'
  tokens_used INT, -- for LLM billing
  latency_ms INT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_user ON messages(user_id);
```

### `corpus_documents`
```sql
CREATE TABLE corpus_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  source VARCHAR(255), -- 'reglamento_uar', 'drills_club', etc.
  content TEXT NOT NULL,
  category VARCHAR(100), -- 'reglamento', 'ejercicios', 'manejo_grupal'
  version INT DEFAULT 1,
  ingested_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_corpus_category ON corpus_documents(category);
```

### `corpus_embeddings` (pgvector)
```sql
CREATE TABLE corpus_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES corpus_documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INT,
  embedding vector(1536), -- OpenAI text-embedding-3-small
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_embeddings_doc ON corpus_embeddings(document_id);
CREATE INDEX idx_embeddings_vector ON corpus_embeddings USING ivfflat (embedding vector_cosine_ops);
```

## Constraints & Indices

- `users.phone_number`: UNIQUE (one coach per number)
- `messages`: TTL policy for privacy (keep 30 days, then archive)
- `corpus_embeddings`: vector index for similarity search (<100ms)

## Seeds

```sql
-- Initial coaches (to be populated from Club)
INSERT INTO users (phone_number, name, club_role)
VALUES
  ('+5491112345678', 'Coach A', 'coach_infantil'),
  ('+5491187654321', 'Coach B', 'coach_juvenil');

-- Initial corpus (to be populated from ingest)
-- See scripts/ingest-knowledge.ts
```

## Enum-like domains

- `club_role`: 'coach_infantil', 'coach_juvenil', 'admin'
- `category`: 'reglamento', 'ejercicios', 'manejo_grupal', 'modalidades'
- `media_type`: 'image', 'audio', 'document', 'video'

