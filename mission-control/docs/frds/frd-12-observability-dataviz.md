# FRD-12 — Observabilidad y visualización de datos

La capa "honesta" de Pandacorp: leer de un vistazo el estado de la fábrica y entender *dónde se atascó algo*, complementando el show RPG de Party. Derivado de la investigación 2026 (ver [docs/proposals/06](../../../docs/proposals/06-improvement-plan-2026.md)). Solo-lectura, sin llamar a Claude.

## Criterios de aceptación (EARS)

- LA cabecera DEBERÁ mostrar **≤5 KPIs** críticos (p. ej. proyectos activos, agentes trabajando, XP del día, builds en cola, **work orders fallidos**), arriba-izquierda; el detalle va en secciones colapsables.
- LA vista DEBERÁ mostrar un indicador **En vivo / Sin señal** con el **timestamp del último evento** leído de `~/.claude/dashboard-events.ndjson` (frescura del dato), para que el operador sepa si está viendo algo actual o congelado.
- DENTRO de un proyecto, DEBERÁ ofrecer un **toggle RPG ↔ timeline/árbol** sobre los mismos datos: work orders → tareas → acciones, con duración y relación padre-hijo.
- CUALQUIER agrupación o ranking (agentes, eventos, métricas) DEBERÁ limitarse al **top-5** para no saturar al operador.
- SI se dibuja el **DAG de work orders**, al señalar un nodo DEBERÁ **iluminar solo su cadena de dependencias** (upstream/downstream) y atenuar el resto; DEBERÁ ofrecer "saltar al primer error" y un *follow-mode* que centre el paso en ejecución.
- EL render del grafo DEBERÁ usar un motor de layout barato (**Dagre**, ~39KB) y NO ELK.js, salvo necesidad real de ruteo ortogonal.
- LAS métricas honestas (tareas hechas vs falladas, tiempo por work order, eventos por minuto) DEBERÁN derivarse del mismo archivo de eventos, sin instrumentación extra.

## Esquema de eventos (vendor-neutral)

El productor (hooks de la fábrica → `dashboard-events.ndjson`) y el consumidor (Mission Control) comparten un esquema **portable** (estilo OpenTelemetry: estandarizar la *forma* de la telemetría para no atarse a un visor). Mínimo por evento: `event`, `at` (timestamp ISO), `agent`/`session`, `tool`, `status` (ok | fail), `work_order`/`task` id. Esto permite renderizarlo como RPG, como timeline o exportarlo sin reescribir el emisor.

## No-objetivos (v1)
- No es un APM completo ni guarda histórico largo: lee la **cola** del archivo de eventos (tope 100–200), no toda la historia.
- No calcula costos/tokens en v1 (queda como métrica futura si se instrumenta).

## Futuro
Costo/tokens por agente y por proyecto; export del trace; comparación de velocidad idea→launch entre proyectos.
