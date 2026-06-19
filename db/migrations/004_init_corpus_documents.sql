-- Migration 004: Corpus Documents table
-- Source documents for RAG (rugby knowledge)

CREATE TABLE IF NOT EXISTS corpus_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  source VARCHAR(255) NOT NULL,
  -- source: 'reglamento_uar', 'drills_club', 'videos_transcritos', 'charlas_coaches'
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  -- category: 'reglamento', 'ejercicios', 'manejo_grupal', 'modalidades'
  version INT DEFAULT 1,
  ingested_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corpus_source ON corpus_documents(source);
CREATE INDEX IF NOT EXISTS idx_corpus_category ON corpus_documents(category);
CREATE INDEX IF NOT EXISTS idx_corpus_ingested ON corpus_documents(ingested_at DESC);
