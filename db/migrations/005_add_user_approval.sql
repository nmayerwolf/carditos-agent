-- Usuarios existentes quedan como 'approved' para no bloquearlos
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending_name', 'pending_approval', 'approved', 'rejected'));

-- Nuevos usuarios arrancan como pending_name
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'pending_name';

-- Tabla de superadmins
CREATE TABLE IF NOT EXISTS superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
