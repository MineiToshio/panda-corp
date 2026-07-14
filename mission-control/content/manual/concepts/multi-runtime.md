---
title: "Operar desde cualquier agente"
group: concepts
order: 20
---

# Operar desde cualquier agente (multi-runtime)

Desde 2026-07-04 (DR-113) la fábrica no vive casada con Claude Code: puedes abrir panda-corp o cualquier proyecto en la **app de Codex** (o su CLI, Cursor, OpenCode) y operar con las mismas reglas, los mismos skills y el mismo estado. Esta página explica cómo funciona, qué cambia según la puerta por la que entres, y cómo se mantiene sin duplicar nada.

## Las dos puertas y el núcleo

Piensa en un edificio con dos puertas que llevan al mismo taller:

| | Puerta Claude Code | Puerta Codex |
|---|---|---|
| **Qué lee al entrar** | `CLAUDE.md` → importa `AGENTS.md` y añade su capa | `AGENTS.md` directo + plugin Codex instalado; ignora sólo `CLAUDE.md` |
| **Su capa propia** | Plugin instalado (`/pandacorp:*`), hooks, motor background | Plugin Codex + `.agents/skills` (symlink) + `.codex/agents/*.toml` (generados) |
| **Ejecutor de `implement`** | Dynamic Workflow + supervisor; solo agentes/modelos Claude | `runtime/codex/executor.mjs` + supervisor Codex; solo agentes/modelos Codex, cuando PORT-5 lo promocione |
| **El núcleo que ambos operan** | `AGENTS.md` + `factory/` (manual y estándares) · `plugin/skills/` (los 25 SKILL.md) · el estado en ficheros (`status.yaml`, frontmatter de work orders, colas de inbox) | idem — es el MISMO conjunto de ficheros |

Nadie elige runtime con un switch: **cada herramienta se auto-selecciona por lo que es capaz de leer**. El diagrama fuente está en `docs/assets/multi-runtime-two-doors.svg` (repo de la fábrica).

Cursor y OpenCode conservan el piso portable de `AGENTS.md` + `.agents/skills`; no se les atribuye
la instalación, los hooks ni los agentes TOML específicos del plugin Codex.

## Single source of truth — qué es enlace, qué es generado

Regla: una sola fuente por cosa; lo demás es symlink, import o artefacto generado. Las copias derivadas están automatizadas y el gate compara sus fuentes:

| Pieza | Fuente única | El "otro lado" es… |
|---|---|---|
| Los 25 skills | `plugin/skills/*/SKILL.md` | **symlink** (`.agents/skills → plugin/skills`): el mismo fichero físico |
| El manual operativo | `AGENTS.md` (raíz) | **import** (`CLAUDE.md` lo referencia, no lo copia) |
| Estándares, registry, docs | `factory/…` | compartido tal cual (ambos leen el mismo fichero) |
| Los 14 agentes del equipo | `plugin/agents/*.md` | **generado** (`.codex/agents/*.toml`, script `generate-codex-agents.mjs`; cabecera "do not edit") |
| Manifests del plugin | `plugin/runtime/plugin-metadata.json` | `.claude-plugin/plugin.json` + `.codex-plugin/plugin.json`, generados |
| Vocabulario de eventos | `plugin/runtime/event-vocabulary.json` | proyección generada para Mission Control (`src/lib/events/event-vocabulary.json`) |

Desde 2026-07-04 esta capa derivada ya no depende solo del ritual: el gate `check-derived-drift.sh` (hook de Stop en el repo de la fábrica) verifica en cada sesión que los TOML generados coinciden con sus fuentes, que ambos manifests llevan la misma versión y que el symlink `.agents/skills` resuelve — si algo derivó, la sesión no puede declararse terminada hasta regenerar/re-sincronizar.

## Telemetría: dos transportes, un idioma

Claude conserva `~/.claude/dashboard-events.ndjson`; Codex escribe su propio `~/.codex/dashboard-events.ndjson`. Mission Control lee ambos, normaliza con el vocabulario único y elimina replays del feed. Pero esos IDs no son prueba de un resultado: XP y logros durables entran al único `factory/gamification-ledger.json` sólo cuando un work order, gate, estado o artefacto canónico lo confirma. El ledger guarda un hecho limpio, sin confiar en el agente, rol, modo, hora o veredicto declarado por el evento. Si todavía no existe un oráculo durable, la señal sigue viéndose como telemetría pero no desbloquea nada. Borrar o rotar los streams después de reconciliar no reduce el progreso.

El aviso de plugin también separa puertas: el cache instalado de Claude y el de Codex tienen veredictos independientes. Tener Claude actualizado no demuestra que Codex lo esté, ni al revés.

## Si modificas algo, ¿qué debes tocar para que funcione en ambos?

| Cambias… | Qué más hacer |
|---|---|
| Un skill (`SKILL.md`) | Nada — el symlink hace que Codex lo vea al instante; Claude requiere `claude plugin update` como siempre |
| Un agente (`plugin/agents/*.md`) | Regenerar espejos: `node plugin/scripts/generate-codex-agents.mjs` |
| El manual (`AGENTS.md`) | Verificar que sigue < 32 KB (tope de Codex) y que no dependes de `@imports` (Codex no los expande) |
| La capa Claude (`CLAUDE.md`) | Nada para Codex (no lo lee) |
| La versión del plugin | Mantener los DOS manifests en la misma versión |
| El vocabulario de eventos | Editar `plugin/runtime/event-vocabulary.json` y ejecutar `node plugin/scripts/generate-event-vocabulary.mjs` |

El detalle completo (matriz de capacidades, tiers de modelo, tabla de traducción de herramientas) vive en el estándar `factory/standards/agent-portability.md` (reglas PORT-1…6).

## Qué funciona igual y qué degrada

**Igual en ambos mundos:** los gates humanos, el español contigo, la disciplina documental, la cola de cambios, el tablero y las fases. **Eso no autoriza todavía escritura de build desde Codex.** R2/R3/R6, R7/R8 offline y el cambio en frío bidireccional R10 en fixture están verdes; falta probar ese cambio entre las aplicaciones instaladas y certificar R11 desatendido. Hasta entonces, Codex es solo lectura/review sobre el estado de construcción.

R11 separa tres evidencias que no se pueden confundir: `OFFLINE_ACCELERATED` (fallos inyectados y
relojes acelerados), `LIVE_SHORT` (proveedor real por pocos minutos) y `LIVE_OVERNIGHT` (varias horas
reales). Las dos primeras están verdes, incluido el `LIVE_SHORT` del código actual: terminó en 114
segundos con proveedor real, gasto y heartbeat durables, terminal del supervisor y lease liberado. El
overnight sigue pendiente. El launcher comprueba host,
credenciales, red, sandbox, árbol limpio y prevención de sueño, y deja un recibo reanudable en
`.pandacorp/run/codex-launch.json`. Esto mejora la seguridad del camino, pero no abre el permiso hasta
completar también el canario instalado R10 y el overnight R11.

El cierre Codex también es una sola transición observable: el checkpoint captura una única hora y la
reutiliza como `terminal_at` y `updated_at`. El recolector falla cerrado si el evento de cierre, la
liberación de lease, el supervisor o el recibo aparecen antes de ese instante o contradicen el resultado.
También exige que cada FRD nocturno tenga review JUDGE terminada en verde y su resultado real, y que
el recibo completo coincida con el marker y la autorización del dueño. Así, ni una diferencia accidental
de milisegundos, ni una review apenas iniciada, ni un recibo mínimo pueden fabricar la certificación.

Un cambio de runtime es siempre **en frío y desde un safe point**: el ejecutor actual termina su gate/commit, se detiene por completo y libera ownership; recién entonces otra sesión puede reconstruir los ficheros. Nunca hay takeover vivo, mensajería/delegación entre runtimes ni dos builds simultáneos. Claude usa únicamente agentes/modelos Claude; Codex, únicamente los suyos.

R10 no intenta convertir Dynamic Workflows en un motor de Codex. Comprueba una cadena de tres
ejecuciones separadas: Claude publica un safe point con su Dynamic Workflow; Codex, en una sesión
posterior, adquiere una lease nueva y continúa con su propio executor; Claude vuelve después y reconoce
el estado producido por Codex. El puente son los commits, el frontmatter, `status.yaml` y la lease, no
mensajes ni resultados internos de un subagente.

La frontera de alcance es idéntica en las dos puertas: un `implement` dirigido a FRDs o a una change
termina después de sus gates, libera la lease y mantiene `phase: implementation`. No puede aprovechar
que su objetivo era lo último pendiente para entrar al hardening global o modificar otras features.
Solo un `implement` sin objetivo puede auditar/arreglar el proyecto completo y avanzar a `release`.

Hay una limitación explícita de la plataforma Claude: el JavaScript de Dynamic Workflows no ejecuta
filesystem o procesos directamente, así que `inspect-stop` pasa por un subagente Claude. El motor
valida el recibo y falla cerrado, y una calificación instalada demuestra la llamada real incluso con
aliases hostiles. Eso no equivale a probar criptográficamente cada tool call futura. BL-0074 conserva
ese hardening como no bloqueante; R10/R11 certifican el contrato observable y el relevo en frío, no la
eliminación de todo límite interno de Dynamic Workflows.

El permiso excepcional de R10 fija el motor contra una sola ruta real del overlay:
`.claude/engines/pandacorp-build.js`. Debe ser un fichero regular, versionado y con el hash esperado;
si falta, cambia o es un symlink, la certificación se bloquea. La comprobación previa tampoco imprime
el nonce de autorización.

Antes de consumir la etapa Codex, R10 exige además que la evidencia de Claude coincida con el HEAD y
con seis campos de relevo (`phase`, `running`, inicio, run lógico, runtime y epoch), y pregunta al
resolver compartido si realmente es una continuación Claude→Codex. La lease vuelve a derivar esos
campos en cada heartbeat, sincronización y cierre; una copia vieja de `status.yaml` no puede convertir
el relevo en un run nuevo ni quedar commiteada por la reparación de baseline.

Una continuación real conserva el mismo `build_run_id` lógico para heredar despachos, gasto y frenos
de salud, pero tú nunca copias ese ID. Los dos launchers usan un único resolver: si ven
`phase: implementation`, `running: false`, ausencia de lease y un runtime anterior distinto,
continúan automáticamente. Una segunda pasada en el mismo runtime, `phase: release` o la intención
explícita `new` crean un run nuevo. La identidad del proceso o sesión de cada app sigue siendo local y
nunca se usa como sustituto.

**Degrada con honestidad en Codex:**
- El build (`implement`) sigue **habilitado sólo en Claude**. R10 prueba el contrato en un proyecto desechable, no el comportamiento de las dos aplicaciones instaladas.
- **La Fragua**: Codex puede leer la evidencia existente, pero no emite eventos de build mientras sea read/review-only.
- La política, los adaptadores y las proyecciones de hooks/config de Codex están certificados en fuente, pero el enforcement activo requiere instalar el plugin y dar trust explícito a sus definiciones. Hasta cerrar ese canario (BL-0030), `AGENTS.md` sigue siendo el piso vinculante y no se reclama paridad automática.

## Cómo probar que funciona

1. **Codex, en frío**: abre panda-corp en la app de Codex → debe hablarte en español y listar los 25 skills (`/skills`).
2. **Codex, revisión segura**: abre un proyecto detenido en un safe point y pídele revisar work orders, commits y evidencia del gate sin mutar estado de construcción. El build se habilita sólo después del canario live R10 y R11.
3. **Claude, intacto**: la misma prueba vía `/pandacorp:implement` — motor background, supervisor y Fragua completa, como siempre.
4. **Harness Codex desatendido**: desde la fábrica, ejecuta `node plugin/scripts/test-codex-unattended.mjs`; debe quedar verde. El canario real corto se repite con `node plugin/scripts/run-codex-live-short-canary.mjs --keep`. El overnight usa el comando y conserva la evidencia descrita en `plugin/runtime/codex/R11-CERTIFICATION.md`.
