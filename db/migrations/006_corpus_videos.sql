-- Migration 006: Corpus Videos table
-- Videos de ejercicios y drills para enviar por WhatsApp

CREATE TABLE IF NOT EXISTS corpus_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  -- tags: palabras clave para que Claude identifique cuándo es relevante
  url TEXT NOT NULL,
  -- url: URL pública de Supabase Storage
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corpus_videos_active ON corpus_videos(active);
