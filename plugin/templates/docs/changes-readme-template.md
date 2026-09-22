<!--
  TEMPLATE for .pandacorp/inbox/changes/README.md — the change-queue index. A row is appended by
  /pandacorp:change and /pandacorp:bug each time a card is filed. The build drains `ready` items
  (expedite first, then standard FIFO), SKIPS `draft`, and marks `done` on landing (DR-069).
  `closing` is set by /pandacorp:sync's close-out mode while it batch-closes an already-implemented
  card (proposal 37 §A.6): a `closing` row older than 48h is a doc-lint RED, not a status to ignore.
  Owner channel → body in Spanish. One card per file (see change-request-template.md).
-->

# Cola de cambios

> Índice de las change-cards de esta carpeta. El build drena los `ready` (expedite primero, luego
> standard FIFO), **salta los `draft`** y marca `done` al integrarlos (DR-069). `closing` = cierre en
> lote de `/pandacorp:sync` en curso; si lleva más de 48h así, el gate lo marca en rojo. Una card por
> archivo.

| Card | Tipo | Clase | Estado |
|---|---|---|---|
| `<slug>.md` | bug \| feature \| change | expedite \| standard | ready \| draft \| closing \| done |
