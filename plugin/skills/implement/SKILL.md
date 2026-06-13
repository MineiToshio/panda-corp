---
description: Ejecuta los work orders de un proyecto Pandacorp con un equipo de agentes (Agent Teams) que se comunican y se pasan el trabajo, con TDD y revisión. Usar dentro del proyecto después de /pandacorp:work-orders, o para retomar la implementación.
---

# /pandacorp:implement

Loop de implementación con Agent Teams. Se ejecuta EN el proyecto. `$ARGUMENTS` opcional: work orders específicos; sin argumentos, continúa desde el primer `pendiente`.

## Preparación del equipo (una vez por sesión)

1. **Habilitar Agent Teams**: requiere `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` en el `settings.json` del proyecto (la plantilla del scaffold ya lo trae). Si no está, avisar a Sergio para activarlo.
2. **Composición según stack** (DR-013):
   - Stack A (web): equipo de **backend-dev + frontend-dev + test-writer**, con el reviewer al cerrar.
   - Stack B/C/D (API/scraper): equipo de **backend-dev + test-writer** (sin frontend).
3. **Tamaño y modelos** (DR-014, diseñar para Max 5x): máximo 3 agentes simultáneos; líder (esta sesión) en opus, obreros en sonnet/haiku. Si Sergio está construyendo la propia fábrica, puede usar equipos mayores.

## Loop por work order

1. **Selecciona** el siguiente work order según `docs/work-orders/README.md` (respeta dependencias). Créalo como tarea del equipo y márcalo `en-progreso`.
2. **Reparte con dependencias** (mensajes entre agentes + task list compartida):
   - `backend-dev`: implementa datos/lógica/API con TDD; publica el contrato en `docs/api.md` y avisa al frontend.
   - `frontend-dev`: arranca cuando el contrato está listo; implementa UI con design tokens; avisa a test-writer al terminar una pantalla.
   - `test-writer`: escribe/corre tests de aceptación (RED antes de implementar; e2e de los flujos al cerrar).
   - Cada agente escribe el contexto crítico a archivos, no solo a mensajes (Agent Teams es experimental, no hay resume).
3. **Review** (agente `reviewer`): verifica evidencia él mismo (corre tests/lint/typecheck) y revisa con sus 3 lentes. RECHAZADO → vuelve al agente responsable con los hallazgos (máx. 2 ciclos; al tercero, escala a Sergio).
4. **Cierra**: merge del feature branch, work order → `terminado` con evidencia, `docs/estado.yaml` actualizado.
5. **Hito**: al completar los work orders de un FRD, corre la suite e2e de ese FRD. Repite hasta agotar work orders.

> El cockpit (Mission Control) muestra en vivo este equipo: los eventos los emiten los hooks de la fábrica a `~/.claude/dashboard-events.ndjson`. No requiere acción del agente.

## Al terminar todos

- Suite completa + e2e en verde, `docs/estado.yaml` → `fase: release`.
- Resumen a Sergio: qué se construyó, evidencia, y siguiente paso `/pandacorp:release`.

## Reglas
- Nunca avanzar con tests rojos. Errores idénticos repetidos 3 veces = detenerse y escalar.
- Límites de cuota: si se topan rate limits, reducir el equipo (menos agentes en paralelo) y/o bajar modelos de obreros. No es un error del código.
- Si un work order revela que el blueprint/FRD estaba mal, documenta el conflicto, ajusta el documento fuente (ADR si es arquitectónico) y recién continúa.
- Para proyectos triviales o sin separación clara (un solo módulo), está bien usar un único agente `implementer` en vez de equipo.
