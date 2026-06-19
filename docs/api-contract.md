# API Contract — Carditos

## Webhooks (inbound from Kapso/WhatsApp)

### POST `/webhooks/whatsapp`

**Recibe** mensajes de WhatsApp desde Kapso.

#### Request Body
```json
{
  "entry": [
    {
      "id": "...",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "phone_number_id": "...",
              "display_phone_number": "+..."
            },
            "messages": [
              {
                "from": "+5491112345678",
                "id": "...",
                "timestamp": "1234567890",
                "type": "text",
                "text": {
                  "body": "¿Cuál es un try?"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### Response
```json
{
  "status": "received"
}
```

**Validación**:
- Signature verification (Kapso webhook secret)
- Rate limit: 100 req/s per user_id

---

## Internal Endpoints

### POST `/api/chat`

**Procesa** una consulta de coach, genera respuesta con Claude.

#### Request
```json
{
  "user_id": "uuid",
  "conversation_id": "uuid",
  "message": "¿Cómo hago un drill de pase rápido?",
  "media_url": "https://..." (optional)
}
```

#### Response
```json
{
  "status": "success",
  "response": "Un drill de pase rápido es...",
  "latency_ms": 1200,
  "tokens_used": 345,
  "cached_tokens": 2000,
  "conversation_id": "uuid"
}
```

**Errores**:
- `400 Bad Request`: missing fields
- `401 Unauthorized`: invalid user_id
- `500 Internal Server Error`: LLM failure (fallback message sent to user)

---

### GET `/api/health`

**Verifica** que el servicio está UP.

#### Response
```json
{
  "status": "ok",
  "timestamp": "2026-06-19T...",
  "db": "connected",
  "llm": "ok",
  "cache_hit_rate": 0.78
}
```

---

## Admin Endpoints (future)

### POST `/admin/corpus/ingest`

(Post-MVP) Upload and ingest documents.

### GET `/admin/conversations`

(Post-MVP) List recent conversations (redacted).

### GET `/admin/analytics`

(Post-MVP) Top questions, active coaches, latency trends.

---

## Error Codes

| Code | Meaning | User Message |
|------|---------|--------------|
| 400 | Bad request | "No entendí, probá de nuevo" |
| 401 | Auth fail | "Usuario no autorizado" |
| 429 | Rate limited | "Espera un poco y volvé a intentar" |
| 500 | Server error | "Algo salió mal, contactá al admin" |
| 503 | LLM down | "Estoy medio dormida, probá en un rato" |

---

## Security

- All endpoints over HTTPS
- Webhook signature verification (HMAC)
- API keys stored in .env, never logged
- Message content never logged in Sentry
- Conversations auto-deleted after 30 days

