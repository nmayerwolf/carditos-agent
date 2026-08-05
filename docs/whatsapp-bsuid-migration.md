# Migración a BSUID de WhatsApp

_Adaptado de la guía portable escrita a partir de la migración implementada en juampi-blis-agent. Nombres de tabla/columna ajustados al esquema de Carditos (`users.phone_number`, no `whatsapp_phone`)._

## El problema

WhatsApp está reemplazando el número de teléfono por usernames como identificador de contacto. Cuando un usuario adopta un username, **su número de teléfono deja de llegar en los webhooks** — no cambia de valor, directamente desaparece. Carditos identificaba coaches únicamente por `phone_number` (lookup en cada mensaje entrante), así que esa persona dejaría de ser reconocida y el sistema la trataría como alguien completamente nuevo.

El reemplazo es el **BSUID** (Business-Scoped User ID): un identificador estable por contacto que ya llega hoy, en cada mensaje, haya o no adoptado username.

## Confirmado con soporte de Kapso

- `message.from` → teléfono (puede desaparecer).
- `message.from_user_id` → BSUID. Estable, ya presente en cada webhook entrante, para todos los usuarios.
- El BSUID es estable en el tiempo, **excepto** si el usuario cambia de número de teléfono → ahí Meta regenera el BSUID (ver gap conocido más abajo).
- Para envíos salientes, el endpoint de mensajes acepta un campo `recipient` (BSUID) además de `to` (teléfono). Meta prioriza `to` si es válido, y cae a `recipient` si no.
- El envío por teléfono **no tiene fecha de corte anunciada** — no es urgente sacarlo, solo agregar el BSUID como red de seguridad.
- Backfill de contactos existentes: `GET https://api.kapso.ai/platform/v1/whatsapp/contacts` (header `X-API-Key`), paginado por cursor vía `paging.next` (URL completa de la siguiente página, `null` cuando termina). El endpoint rechaza `?limit=200` explícito (error 400) — usar sin `limit`.
- **No existe** un evento dedicado `whatsapp.contact.identity_changed` en Kapso. Un cambio de número llega como mensaje `type: "system"` (`system.type = "user_changed_number"`) dentro del payload raw de Meta, no en el webhook normalizado de Kapso. Cubrir esto requeriría un webhook raw aparte apuntando directo a Meta. **Decisión tomada**: no vale la pena para un caso tan angosto — queda como gap conocido, resoluble a mano si ocurre.

## Qué se implementó en Carditos

1. **Migración de esquema** — [db/migrations/007_add_whatsapp_bsuid.sql](../db/migrations/007_add_whatsapp_bsuid.sql): agrega `users.whatsapp_bsuid TEXT UNIQUE`.
2. **Captura del BSUID en el webhook** — [src/routes/webhooks.ts](../src/routes/webhooks.ts): se extrae `msg.from_user_id` junto a `msg.from` y se threadea por toda la cadena (lookup de usuario, envíos de respuesta).
3. **Lookup con fallback + auto-actualización** — [src/services/conversations.ts](../src/services/conversations.ts) (`getOrCreateUser`): BSUID primero, teléfono como fallback. Si el usuario existe pero su `whatsapp_bsuid` guardado no coincide con el de este mensaje, se actualiza (self-healing con el tráfico normal, sin necesidad de backfill).
4. **Envío dual** — [src/services/whatsapp.ts](../src/services/whatsapp.ts) (`sendMessage`, `sendVideo`): agregan `recipient` (BSUID) junto a `to` (teléfono) cuando hay BSUID disponible.
5. **Backfill de usuarios existentes** — [scripts/backfill-bsuid.ts](../scripts/backfill-bsuid.ts) (`npm run backfill:bsuid -- --apply`).

Los comandos de superadmin (`aprobar`, `rechazar`, `pendientes`) siguen operando por teléfono tal cual — son iniciados por un humano que teclea el número, no dependen del webhook.

## Checklist de rollout

- [x] Migración SQL (`whatsapp_bsuid`).
- [x] Extracción de `from_user_id` en el webhook, threadeado a lookup y envíos.
- [x] Lookup BSUID-primero-teléfono-fallback con self-healing.
- [x] `recipient` en el payload de envío cuando hay BSUID guardado.
- [x] Script de backfill (dry-run por default, `--apply` para escribir).
- [ ] Correr `npm run db:migrate` en producción antes de deployar este código.
- [ ] Correr `npm run backfill:bsuid` (dry-run primero, revisar output, después `-- --apply`).
- [ ] Gap de `user_changed_number` documentado como conocido, no implementado.
