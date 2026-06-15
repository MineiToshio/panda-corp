---
description: Agrega una funcionalidad o un cambio a un proyecto Pandacorp en cualquier momento (en construcción o lanzado). Describe el cambio y el PM decide el alcance mínimo (un work order, un FRD nuevo, o un mini paso de diseño) y lo mete a la cola de construcción. Es el mecanismo de iteración del día a día.
---

# /pandacorp:iterate

Mecanismo de iteración continua. Se ejecuta EN el proyecto. `$ARGUMENTS` (o la conversación): qué quieres agregar/cambiar (un FRD nuevo, un ajuste como "ordenar la lista", un fix).

## Pasos

1. **Entiende el cambio** y su contexto (lee PRD, FRDs y estado actual). Si es ambiguo, pregunta lo mínimo.
2. **Triage de impacto (el PM/architect decide el tamaño Y si hay que parar la construcción).** Lo que pide el dueño es de alto nivel; tu trabajo es decidir qué documentación cambiar/crear y avisarle en qué caso cae:
   - **Ajuste chico / fix** → un work order nuevo, sin tocar documentación de producto. **No hace falta parar**: se encola y `implement` lo toma en su próxima vuelta.
   - **Funcionalidad / módulo nuevo** → mini-pipeline acotado: **delega investigación al `researcher`** (investiga a fondo si es un módulo nuevo), el `product-manager` escribe el **FRD nuevo** (`docs/frds/frd-NN-…`, numeración continúa), el `architect` ajusta el **blueprint** (+ ADR), y se generan los **work orders**. Si trae UI nueva, un mini paso de diseño (`/pandacorp:design` acotado, mismos design tokens).
   - **Cambio fundamental** (arquitectura, motor de BD, modelo de datos — impacta lo ya construido) → **muéstrale al dueño el radio de impacto ANTES de tocar nada**: qué FRDs/work orders se afectan, qué hay que rehacer/migrar, costo aproximado. Si confirma: **ADR que reemplaza al anterior** + ajuste del blueprint + re-planificación de work orders, y **pide pausar la construcción** marcando `replanteo_pendiente: true` en `docs/status.yaml` (el `implement` en curso se detiene solo en su próximo punto seguro — no hay que matar la conversación a mano).
3. **Encola y construye**: agrega los work orders al backlog (`docs/work-orders/`) y entra al loop de `/pandacorp:implement` (que limpia `replanteo_pendiente` al reanudar con el plan nuevo). Si el proyecto estaba `lanzada`, vuelve a `en-construccion` mientras se trabaja; al terminar, `/pandacorp:release` (que sube la versión automáticamente).
4. Regresión: los tests existentes deben seguir verdes. **Todo fix registra el bug en `docs/progress.md` y añade un test de regresión** anclado en él (alimenta el banco de tests adversariales del reviewer — DR-015). Actualiza `docs/status.yaml`.

## Reglas
- **Tres canales para hablarle a una construcción en curso** (los tres se comunican por archivos; `implement` los revisa en cada punto seguro): `/pandacorp:bug` (algo roto → bandeja `docs/bugs/`), `/pandacorp:iterate` (cambio o módulo → este skill triagea), `/pandacorp:decide` (responder algo que la IA preguntó). Si lo que pide el dueño es en realidad un bug o una respuesta, redirígelo.
- NO requiere crear una "versión" formal: las versiones (v2, v3…) son etiquetas automáticas que pone `release` desde los conventional commits. Para agrupar un lote grande en un hito formal con su propio mini-PRD, usar `/pandacorp:new-version`.
- Mantén el scope acotado a lo pedido (DR-012). No aproveches para reescribir de más.
- Conventional commits en inglés, feature branch.
