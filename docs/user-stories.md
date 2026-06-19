# User Stories — Carditos MVP

## US-001: Coach consulta sobre reglamento

**Como** entrenador  
**Quiero** preguntar sobre reglas específicas del rugby  
**Para** aclarar dudas en el momento con mis chicos

### Aceptación
- [ ] Coach envía texto a Carditos: "¿Cuándo se marca un try?"
- [ ] Carditos responde en <3s con info del corpus (regla, contexto, categoría aplicable)
- [ ] Respuesta es conversacional, no académica

### DoD
- Prompt caching funciona (corpus en cache)
- Latencia <3s (p95)
- No exponer fuentes en la respuesta

---

## US-002: Coach consulta sobre ejercicios

**Como** entrenador  
**Quiero** pedir ideas de drills para trabajar algo específico  
**Para** diseñar entrenamientos más efectivos

### Aceptación
- [ ] Coach: "Dame un drill para mejorar pase rápido en U14"
- [ ] Carditos devuelve: descripción, pasos, tiempo, variantes
- [ ] Contexto en el corpus (modalidades del club, categorías)

### DoD
- Respuestas > 50 tokens (detalladas)
- Incluir contexto de categoría
- Testing manual con 3+ coaches

---

## US-003: Coach consulta sobre manejo grupal

**Como** entrenador  
**Quiero** pedir consejos sobre cómo manejar situaciones con chicos  
**Para** mejorar el clima de entrenamiento

### Aceptación
- [ ] Coach: "Cómo motivo chicos que llegan cansados?"
- [ ] Carditos devuelve respuesta empática, directa, con ejemplo práctico

### DoD
- Tono de colega experimentado (no psicólogo)
- Referencias al contexto del club si aplica

---

## US-004: Historial de conversación

**Como** coach  
**Quiero** mantener contexto entre mensajes  
**Para** hacer preguntas de seguimiento sin repetir contexto

### Aceptación
- [ ] Coach: "¿Y si tengo un U10?" (seguimiento de US-002)
- [ ] Carditos entiende la pregunta anterior

### DoD
- Sesión persiste por 24h (o config)
- Max 10 mensajes en contexto
- Privacidad: sesiones no logueadas en Sentry

---

## US-005: Error graceful

**Como** coach  
**Quiero** recibir respuesta útil si Carditos no entiende  
**Para** no abandonar la herramienta

### Aceptación
- [ ] Coach: "Cómo hago pasta?" (fuera de scope)
- [ ] Carditos: "Eso no es mi tema, preguntame de rugby"

### DoD
- Out-of-scope detection (LLM o heurística)
- Mensaje amigable
- Fallback a "contacta a admin"

---

## Backlog (Post-MVP)

- US-006: Audio en WhatsApp
- US-007: Integración con Google Calendar (disponibilidad coaches)
- US-008: Panel admin para ingestar corpus nuevos
- US-009: Analytics (preguntas top, coaches activos)
- US-010: Notificaciones de actualizaciones del corpus

