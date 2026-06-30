-- Columna tsvector generada automáticamente con stemming en español.
-- Incluye título + contenido para mejorar el recall.
ALTER TABLE corpus_documents
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED;

-- Índice GIN para búsqueda full-text eficiente.
CREATE INDEX IF NOT EXISTS idx_corpus_fts ON corpus_documents USING gin(content_tsv);
