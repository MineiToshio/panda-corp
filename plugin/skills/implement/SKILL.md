---
description: Ejecuta los work orders de un proyecto Pandacorp con TDD y revisión por agente - el loop de implementación. Usar dentro del proyecto después de /pandacorp:work-orders, o para retomar la implementación donde quedó.
---

# /pandacorp:implement

Loop de implementación. Se ejecuta EN el proyecto. `$ARGUMENTS` opcional: número(s) de work order específicos; sin argumentos, continúa desde el primer `pendiente`.

## Loop por work order

1. **Selecciona** el siguiente work order según `docs/work-orders/README.md` (respeta dependencias). Márcalo `en-progreso`.
2. **RED** (agente `test-writer`): tests desde los criterios de aceptación del work order. Deben fallar.
3. **GREEN+REFACTOR** (agente `implementer`): implementa siguiendo su checklist (feature branch, TDD, tokens de diseño, conventional commits). Si usas worktrees para paralelizar work orders independientes, máximo 2-3 a la vez.
4. **Review** (agente `reviewer`): verifica evidencia él mismo (corre tests/lint/typecheck) y revisa con sus 3 lentes. RECHAZADO → vuelve al `implementer` con los hallazgos (máximo 2 ciclos; al tercero, escala a Sergio con el detalle).
5. **Cierra**: merge del feature branch, work order → `terminado` con evidencia, `docs/estado.yaml` actualizado (resumen de avance).
6. **Hito**: al completar todos los work orders de un FRD, corre la suite e2e de los flujos de ese FRD. Repite el loop hasta agotar work orders.

## Al terminar todos

- Suite completa + e2e en verde, `docs/estado.yaml` → `fase: release`.
- Resumen a Sergio: qué se construyó, evidencia (tests/screenshots), y siguiente paso `/pandacorp:release`.

## Reglas
- Nunca avanzar con tests rojos "para volver después".
- Errores idénticos repetidos 3 veces = detenerse y escalar, no loopear.
- Si un work order revela que el blueprint/FRD estaba mal, NO improvises: documenta el conflicto, ajusta el documento fuente (ADR si es arquitectónico) y recién entonces continúa.
