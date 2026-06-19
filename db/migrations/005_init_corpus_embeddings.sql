-- Migration 005: Corpus Embeddings table (with pgvector)
-- Vector embeddings for semantic search over corpus

-- Enable pgvector extension (run manually in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS corpus_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES corpus_documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL,
  embedding vector(1536),
  -- OpenAI text-embedding-3-small produces 1536 dimensions
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_doc ON corpus_embeddings(document_id);
-- Vector index for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
  ON corpus_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
