---
title: "Estándares y reglas"
group: concepts
order: 4
---

# Estándares y reglas

La fábrica opera con dos capas de normas que se complementan: los **estándares** de ingeniería (el cómo técnico) y el **registro de decisiones** (las reglas de negocio recurrentes).

## Estándares de ingeniería

Los estándares viven en `factory/standards/` (26 archivos, 9 dominios) y son obligatorios en todos los proyectos. Además de los clásicos (convenciones, estructura, patrones, calidad, stack, seguridad, documentación, orquestación del build), desde 2026-07 el catálogo cubre: **manejo de errores** (`error-handling.md`), **modelado de datos** (`data-modeling.md`), **auth/authz** (`auth.md`), **resiliencia** (`resilience.md`), **jobs en background** (`background-jobs.md`), **ciclo de vida de dependencias** (`dependency-lifecycle.md`), **feature flags** (`feature-flags.md`) y **disciplina de implementación con IA** (`ai-implementation.md` — comentarios que no narran, sin árboles de docs paralelos, verificar contra la versión instalada).

**La plantilla ejecutable.** Cada estándar sigue la misma forma (validada por `check-standards.sh`): preámbulo (`Dominio · Severidad · Enforcement`) + **Regla** + **cómo se verifica con el check NOMBRADO** (una regla "verificada" sin mecanismo nombrado no se admite) + **por qué**. El **registro de reglas** (`rule-registry.md`) indexa las 124 reglas con su estado real: `wired` (un script/gate la verifica solo), `manual` (un paso humano nombrado) o `aspirational` (nada la verifica — un MUST aspiracional es un defecto; hoy hay **cero**). Las más recientes, PORT-1…6/DR-113 (2026-07-04), gobiernan la portabilidad multi-runtime (ver la página **Operar desde cualquier agente**). Antes, DOC-3/DR-112 (2026-07-03), exige que todo proyecto llegue con un `README.md` raíz poblado (qué hace + cómo levantarlo) — nunca el placeholder de scaffold — poblado progresivamente por `spec` (qué hace) y `architecture` (cómo levantarlo), reverificado en el hardening de `implement` y en el checklist de `release`. Antes de esa, CONV-12/DR-111 (2026-07-02), gobierna cómo el agente elige el modelo de un subagente cuando lo delega sin especificarlo: calcula el tier por la complejidad de la subtarea (nunca hereda el tier de la conversación padre), y Fable nunca se elige automáticamente.

Los estándares son versionados con la fábrica. Cambian solo por decisión explícita del propietario (`/pandacorp:learn`), que exige actualizar la regla inyectable + el registro en el mismo cambio (DR-051).

## Operar la fábrica desde cualquier agente (DR-113)

> Página dedicada: **Operar desde cualquier agente** (en esta misma sección de Conceptos), con el mapa single-source-of-truth y la guía de modificación cruzada.

Desde 2026-07-04 la fábrica es operable desde **cualquier runtime de coding** que hable los estándares abiertos AGENTS.md y Agent Skills — la app y el CLI de **OpenAI Codex** primero, Cursor y OpenCode después — sin bifurcar el know-how. El diseño es **núcleo portable + adapters finos**: el manual operativo canónico vive en `AGENTS.md` (raíz, agnóstico; `CLAUDE.md` queda como capa fina específica de Claude Code), los 25 skills se descubren vía `.agents/skills/`, y los agentes del equipo tienen espejos generados para Codex (`.codex/agents/*.toml`, con tiers de modelo neutrales MECH/STANDARD/JUDGE mapeados por runtime). El estándar operativo es `agent-portability.md` (reglas PORT-1…6): qué traduce a qué (tabla de equivalencias de herramientas), y qué degrada con honestidad — **el motor de build en background y su supervisor siguen siendo exclusivos de Claude Code**; en cualquier otro runtime `implement` corre como *build atendido* secuencial sobre la misma máquina de estados en ficheros, por lo que un runtime puede retomar lo que otro dejó (el estado vive en el frontmatter y `status.yaml`, nunca en la sesión). Los gates humanos, el idioma (con el propietario siempre en español) y la disciplina documental no degradan nunca.

## Trabajar varias cosas a la vez (DR-096)

Cuando abres **varias conversaciones en paralelo** para avanzar cosas distintas al mismo tiempo (a mano, fuera de `/implement`), cada sesión **se aísla sola** en su propio árbol de trabajo de git (un *worktree*). El motivo: el gate de calidad es de programa completo —`tsc`, `knip` y las pruebas visuales leen *todo* el árbol—, así que el trabajo a medias de una sesión haría fallar el gate de otra. Aislando, el gate de cada sesión solo ve su propio trabajo.

Es transparente: tú hablas normal y dices "ejecuta"; el agente crea el worktree, trabaja, y cuando todo está verde lo **fusiona solo a la rama principal** a través de una cola serializada (un merge a la vez). Solo te enteras si hay un conflicto que no se puede resolver automáticamente. Un fallo del gate en ficheros que tu sesión no tocó es de **otra sesión**: se reporta, nunca se arregla ni se enmascara. Esto es distinto de `/implement`, que ya evita colisiones por construcción y no usa worktrees.

**No se pierde nada por olvido.** Como el worktree se borra solo al fusionar, un worktree que sobrevive = trabajo sin mergear. Lo ves de tres formas: el comando `pending-work.sh` (lista lo no-mergeado con su antigüedad), un indicador global "⎇ N pendientes" en la barra de Mission Control, y el detalle por proyecto en su resumen. Aunque cierres la conversación, el trabajo vive en su rama de git y se recupera. El detalle vive en `build-orchestration.md` ("Parallel manual sessions").

**Cuando terminas tú, queda en "Hecho" (DR-097).** Si implementas un cambio a mano (dentro o fuera de `/implement`), el estado del work order se mueve a donde corresponde: a **Hecho** en cuanto el gate verde (`verify.sh`) pasa — no se queda varado en "En revisión". El gate es el verificador objetivo; el agente solo registra su veredicto, no se auto-evalúa.

**Las reglas de paralelo, reforzadas (DR-099).** El aislamiento de DR-096 era una regla *blanda* que un agente podía saltarse ("el árbol está quieto") y dejar trabajo a medias que rompía el gate de otra sesión. Ahora se refuerza por cuatro vías: (1) al editar código de producto **directo en el checkout principal** (no en un worktree), un recordatorio en el momento de la edición empuja a aislarse primero —para que "parece quieto" no pueda volver a colar trabajo sin mergear—; (2) un merge que no puede aterrizar (conflicto, gate rojo, copia ocupada) dispara una **notificación de escritorio** — nunca es silencioso; (3) cada conversación se mantiene **aislada**: un rojo ajeno se maneja en silencio y no se te narra lo que hacen otras sesiones (eso lo ves tú en el indicador de Mission Control, nunca como ruido en el chat) — y **al commitear**, si `git status` muestra ficheros que no tocaste, el agente hace `git add` **solo de los tuyos** y commitea, sin preguntarte ni mencionar el trabajo ajeno (commitear solo lo propio deja intacto lo de la otra sesión y no necesita permiso); (4) **el propio gate se calla ante un rojo ajeno**: antes el Stop hook te volcaba el fallo de otra sesión a la conversación; ahora **atribuye** el rojo —compara los ficheros que fallan contra los que **esta** sesión editó (que se registran al vuelo)— y si el rojo es **solo** de ficheros que no tocaste, deja terminar **en silencio** (lo registra para verlo en Mission Control, sin avisarte). A prueba de fallos: si el rojo toca algo tuyo, o no se puede atribuir, **sí te avisa**. Resultado: solo te interrumpen los rojos de **tu** sesión, nunca los de otra.

## El registro de decisiones

`factory/decisions/registry.yaml` contiene reglas con un **valor por defecto** para decisiones recurrentes. Ejemplos:

- `DR-001` — Añadir una dependencia → solo librerías aprobadas.
- `DR-009` — Idioma de artefactos → committed = inglés, gitignoreado = español.
- `DR-032` — Avance entre fases → siempre explícito, nunca automático.
- `DR-046` — Catalogs de Referencia → derivados de la fuente canónica, nunca copiados a mano.
- `DR-047` — Memoria transversal → cosecha, corrobora antes de confiar, gate humano.
- `DR-049` — Estructura de docs → feature-centric por FRD, no por tipo.
- `DR-050` — Gate de revisión → por FRD completo, no por WO individual.

Cuando un agente encuentra una situación no cubierta por el registro, escala al propietario **una sola vez** y codifica la respuesta como nueva regla.

## Cómo se aplican

Los agentes consultan el registro antes de tomar decisiones recurrentes. Mission Control muestra los estándares y las reglas en la sección **Referencia** del Manual y en la pestaña **Configuración** del proyecto.

## Promover una lección a estándar o regla

El flujo de autoaprendizaje (DR-047) captura lecciones candidatas en el inbox. Solo el propietario puede promover una lección a:

1. Un nuevo estándar en `factory/standards/`.
2. Una nueva regla en `factory/decisions/registry.yaml`.
3. Una nueva habilidad en el plugin.

La habilidad `/pandacorp:learn` (skill `learn`) facilita la promoción con el propietario como gate final.
