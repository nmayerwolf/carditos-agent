-- Migration 006: search_corpus RPC function
-- Semantic similarity search over corpus embeddings using pgvector

CREATE OR REPLACE FUNCTION search_corpus(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.5,
  match_limit int DEFAULT 5
)
RETURNS TABLE (
  document_title text,
  chunk_text text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    cd.title AS document_title,
    ce.chunk_text,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM corpus_embeddings ce
  JOIN corpus_documents cd ON cd.id = ce.document_id
  WHERE 1 - (ce.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_limit;
$$;
