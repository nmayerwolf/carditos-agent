-- Costo real por mensaje, en USD. Antes el admin estimaba tokens_used a una
-- tarifa plana, que subcuenta (no incluye tokens de cache ni thinking a tarifa
-- de salida). Ahora el backend calcula el costo con los 4 contadores de usage.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12, 6);
