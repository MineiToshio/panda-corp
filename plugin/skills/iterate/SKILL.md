---
description: Agrega una funcionalidad o un cambio a un proyecto Pandacorp en cualquier momento (en construcción o lanzado). Describe el cambio y el PM decide el alcance mínimo (un work order, un FRD nuevo, o un mini paso de diseño) y lo mete a la cola de construcción. Es el mecanismo de iteración del día a día.
---

# /pandacorp:iterate

Mecanismo de iteración continua. Se ejecuta EN el proyecto. `$ARGUMENTS` (o la conversación): qué quieres agregar/cambiar (un FRD nuevo, un ajuste como "ordenar la lista", un fix).

## Pasos

1. **Entiende el cambio** y su contexto (lee PRD, FRDs y estado actual). Si es ambiguo, pregunta lo mínimo.
2. **El `product-manager` decide el alcance mínimo**:
   - Cambio chico / fix → directamente un work order nuevo, sin tocar documentación de producto.
   - Funcionalidad nueva → crea un FRD nuevo (`docs/frds/frd-NN-…`, numeración continúa) + sus work orders. Si toca UI nueva, un mini paso de diseño (`/pandacorp:design` acotado a lo nuevo, mismos design tokens).
   - Cambio arquitectónico → ADR + ajuste del blueprint antes de los work orders.
3. **Encola y construye**: agrega los work orders al backlog (`docs/work-orders/`) y entra al loop de `/pandacorp:implement`. Si el proyecto estaba `lanzada`, vuelve a `en-construccion` mientras se trabaja; al terminar, `/pandacorp:release` (que sube la versión automáticamente).
4. Regresión: los tests existentes deben seguir verdes. Actualiza `docs/estado.yaml`.

## Reglas
- NO requiere crear una "versión" formal: las versiones (v2, v3…) son etiquetas automáticas que pone `release` desde los conventional commits. Para agrupar un lote grande en un hito formal con su propio mini-PRD, usar `/pandacorp:new-version`.
- Mantén el scope acotado a lo pedido (DR-012). No aproveches para reescribir de más.
- Conventional commits en inglés, feature branch.
