-- Chunking del corpus. Hasta ahora corpus_documents guardaba un doc entero por
-- fila (el PDF de leyes WR son ~47k tokens) y retrieval inyectaba hasta 5 docs
-- completos por mensaje. corpus_chunks parte cada doc en fragmentos chicos para
-- recuperar solo lo relevante.

CREATE TABLE IF NOT EXISTS corpus_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES corpus_documents(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  source VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  -- tsvector generado, mismo criterio que corpus_documents (título + contenido)
  content_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_corpus_chunks_fts ON corpus_chunks USING gin(content_tsv);
CREATE INDEX IF NOT EXISTS idx_corpus_chunks_document ON corpus_chunks(document_id);
