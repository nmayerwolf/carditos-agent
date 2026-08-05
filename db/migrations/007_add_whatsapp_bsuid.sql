-- Migration 007: WhatsApp BSUID
-- WhatsApp está reemplazando el teléfono por usernames como identificador de contacto.
-- Cuando un usuario adopta un username, su phone_number deja de llegar en los webhooks.
-- El BSUID (Business-Scoped User ID) es estable por contacto y sobrevive a ese cambio.
-- Ver docs/whatsapp-bsuid-migration.md.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp_bsuid TEXT UNIQUE;
