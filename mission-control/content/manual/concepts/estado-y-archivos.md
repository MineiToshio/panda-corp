---
title: "Estado y archivos"
group: concepts
order: 7
---

# Estado y archivos

La fábrica y sus proyectos se coordinan enteramente a través de ficheros versionados. No hay base de datos centralizada ni estado en memoria que persista entre sesiones. Esta página describe los ficheros de estado más importantes y su propósito.

## La regla del idioma

El idioma de un fichero lo determina si está versionado o gitignoreado:

- **Committed → inglés** — código, commits, documentos técnicos (PRD, FRD, blueprint, ADR, README, tests, `docs/decision-log.md`).
- **Gitignoreado → español** — la capa de comunicación con el propietario (`.pandacorp/comms/`, `.pandacorp/inbox/`) y datos personales (`factory/profile.md`, `factory/portfolio.md`, `factory/ideas/*.md`).

## Estado del proyecto: `.pandacorp/status.yaml`

El fichero más importante de un proyecto. Registra:

```yaml
phase: build                    # fase actual del pipeline
version: "1.0.0"                # versión semántica
overlay_version: "8.5.0"        # versión del overlay Pandacorp
last_green_sha: abc1234         # SHA del último commit con verify.sh verde
safe_to_test: true              # si el build está en estado limpio
running: false                  # si el motor de implement está activo
blocked_work_orders: []         # WOs congeladas esperando desbloqueo
```

Mission Control lee este fichero para mostrar la fase y el estado en el portfolio y en la página de proyecto.

## Work orders: `docs/frds/frd-NN-<slug>/work-orders/wo-NN-MMM-<slug>.md`

Cada work order tiene frontmatter con su estado:

```yaml
implementation_status: IN_REVIEW   # PLANNED | IN_PROGRESS | IN_REVIEW | VERIFIED | BLOCKED
```

El motor de `implement` actualiza este campo al avanzar la WO. Mission Control lo lee para el tablero Kanban.

## Comunicación con builds en marcha

### `.pandacorp/inbox/bugs/`

Carpeta gitignoreada. Colocar un fichero aquí es suficiente para reportar un bug al motor de `implement` en ejecución. El motor lo recoge en el próximo safe-point.

### `.pandacorp/inbox/decisions.md`

Fichero gitignoreado. Las decisiones pendientes se listan aquí. `/pandacorp:decide` las lleva al registro de decisiones.

### `.pandacorp/comms/progress.md`

Log gitignoreado de avance en español. Los implementers escriben aquí su handoff al terminar cada WO. Mission Control no lo lee (es para el propietario).

### `.pandacorp/comms/iteration.md`

Persistencia de la conversación de diseño/spec con el propietario. Permite retomar la conversación aunque se pierda el contexto de la sesión.

## Eventos del Party: `~/.claude/dashboard-events.ndjson`

Fichero NDJSON en el directorio home. Los agentes escriben eventos con `printf` al terminan acciones relevantes. Mission Control lo lee para el Party panel y los KPIs en tiempo real. No está versionado — es del usuario local, y **rota** (se lee la cola).

## La línea de tiempo durable: `.pandacorp/track.jsonl`

A diferencia del fichero de eventos (efímero, global), el motor de build escribe un **registro durable por proyecto** en `.pandacorp/track.jsonl`: una línea por transición (`wo_start`, `wo_end`, `review_start`/`review_end`, `frd_end`). Es **estado-máquina versionado** (como `status.yaml`, lo commitea el motor), así que sobrevive al build. Es la fuente que lee la **Observabilidad → Línea de tiempo** (FRD ▸ work order ▸ revisión, con duraciones reales). Solo lo tienen los proyectos construidos con el motor que lo escribe; los anteriores muestran una vista estructural sin duraciones.

## La memoria de la fábrica: `factory/memory/`

Lecciones duraderas cosechadas de los proyectos. Están versionadas (committed en inglés) porque son know-how de la fábrica, no datos personales. El inbox (`factory/memory/_inbox.md`) es gitignoreado — solo las lecciones promovidas se commitean.

## Secretos

Los secretos **nunca están en ningún fichero versionado**. Se inyectan via variables de entorno o un gestor de secretos (SOPS + age). El `.gitignore` de cada proyecto excluye `.env*` por defecto.
