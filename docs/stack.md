# Stack — Carditos

## Componentes Decididos

| Capa | Solución | Razón | Costo (Hobby) |
|------|----------|-------|---------------|
| **WhatsApp Gateway** | Kapso | Proxy de Meta API, facil onboarding | ~$0–100/mo |
| **LLM** | Claude Sonnet (latest) | Mejor cost/quality, prompt caching | ~$50–150/mo |
| **Embeddings** | OpenAI `text-embedding-3-small` | Maduro, confiable | ~$10/mo |
| **Backend** | Node.js + Express + TS | Fast dev, ecosystem | $0 (código) |
| **Hosting** | Railway (Hobby) | Fácil deploy, pay-as-you-go | ~$5–20/mo |
| **Database** | Supabase Postgres Pro | pgvector + auth + realtime | ~$25/mo |
| **Vector Store** | pgvector (Supabase) | Same DB, no dependencies | (included) |
| **Error Tracking** | Sentry (free) | Essentials, alerting | $0 |
| **Source Control** | GitHub private | Std, CI/CD ready | $0 |
| **IDE** | VS Code | Std, extensions | $0 |

## Decisiones Clave

- **Prompt caching obligatorio**: corpus cacheable, latencia <3s
- **pgvector en Supabase**: una DB, menos infraestructura
- **Kapso over direct Meta API**: gestión de webhooks
- **No self-hosting**: Railway + Supabase simplifica ops

## Escalas y Triggers

| Métrica | Trigger | Acción |
|---------|---------|--------|
| Requests/día | >10k | Revisar caching efficiency, latency |
| Storage corpus | >500MB | Optimizar embeddings o chunking |
| Usuarios activos | >100 | Evaluar DB scaling (Supabase Pro → Business) |
| Latency p95 | >5s | Profile LLM calls, cache strategy |
| Cost/mes | >$500 | Revisar componentes, vendors |

## Diagrama (ASCII)

```
Coach (WhatsApp)
    ↓
Kapso (gateway)
    ↓
Railroad (Express backend)
    ├── Claude API (LLM + caching)
    ├── Supabase
    │   ├── Postgres (conversations, users)
    │   └── pgvector (embeddings + corpus)
    └── OpenAI (embeddings ingest)
    ↓
Sentry (errors)
```

## Migration Path (Post-MVP)

- Supabase Pro → Business si >100 usuarios
- Claude Sonnet → Opus si latency critical
- Railway → Fly.io o custom if cost-sensitive

