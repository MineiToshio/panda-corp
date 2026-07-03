---
title: "Autoaprendizaje"
group: concepts
order: 12
---

# Autoaprendizaje

La fábrica aprende de cada proyecto. Las lecciones duraderas — fixes que vale la pena recordar, veredictos de librerías, gotchas, patrones y anti-patrones — se cosechan, refinan y almacenan en `factory/memory/` para que los builds futuros sean más rápidos y fiables. Desde el **loop v2** (propuesta 23, 2026-07-02) el ciclo gira solo: la cosecha corre automáticamente al cierre de cada build, un barrido diario drena los inboxes, y el uso de cada lección se mide con un script — no con la palabra del agente.

## El problema que resuelve

Sin memoria transversal, cada agente redescubre los mismos problemas en cada proyecto. Un error de tipado con Biome, un gotcha de gray-matter, un patrón de test que funciona — toda esa experiencia se evapora al cerrar la sesión. El autoaprendizaje hace que la fábrica acumule know-how real entre proyectos. Y la v2 cierra los tres huecos que la auditoría de 2026-07-02 midió: el loop no giraba solo (cero jobs), la recuperación nunca ocurrió (`times_applied: 0` en todo el store) y nada validaba que una lección fuera verdad y no superstición.

## El flujo de aprendizaje (DR-047, loop v2)

```
Trabajo en curso
     ↓
Captura always-on → .pandacorp/run/lessons.md (proyecto) / _inbox.md (fábrica)
  (+ un hook de Stop pregunta una vez por sesión: "¿te corrigieron? ¿algo falló y se arregló?")
     ↓
Cosecha AUTOMÁTICA → al close-out de cada build (obligatoria, con stamp last_harvest)
  y barrido diario con umbrales (≥20 notas o ≥7 días o cosecha huérfana)
     ↓
Librarian refina (default-reject: sin evidencia concreta → descarte) → candidate
     ↓
Eval-gate: candidate → active SOLO con corroboración de OTRO build
  (o provenance owner-stated / ci-verified)
     ↓
Recuperación en builds: INDEX.md (1 línea/lección activa + su trigger "úsala cuando…")
  → el agente cita LESSON-NNNN en el artefacto que escribe
  → count-lesson-citations.sh cuenta las citas (times_applied/applied_in, determinista)
     ↓
Escalador: ≥3 proyectos citaron la lección → promotion: proposed (cola durable)
     ↓
/pandacorp:learn + gate del dueño → estándar / regla / skill
  (tier medio: un SHOULD con verificador determinista se aplica solo, notificando)
```

### 1. Captura (cualquier agente, siempre encendida)

Cuando un agente encuentra algo durable — un bug resuelto, una librería que funcionó o falló, un patrón, un anti-patrón — anota una línea candidata en el inbox crudo (gitignoreado), con etiqueta `(agent-inferred)` o `(owner-stated)`. Además, un **hook de Stop** (una vez por sesión, solo en contextos Pandacorp) obliga al agente a preguntarse antes de terminar si hubo una corrección del dueño o un fallo-y-fix sin anotar — el patrón Devin/CodeRabbit: *la corrección es el evento de captura*.

### 2. Cosecha (librarian, automática)

Dos motores, ninguno depende de la memoria del dueño: el **close-out de `/pandacorp:implement`** corre la cosecha como paso obligatorio (y estampa `last_harvest` en `status.yaml` — sin stamp el cierre está incompleto), y el **barrido diario programado** drena los inboxes cuando hay trabajo (umbral: ≥20 notas o ≥7 días o un proyecto en release sin cosechar), en silencio si no hay nada. El librarian aplica **default-reject** (sin ancla de evidencia → descarte), ruteo DR-103 (defecto accionable → backlog, no memoria), dedup A.U.D.N. y destila las lecciones de fracaso **por contraste** (el diff entre el intento fallido y el fix). Un item ya filed en `factory/backlog/` se trabaja con **`/pandacorp:implement-backlog`** — un id resuelve solo ese item; sin argumento drena toda la cola abierta/en curso, un subagente por item (tier de modelo por CONV-12/DR-111), fusionados de a uno.

### 3. Validez (eval-gate anti-superstición)

Una candidata pasa a `active` solo si la corrobora **un build distinto** del que la produjo, o si su provenance es `owner-stated`/`ci-verified`. Una lección auto-inferida de una sola trayectoria jamás se auto-activa (la literatura lo midió: un store contaminado al 10% degrada el rendimiento del agente — un store chico y limpio vale más que uno grande y ruidoso).

### 4. Recuperación medida (lo que diferencia el build 10 del build 1)

Antes de trabajo no trivial, cada agente builder lee **`factory/memory/INDEX.md`** — una línea por lección activa con su **trigger** ("úsala cuando…") — y abre las lecciones que aplican. Si una lección informó su trabajo, la **cita** (`LESSON-NNNN`) en el artefacto durable que ya escribe (blueprint, ADR, review, Status Note). Al cierre, `count-lesson-citations.sh` cuenta esas citas y actualiza `times_applied`/`applied_in` **determinísticamente** — los contadores nunca se editan a mano. La poda por "nunca usada" está **congelada** hasta que haya medición real de ≥3 proyectos.

### 5. Promoción a estándar, regla o skill

Cuando ≥3 proyectos citan una lección, el script la auto-encola (`promotion: proposed`). El buzón de **Propuestas** (FRD-17) la muestra y `/pandacorp:learn` la aplica con gate tierado (DR-047): un `SHOULD` con verificador determinista puede aplicarse solo (notificando al dueño); un `MUST`, una regla o un skill siempre esperan el gate humano. Tras promover: back-link a la lección y `promotion: approved`/`rejected` — la lección nunca se borra.

## Qué NO es autoaprendizaje

- **No es reflexión sobre reflexiones** — las lecciones se anclan en evidencia concreta (un bug real, un diff, un fallo de test), no en lo que el agente "cree que aprendió" (LESSON-0001, anti-patrón). El único paso sintético permitido — el pase de reflexión que agrupa ≥3 lecciones de un mismo dominio en un patrón — sintetiza desde lecciones ancladas, jamás desde otras reflexiones.
- **No es confianza en el agente** — el uso se mide con citas contadas por script, la validez exige corroboración cruzada, y los verificadores son deterministas.
- **No es memoria de conversación** — no se almacenan conversaciones completas, solo lecciones atómicas y falsificables.
- **No es promoción sin gate** — solo el tier medio (SHOULD + verificador) se aplica solo, y siempre notificando; todo lo demás espera al dueño.

## En Mission Control

El buzón de **Propuestas** (FRD-17) lista la cola de promociones (`promotion: proposed`) y el panel **memory-health** muestra la salud del loop: notas pendientes, días desde el último barrido, proyectos con cosecha huérfana. La sección **Configuración** muestra los estándares activos, y la **Referencia** del Manual refleja automáticamente skills/reglas nuevas en el próximo render (DR-046).
