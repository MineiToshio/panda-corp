---
title: "Operar desde cualquier agente"
group: concepts
order: 20
---

# Operar desde cualquier agente (multi-runtime)

Desde 2026-07-04 (DR-113) la fábrica no vive casada con Claude Code: puedes abrir panda-corp o cualquier proyecto en la **app de Codex** (o su CLI, Cursor, OpenCode) y operar con las mismas reglas, los mismos skills y el mismo estado. Esta página explica cómo funciona, qué cambia según la puerta por la que entres, y cómo se mantiene sin duplicar nada.

## Las dos puertas y el núcleo

Piensa en un edificio con dos puertas que llevan al mismo taller:

| | Puerta Claude Code | Puerta Codex (y Cursor/OpenCode) |
|---|---|---|
| **Qué lee al entrar** | `CLAUDE.md` → importa `AGENTS.md` y añade su capa | `AGENTS.md` directo (ignora `CLAUDE.md` y el plugin) |
| **Su capa propia** | Plugin instalado (`/pandacorp:*`), hooks, motor background | `.agents/skills` (symlink), `.codex/agents/*.toml` (generados) |
| **El núcleo que ambos operan** | `AGENTS.md` + `factory/` (manual y estándares) · `plugin/skills/` (los 25 SKILL.md) · el estado en ficheros (`status.yaml`, frontmatter de work orders, colas de inbox) | idem — es el MISMO conjunto de ficheros |

Nadie elige runtime con un switch: **cada herramienta se auto-selecciona por lo que es capaz de leer**. El diagrama fuente está en `docs/assets/multi-runtime-two-doors.svg` (repo de la fábrica).

## Single source of truth — qué es enlace, qué es generado

Regla: una sola fuente por cosa; lo demás es symlink, import o artefacto generado. **Solo existe UNA copia derivada** (los agentes Codex) y está automatizada:

| Pieza | Fuente única | El "otro lado" es… |
|---|---|---|
| Los 25 skills | `plugin/skills/*/SKILL.md` | **symlink** (`.agents/skills → plugin/skills`): el mismo fichero físico |
| El manual operativo | `AGENTS.md` (raíz) | **import** (`CLAUDE.md` lo referencia, no lo copia) |
| Estándares, registry, docs | `factory/…` | compartido tal cual (ambos leen el mismo fichero) |
| Los 14 agentes del equipo | `plugin/agents/*.md` | **generado** (`.codex/agents/*.toml`, script `generate-codex-agents.mjs`; cabecera "do not edit") |
| Manifests del plugin | `.claude-plugin/plugin.json` | espejo mínimo (`.codex-plugin/plugin.json`), misma versión por ritual |

Desde 2026-07-04 esta capa derivada ya no depende solo del ritual: el gate `check-derived-drift.sh` (hook de Stop en el repo de la fábrica) verifica en cada sesión que los TOML generados coinciden con sus fuentes, que ambos manifests llevan la misma versión y que el symlink `.agents/skills` resuelve — si algo derivó, la sesión no puede declararse terminada hasta regenerar/re-sincronizar.

## Si modificas algo, ¿qué debes tocar para que funcione en ambos?

| Cambias… | Qué más hacer |
|---|---|
| Un skill (`SKILL.md`) | Nada — el symlink hace que Codex lo vea al instante; Claude requiere `claude plugin update` como siempre |
| Un agente (`plugin/agents/*.md`) | Regenerar espejos: `node plugin/scripts/generate-codex-agents.mjs` |
| El manual (`AGENTS.md`) | Verificar que sigue < 32 KB (tope de Codex) y que no dependes de `@imports` (Codex no los expande) |
| La capa Claude (`CLAUDE.md`) | Nada para Codex (no lo lee) |
| La versión del plugin | Mantener los DOS manifests en la misma versión |

El detalle completo (matriz de capacidades, tiers de modelo, tabla de traducción de herramientas) vive en el estándar `factory/standards/agent-portability.md` (reglas PORT-1…6).

## Qué funciona igual y qué degrada

**Igual en ambos mundos:** los gates humanos, el español contigo, la disciplina documental, la cola de cambios (`/pandacorp:change` o su equivalente), el tablero y las fases (leen ficheros), y el **resume cruzado**: un runtime puede retomar el build que dejó el otro, porque el estado vive en disco y el candado de DR-050 impide que construyan a la vez.

**Degrada con honestidad en Codex:**
- El build (`implement`) corre **atendido y secuencial** (playbook PORT-5), no en background: la construcción nocturna desatendida sigue siendo exclusiva de Claude Code.
- **La Fragua**: el flujo automático de eventos (hooks + motor) es de Claude; el playbook atendido instruye emitir los eventos clave (`AgentWorking`, `gate`) al mismo stream, así que un build atendido desde Codex también se asoma a la Fragua — con menos granularidad que el motor nativo.
- El enforcement (bloqueo de comandos peligrosos, gate de verificación al parar) en Codex son instrucciones, no hooks — portarlos es el backlog BL-0030.

## Cómo probar que funciona

1. **Codex, en frío**: abre panda-corp en la app de Codex → debe hablarte en español y listar los 25 skills (`/skills`).
2. **Codex, un ciclo real**: registra un microcambio con `change` en un proyecto y pídele a Codex ejecutar el build atendido (PORT-5) para ese cambio: verás los mismos commits, frontmatter y gates que haría Claude.
3. **Claude, intacto**: la misma prueba vía `/pandacorp:implement` — motor background, supervisor y Fragua completa, como siempre.
