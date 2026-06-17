---
title: "Autoaprendizaje"
group: concepts
order: 12
---

# Autoaprendizaje

La fábrica aprende de cada proyecto. Las lecciones duraderas — fixes que vale la pena recordar, veredictos de librerías, gotchas, patrones y anti-patrones — se cosechan, refinan y almacenan en `factory/memory/` para que los builds futuros sean más rápidos y fiables.

## El problema que resuelve

Sin memoria transversal, cada agente redescubre los mismos problemas en cada proyecto. Un error de tipado con Biome, un gotcha de gray-matter, un patrón de test que funciona — toda esa experiencia se evapora al cerrar la sesión. El autoaprendizaje hace que la fábrica acumule know-how real entre proyectos.

## El flujo de aprendizaje (DR-047)

```
Trabajo en curso
     ↓
Agente captura candidato → .pandacorp/run/lessons.md (gitignoreado)
     ↓
Librarian cosecha + refina → factory/memory/ (candidato)
     ↓
Gate humano (propietario aprueba) → lesson promovida
     ↓
/pandacorp:learn → estándar / regla / skill (si procede)
```

### 1. Captura (cualquier agente)

Cuando un agente encuentra algo durable — un bug resuelto, una librería que funcionó o falló, un patrón, un anti-patrón — anota una línea candidata en `.pandacorp/run/lessons.md` (gitignoreado). No la pule: solo la captura con una etiqueta `(agent-inferred)` o `(owner-stated)`.

### 2. Cosecha (librarian)

El agente `librarian`, invocado con `/pandacorp:memory`, recoge el inbox, deduplica, refina y crea o actualiza entradas en `factory/memory/LESSON-NNNN-<slug>.md`. Las lecciones empiezan como `status: candidate`.

### 3. Gate humano

El propietario revisa las lecciones candidatas. Solo él las promueve a `status: active`. Ninguna lección se aplica en builds futuros hasta que esté activa.

### 4. Aplicación en builds futuros

Al inicio de cada work order, el implementer consulta la memoria por dominio/tags. Si hay lecciones activas relevantes, las aplica y las cita (`LESSON-NNNN`). Esto es lo que diferencia el build 10 del build 1.

### 5. Promoción a estándar o regla

Si una lección activa es suficientemente general y recurrente, `/pandacorp:learn` la puede promover a:

- Un nuevo estándar en `factory/standards/`.
- Una nueva regla en `factory/decisions/registry.yaml`.
- Una nueva habilidad en el plugin.

El propietario es el gate final en cada promoción.

## Qué NO es autoaprendizaje

- **No es reflexión sobre reflexiones** — las lecciones deben estar ancladas en evidencia concreta (un bug real, un diff, un fallo de test), no en lo que el agente "cree que aprendió" (LESSON-0001, anti-patrón).
- **No es automático** — ninguna lección se promueve sin gate humano.
- **No es memoria de conversación** — no se almacenan conversaciones completas, solo lecciones atómicas y falsificables.

## En Mission Control

La sección **Configuración** muestra los estándares activos. La sección **Manual** (esta página) se mantiene en sync con el estado real de la fábrica: si se añade un estándar o una regla, la Referencia lo refleja automáticamente en el próximo render (DR-046).
