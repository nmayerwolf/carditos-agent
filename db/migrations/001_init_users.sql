-- Migration 001: Users table
-- Coaches and admin users

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  club_role VARCHAR(50) NOT NULL DEFAULT 'coach_infantil',
  -- club_role: 'coach_infantil', 'coach_juvenil', 'admin'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(club_role);

-- Insert test coaches
INSERT INTO users (phone_number, name, club_role)
VALUES
  ('+5491112345678', 'Coach Infantil Test', 'coach_infantil'),
  ('+5491187654321', 'Coach Juvenil Test', 'coach_juvenil')
ON CONFLICT (phone_number) DO NOTHING;
