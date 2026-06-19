# Carditos — Especificación de Producto

## 1. Visión

Agente conversacional sobre WhatsApp para el **Club San Andrés**, destinado a entrenadores de rugby de infantiles y juveniles. Responde consultas sobre modalidades de juego, reglamento, manejo de chicos y ejercicios, a partir de un corpus de documentos del club.

**Tono = producto.** Carditos debe sentirse como un colega entrenador experimentado: directo, práctico, sin vueltas. No genérico, no académico.

## 2. Actores

- **Coach (Entrenador)**: usuario principal. Entrena infantiles o juveniles en el Club San Andrés. Accede por WhatsApp.
- **Admin**: gestor del corpus y configuration del bot (interno, no en MVP).
- **Club San Andrés**: propietario del conocimiento y datos.

## 3. Scope MVP

### Habilitado
- Consultas sobre **modalidades de juego** (7s, 10s, 15s, touch, etc.)
- Consultas sobre **reglamento** (reglas UAR, adaptaciones por categoría)
- Consultas sobre **manejo grupal** de chicos (psicología, motivación, disciplina)
- Consultas sobre **ejercicios y drills** (técnica, táctica, acondicionamiento)
- **Idioma**: español rioplatense
- **Canal**: WhatsApp (texto y audio a futuro)

### Fuera de Scope
- Gestión de jugadores (fichas, asistencia)
- Análisis de videos
- Reporte de lesiones
- Integración con terceros (Google Calendar, Zoom, etc.)
- Multiidioma
- Web o app nativa

## 4. Éxito del Piloto

**Métrica**: 10 entrenadores activos usando Carditos ≥ 1 vez/semana durante 1 mes.

## 5. Flujo Principal

```
Coach envía consulta por WhatsApp
    ↓
Kapso recibe y enruta a backend
    ↓
Backend retrieves contexto del corpus (embeddings)
    ↓
Claude genera respuesta (prompt + cached system + context)
    ↓
Respuesta vuelve por WhatsApp
```

## 6. Corpus

- Documentos internos del Club San Andrés (presentaciones, charlas, reglamentos)
- Videos transcritos de entrenamientos
- Guías de modalidades por categoría
- Reglas UAR adaptadas

**Privacidad**: nunca exponer contenido del corpus en logs o errores públicos.

## 7. Restricted

- Almacenar mensajes de usuarios (solo conversación en sesión)
- Vender datos
- Compartir corpus fuera del club
