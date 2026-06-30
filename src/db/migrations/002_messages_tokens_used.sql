-- Columna para guardar tokens usados por respuesta de Claude (outbound).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER;
