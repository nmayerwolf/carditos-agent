# Carditos — Guía para agentes

Este archivo es el primer contexto que cualquier agente (Claude Code, Cursor, Codex, etc.) debe leer al entrar al repo.

`AGENTS.md` es un symlink a este mismo archivo: una sola fuente de verdad.

---

## 1. Qué es Carditos en una línea

Agente conversacional sobre **WhatsApp** para el **Club San Andrés**, destinado a entrenadores de rugby de infantiles y juveniles. Responde consultas sobre modalidades de juego, reglamento, manejo de chicos y ejercicios, a partir de un corpus de documentos del club.

> **Tono = producto.** Carditos debe sentirse como un colega entrenador experimentado: directo, práctico, sin vueltas. No genérico, no académico, no sycophantic.

---

## 2. Scope del MVP

- **Único actor**: entrenadores (coaches) de infantiles y juveniles del Club San Andrés.
- **Temas habilitados**: modalidades de juego, reglamento, manejo grupal de chicos, ejercicios y drills.
- **Canales**: WhatsApp (texto y audio).
- **Idioma**: español rioplatense.
- **Output principal**: respuestas conversacionales basadas en el corpus del club.
- **Éxito del piloto**: 10 entrenadores usándolo ≥ 1 vez/semana durante 1 mes.

Todo lo que no esté en los user stories está **fuera de scope** hasta nuevo aviso.

---

## 3. Stack (decidido, no re-debatir)

| Capa | Elección |
|------|----------|
| WhatsApp gateway | Kapso (BSP) — proxy de Meta API en `api.kapso.ai/meta/whatsapp/v24.0` |
| LLM | Anthropic Claude Sonnet (último disponible) + **prompt caching obligatorio** |
| Embeddings | OpenAI `text-embedding-3-small` (ingest del corpus) |
| Backend | Node.js + Express + TypeScript |
| Hosting | Railway (Hobby) |
| DB | Supabase Postgres Pro |
| Vectores | `pgvector` en la misma Supabase |
| Errores | Sentry free |
| Source control | GitHub privado |
| IDE | Visual Studio Code |

---

## 4. Documentación canónica (a crear)

- `docs/carditos-spec.md` — visión completa, actores, flows, scope del MVP.
- `docs/user-stories.md` — US-001 a US-0XX, acceptance criteria y DoD.
- `docs/stack.md` — stack, costos, scale triggers.
- `docs/data-model.md` — entidades, índices, seeds.
- `docs/api-contract.md` — webhooks WhatsApp + endpoints admin.
- `docs/environment-setup.md` — cuentas, env vars, deploy.
- `docs/work-plan.md` — plan de trabajo del MVP en fases.

---

## 5. Convenciones de desarrollo

- **Branching**: una rama por issue, contra `main`. Nombrado: `feat/us-003-slug`, `fix/<slug>`, `chore/<slug>`.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- **Merge**: squash merge a `main`.
- **PR**: linkea el issue (`Closes #N`), pasa CI (lint + format + typecheck).
- **CI obligatorio**: ESLint + Prettier + `tsc --noEmit`.
- **No commitear**: `.env`, secretos, documentos del corpus sin permiso del founder.

---

## 6. Estructura del repo

```
carditos/
├── src/
│   ├── server.ts
│   ├── routes/            # webhooks.ts, admin.ts
│   ├── services/          # whatsapp.ts, claude.ts, retrieval.ts, conversations.ts, orchestrator.ts
│   ├── prompts/           # system-carditos.md
│   ├── db/                # client.ts + migrations/
│   └── lib/               # logger, errors, rateLimiter, etc.
├── scripts/               # ingest-knowledge.ts, seed-users.ts
├── content/rugby-knowledge/   # corpus del club (no commitear sin permiso)
├── docs/                  # docs canónicos
├── .github/               # plantillas + workflows CI
├── CLAUDE.md  AGENTS.md
├── CONTRIBUTING.md
└── README.md
```

---

## 7. Reglas de oro para el agente

1. **Lee antes de escribir.** Si una pregunta ya tiene respuesta en `docs/`, citá el archivo y la sección.
2. **No agregues actores ni features fuera del MVP** sin que el founder lo pida.
3. **Tono primero.** Cualquier output orientado a Carditos tiene que sonar a colega rugbier, no a bot.
4. **Prompt caching no es opcional.** Toda llamada a Claude usa `cache_control` sobre el system prompt + corpus retrieved.
5. **Privacidad**: nunca loguear contenido de mensajes en Sentry, nunca exponer cuerpos de mensajes en endpoints admin.
6. **Confirmá antes de tocar GitHub remoto** (issues, labels, PRs, releases).

---

## 8. Glosario rápido (rugby)

- **Infantiles**: categorías sub-8 a sub-14 aproximadamente.
- **Juveniles**: categorías sub-16 a sub-18 aproximadamente.
- **Coach / Entrenador**: el actor principal del sistema.
- **Drill**: ejercicio específico de entrenamiento.
- **Modalidad de juego**: formato de partido según categoría (7s, 10s, 15s, touch, etc.).
- **UAR**: Unión Argentina de Rugby — fuente oficial de reglamento.
- **Corpus**: conjunto de documentos del club (presentaciones, charlas, reglamentos, videos transcritos) que nutren el conocimiento de Carditos.

---

*Creado: 2026-06-19. Basado en la arquitectura de Juampi BLIS Agent.*
