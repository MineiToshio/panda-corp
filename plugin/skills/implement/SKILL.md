---
description: Arranca y ejecuta la construcción de un proyecto Pandacorp con un equipo de agentes (Agent Teams) que se comunican y se pasan el trabajo, con TDD y revisión. Corre todos los work orders hasta terminar, y se sigue en vivo desde Mission Control. Usar dentro del proyecto después de /pandacorp:blueprint. Es el paso arquitectura → en construcción.
---

# /pandacorp:implement

**Este es el comando que arranca (y reanuda) la construcción.** Dispara el equipo de agentes, reparte los work orders y avanza hasta terminar; lo sigues en vivo en Mission Control. Se ejecuta EN el proyecto. Al arrancar, marca `docs/estado.yaml → fase: implementacion`, `running: true` (la idea pasa a «en construcción»); al detenerse/terminar, `running: false`.

`$ARGUMENTS` opcional: un **modo** (`pro` | `potente` | `profundo`) y/o work orders específicos. Sin argumentos: modo equilibrado, construye desde el primer work order pendiente.

## Modos de ejecución (control de consumo/calidad)

- **pro** (`/pandacorp:implement pro`): para plan Pro / mínimo consumo. Un solo obrero a la vez (sin paralelismo), modelos económicos (sonnet/haiku). El más lento pero el más barato.
- **equilibrado** (default): pensado para Max 5x. Equipo ≤3 agentes; líder en opus, obreros en sonnet/haiku.
- **potente** (`/pandacorp:implement potente`): para Max 20x. Más agentes en paralelo (hasta 5) → avanza más rápido. Úsalo cuando quieras terminar antes y tu plan lo permita.
- **profundo** (`/pandacorp:implement profundo`): máxima calidad. Todos los agentes en el mejor modelo (opus), revisión adversarial extra y verificación más estricta. Más lento y más caro — para un proyecto al que le tienes cariño especial o cuando algo no está saliendo bien.

## Reanudable (no empezar de cero)

Si la conversación se corta o te quedas sin tokens, **vuelve a correr `/pandacorp:implement`**: lee el estado de `docs/work-orders/` y `docs/estado.yaml` y continúa desde el primer pendiente. Cada work order se comitea al cerrarse → el avance no se pierde.

## Preparación del equipo (una vez por sesión)

1. **Habilitar Agent Teams**: requiere `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` en el `settings.json` del proyecto (la plantilla del scaffold ya lo trae). Si no está, avisar a Sergio para activarlo.
2. **Composición según stack** (DR-013):
   - Stack A (web): equipo de **backend-dev + frontend-dev + test-writer**, con el reviewer al cerrar.
   - Stack B/C/D (API/scraper): equipo de **backend-dev + test-writer** (sin frontend).
   - **Sin investigador fijo en el equipo**: backend-dev y frontend-dev llaman al `researcher` a demanda cuando les falta algo. La investigación de fondo ya se hizo en spec (producto) y blueprint (técnico).
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

## Documentación en tiempo real (clave para reanudar y para el cockpit)

Mientras se construye, mantener SIEMPRE actualizado (el cockpit lo lee en vivo):
- **`docs/work-orders/`**: estado de cada work order (`todo` → `progress` → `review` → `done`) con evidencia al cerrar. Es la vista de solo-lectura del cockpit.
- **`docs/estado.yaml`**: `progreso:` (una línea de qué se está haciendo ahora), `running`, work orders hechos/total.
- **`docs/progreso.md`**: bitácora append-only (qué se hizo, decisiones tomadas, problemas). Permite retomar sin contexto previo.
- **Desviaciones**: si algo NO funciona como se planeó, documéntalo en el work order y en `docs/progreso.md` ("esto hay que mejorar / cambiamos X porque Y"). No lo escondas.

## Puntos de decisión (escalado a Sergio, visible en el cockpit)

Cuando aparezca algo que no estaba resuelto: **primero investiga** (delega al `researcher`) y, si con eso puedes tomar la decisión coherente tú mismo, hazlo y documéntalo en `docs/progreso.md`. **Solo escala a Sergio las decisiones genuinamente humanas**: scope de producto, algo irreversible, gastar dinero, o lo que el registro de decisiones marca como humano. En ese caso NO adivines: anótalo en `docs/decisiones.md` como `pendiente` (qué pasa, opciones investigadas, tu recomendación) y, si bloquea ese frente, sigue con otros work orders. El cockpit resalta estas entradas para que Sergio las vea y responda.

## Al terminar todos

- Suite completa + e2e en verde, `docs/estado.yaml` → `fase: release`.
- Resumen a Sergio: qué se construyó, evidencia, y siguiente paso `/pandacorp:release`.

## Reglas
- Nunca avanzar con tests rojos. Errores idénticos repetidos 3 veces = detenerse y escalar.
- Límites de cuota: si se topan rate limits, reducir el equipo (menos agentes en paralelo) y/o bajar modelos de obreros. No es un error del código.
- Si un work order revela que el blueprint/FRD estaba mal, documenta el conflicto, ajusta el documento fuente (ADR si es arquitectónico) y recién continúa.
- Para proyectos triviales o sin separación clara (un solo módulo), está bien usar un único agente `implementer` en vez de equipo.
