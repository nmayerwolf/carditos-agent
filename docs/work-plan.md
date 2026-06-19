# Work Plan — Carditos MVP

## Timeline

**Objetivo**: MVP en producción con 10 coaches piloto en 8 semanas.

---

## Phase 1: Foundation (Week 1–2)

### Goals
- Setup infra (Supabase, Railway, API keys)
- DB schema + migrations
- Skeleton backend (Express + TypeScript)
- CI/CD pipeline (ESLint, Prettier, tsc)

### User Stories
- None (infrastructure)

### Deliverables
- [ ] Supabase project + pgvector
- [ ] Railway app connected
- [ ] GitHub CI passing
- [ ] `src/server.ts` + routes scaffold
- [ ] `npm run dev` works
- [ ] `npm run build` works
- [ ] `/api/health` endpoint

### DoD
- All tests pass
- No linting errors
- Environment setup doc complete

---

## Phase 2: WhatsApp Integration (Week 3)

### Goals
- Kapso webhook receiving messages
- Message flow → DB storage
- Outbound message sending

### User Stories
- None (integration)

### Deliverables
- [ ] POST `/webhooks/whatsapp` implemented
- [ ] Webhook signature verification
- [ ] Messages stored in `messages` table
- [ ] Outbound message via Kapso works
- [ ] Rate limiting in place
- [ ] Error handling + Sentry logging

### DoD
- Manual testing with test phone
- Latency <500ms for webhook
- No message content in Sentry

---

## Phase 3: Corpus Ingest (Week 4)

### Goals
- Ingest corpus documents
- Generate embeddings (OpenAI)
- Store in pgvector

### User Stories
- None (infrastructure)

### Deliverables
- [ ] `scripts/ingest-knowledge.ts` script
- [ ] Document chunking logic
- [ ] OpenAI embeddings call
- [ ] Store in `corpus_embeddings` table
- [ ] Test data ingested (sample docs)
- [ ] Similarity search tested

### DoD
- Test ingest with 5+ sample docs
- Vector search latency <100ms
- Chunk size optimized for Claude tokens

---

## Phase 4: Claude Integration (Week 5)

### Goals
- Implement RAG (retrieval → context → LLM)
- Prompt caching for corpus
- System prompt in Spanish

### User Stories
- None (infrastructure)

### Deliverables
- [ ] `services/claude.ts` + prompt caching
- [ ] `services/retrieval.ts` (similarity search)
- [ ] `services/orchestrator.ts` (RAG flow)
- [ ] System prompt: `prompts/system-carditos.md`
- [ ] Latency <3s (p95)
- [ ] Token usage logged

### DoD
- Test with 10+ queries
- Cache hit rate >70%
- Spanish tone verified manually
- No corpus exposed in logs

---

## Phase 5: MVP Features (Week 6)

### Goals
- Implement US-001 to US-005
- Conversation context management
- Error handling for out-of-scope

### User Stories
- **US-001**: Reglamento queries
- **US-002**: Ejercicios queries
- **US-003**: Manejo grupal queries
- **US-004**: Conversation history
- **US-005**: Graceful errors

### Deliverables
- [ ] All 5 user stories pass acceptance criteria
- [ ] Conversation TTL (24h)
- [ ] Max 10 messages in context
- [ ] Out-of-scope detection working
- [ ] Manual testing with coaches (3+)

### DoD
- All tests pass
- Coaches approve tone
- Edge cases handled

---

## Phase 6: QA & Polish (Week 7)

### Goals
- Security review
- Performance testing
- Documentation complete

### Deliverables
- [ ] Security review (no secrets exposed)
- [ ] Load testing (100 req/s)
- [ ] Documentation: all `docs/` files finalized
- [ ] README.md complete
- [ ] CONTRIBUTING.md guide
- [ ] Runbook for ops

### DoD
- All docs passing spellcheck
- No secrets in code
- Performance within SLA

---

## Phase 7: Pilot Launch (Week 8)

### Goals
- Onboard 10 coaches
- Monitor in production
- Collect feedback

### Deliverables
- [ ] Coaches receive WhatsApp intro
- [ ] Monitoring alerts set up (Sentry + custom)
- [ ] Onboarding guide sent
- [ ] Daily metrics report (Slack)

### DoD
- 10 coaches active (at least 1 msg each)
- 0 critical errors in first 48h
- Feedback collected

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Corpus not ready | High | Start with sample docs, plan ingest with founder early |
| LLM latency >3s | High | Prompt caching tuning, batch test early |
| Webhook rate limits | Medium | Implement queue if needed, monitor |
| Coach adoption | High | Soft launch with 2–3 allies, collect feedback loops |
| Data privacy issues | High | No message logging, privacy audit week 6 |

---

## Success Metrics

- ✅ 10 coaches active ≥1x/week for 1 month
- ✅ Latency p95 <3s
- ✅ Cache hit rate >70%
- ✅ Zero security incidents
- ✅ NPS >7 from pilot coaches

