<!--
  TEMPLATE for .pandacorp/inbox/decisions.md — the owner-decision inbox. An agent APPENDS a decision
  point here whenever it hits something only the owner can decide (product scope, spending money,
  something irreversible) — it never decides on its own. The owner answers with /pandacorp:decide and
  the build reads the answer. Owner channel → body in Spanish. Each block is a decision card (CONV-20,
  factory/standards/conventions.md): the owner also gets it as chat text, never only here. Most recent on
  top; on resolution mark
  RESUELTO, or OBSOLETO if /pandacorp:decide's staleness check finds it no longer applies (don't
  delete either way — it's the history).

  No explicit id field needed — Mission Control and /pandacorp:decide both DERIVE a stable id from
  each "## YYYY-MM-DD ... — <title>" heading: <date>-<n>, n = 1-based count of headings sharing that
  EXACT date (pending + resolved both count, so an id never shifts). Just follow the heading shape
  below; the id falls out of it automatically.
-->

# Decisiones pendientes

> Puntos que **solo el owner** puede decidir (alcance de producto, gastar dinero, algo irreversible).
> El agente los anota aquí (no decide solo); el owner responde con `/pandacorp:decide <id>` (Mission
> Control muestra el comando ya armado, con la antigüedad de la decisión). Más reciente arriba. Al
> resolverse se marca **RESUELTO** (se respondió) u **OBSOLETO** (ya no aplica, el skill lo detectó y
> el owner confirmó que no hace falta responder) — ninguno de los dos se borra.

## YYYY-MM-DD — Título corto de la decisión
<!-- Decision card (CONV-20): the same three parts, with the same lettered options, the owner reads in the chat. Keep the existing field
     names: Mission Control and /pandacorp:decide read "Qué decidir", "Contexto", "Opciones" and
     "Recomendación". -->
- **Qué decidir:** la pregunta, en una frase.
- **Contexto / por qué:** UN párrafo puntual escrito para quien no sabe nada del tema: qué es la pieza y qué hace, cómo funciona hoy, por qué hay que decidir ahora, qué pasa si no se decide (y qué valor se aplicaría por defecto). Términos técnicos explicados la primera vez; cada cifra dice si es medida (fuente y fecha) o proyección.
- **Opciones:** A) … · B) … · C) …  <!-- one line, lettered short labels: /pandacorp:decide builds its picker from this -->
- **Detalle de alternativas:** una viñeta por letra (**A.**, **B.**…): qué se haría, qué se gana y qué se arriesga o cuesta (dinero, tiempo, reversibilidad); una opción puede llevar su propio contexto si lo necesita.
- **Recomendación (del agente):** «Recomendada: <letra>» (UNA), por qué, y qué haría cambiar de opinión.
- **Bloquea:** el WO/feature en espera (id), si aplica.
- **Estado:** PENDIENTE  <!-- → RESUELTO: <respuesta> (YYYY-MM-DD) | OBSOLETO: <motivo> (YYYY-MM-DD) -->
