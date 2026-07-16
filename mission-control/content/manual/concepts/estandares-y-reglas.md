---
title: "Estándares y reglas"
group: concepts
order: 4
---

# Estándares y reglas

La fábrica opera con dos capas de normas que se complementan: los **estándares** de ingeniería (el cómo técnico) y el **registro de decisiones** (las reglas de negocio recurrentes).

## Estándares de ingeniería

Los estándares viven en `factory/standards/` (31 archivos, 11 dominios) y son obligatorios en todos los proyectos. Además de los clásicos (convenciones, estructura, patrones, calidad, stack, seguridad, documentación, orquestación del build), desde 2026-07 el catálogo cubre: **manejo de errores** (`error-handling.md`), **modelado de datos** (`data-modeling.md`), **auth/authz** (`auth.md`), **resiliencia** (`resilience.md`), **jobs en background** (`background-jobs.md`), **ciclo de vida de dependencias** (`dependency-lifecycle.md`), **feature flags** (`feature-flags.md`), **disciplina de implementación con IA** (`ai-implementation.md` — comentarios que no narran, sin árboles de docs paralelos, verificar contra la versión instalada) e **investigación de incidentes** (`debugging.md` — reproducir primero, sospechosos descartados con evidencia incl. escritores paralelos y el propio entorno, y cierre con guardas de atribución cuando no hay causa).

**La plantilla ejecutable.** Cada estándar sigue la misma forma (validada por `check-standards.sh`): preámbulo (`Dominio · Severidad · Enforcement`) + **Regla** + **cómo se verifica con el check NOMBRADO** (una regla "verificada" sin mecanismo nombrado no se admite) + **por qué**. El **registro de reglas** (`rule-registry.md`) indexa las 138 reglas con su estado real: `wired` (un script/gate la verifica solo), `manual` (un paso humano nombrado) o `aspirational` (nada la verifica — un MUST aspiracional es un defecto; hoy hay **cero**). Las más recientes (2026-07-15): **CONV-13** (evidencia antes de afirmar — ningún hecho se afirma al owner sin una observación de herramienta en la sesión; el estado registrado y los reportes de subagentes se re-verifican; lo no verificado se etiqueta), **QUAL-14** (economía de intentos en vivo — antes de consumir otro intento atendido por el owner, red-team de la matriz completa de fallos previos y prueba de que el ensayo ejercita la frontera real, no un mock) y **DEBUG-1…4** (el SOP de debugging/incidentes de `debugging.md`). Antes, PROMPT-1…8/DR-114 (2026-07-04, PROMPT-8 sumada 2026-07-15), gobiernan la **superficie de prompts** de la propia fábrica (`prompting-conventions.md`): los prompts de agentes y skills se escriben para los modelos que los consumen (Opus/Sonnet) — metas y restricciones sobre pasos narrados, énfasis solo en lo vinculante, una regla un hogar — y toda edición de un prompt exige una verificación independiente de contexto fresco que pruebe que ninguna regla se perdió; los gates humanos, el idioma y la disciplina documental son intocables en cualquier recalibración, y los briefs de despacho que el motor sintetiza en runtime son autocontenidos, nunca pointer-specs (PROMPT-8). El mismo día, PORT-1…6/DR-113 gobiernan la portabilidad multi-runtime (ver la página **Operar desde cualquier agente**). Antes, DOC-3/DR-112 (2026-07-03), exige que todo proyecto llegue con un `README.md` raíz poblado (qué hace + cómo levantarlo) — nunca el placeholder de scaffold — poblado progresivamente por `spec` (qué hace) y `architecture` (cómo levantarlo), reverificado en el hardening de `implement` y en el checklist de `release`. Antes de esa, CONV-12/DR-111 (2026-07-02), gobierna cómo el agente elige el modelo de un subagente cuando lo delega sin especificarlo: calcula el tier por la complejidad de la subtarea (nunca hereda el tier de la conversación padre), y Fable nunca se elige automáticamente.

Los estándares son versionados con la fábrica. Cambian solo por decisión explícita del propietario (`/pandacorp:learn`), que exige actualizar la regla inyectable + el registro en el mismo cambio (DR-051).

## Fuente única de verdad (DR-115)

Desde 2026-07-05, principio de primera clase (constitución §25 + `single-source-of-truth.md`): **cada hecho tiene un solo escritor; los lectores derivan, nunca duplican**. Un dato que consumen varias superficies toma una de dos formas — derivar-en-lectura a través de UN resolver compartido (el default), o un **cache honesto** (escritor único nombrado, re-derivado de la fuente atómica en puntos seguros, documentado como réplica, y que ninguna superficie de display lee si existe el resolver vivo). Prohibido: una segunda derivación independiente de un valor que ya tiene resolver, contadores mantenidos a base de `+1/-1` repartidos, campos muertos que un lector sigue mostrando como verdad, y docs que declaran una fuente distinta de la que el código lee. El enforcement más fuerte es **por construcción** (retirar el campo legible del tipo del lector), más la lente del `reviewer` y el chequeo de drift de esquema del doc-lint. Federa las instancias que ya existían: DR-092 (resolver de UI), DR-050 §1 (el work order es la verdad atómica), DR-087 (`dependsOn` es la fuente del DAG), DR-066 (liveness = cruce, no la flag), DR-078 (lecturas fail-loud). Nació de la auditoría del 2026-07-05 en la que Mission Control mostraba hasta tres conteos distintos de work orders para el mismo proyecto (proposal 29).

## Operar la fábrica desde cualquier agente (DR-113)

> Página dedicada: **Operar desde cualquier agente** (en esta misma sección de Conceptos), con el mapa single-source-of-truth y la guía de modificación cruzada.

Desde 2026-07-04 la fábrica comparte su know-how con **cualquier runtime de coding** que hable los estándares abiertos AGENTS.md y Agent Skills — la app y el CLI de **OpenAI Codex** primero, Cursor y OpenCode después — sin bifurcarlo. El diseño es **núcleo portable + ejecutores locales al runtime**: el manual operativo canónico vive en `AGENTS.md` (raíz, agnóstico; `CLAUDE.md` queda como capa fina específica de Claude Code), los 25 skills se descubren vía `.agents/skills/`, y los agentes del equipo tienen proyecciones generadas para Codex (`.codex/agents/*.toml`, con tiers neutrales MECH/STANDARD/JUDGE mapeados por runtime). El estándar operativo es `agent-portability.md` (PORT-1…6). **El motor Dynamic Workflow y su supervisor siguen siendo exclusivos de Claude Code.** Bajo el límite R0 vigente, Codex es solo lectura/review sobre estado de build hasta que R2 + R3 + la primera transición R6 certifiquen ownership, enforcement y escritor único. Los ficheros permiten una continuación posterior, no takeover vivo: el cambio de runtime ocurre únicamente después de un safe point limpio, parada completa y liberación de ownership; el guard actual `running` + heartbeat es liveness TTL, no un lock atómico. Cada runtime usa sólo sus propios agentes/modelos. Los gates humanos, el idioma (con el propietario siempre en español) y la disciplina documental no degradan nunca.

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

## Consistencia documental — el gate de supersesión completa (DR-116)

Ninguna regla puede sobrevivir en las sombras. Si cambias una regla en un doc pero su enunciado viejo sigue vivo en otro, dos agentes leen dos verdades y se desvían — el patrón raíz de las ~21 contradicciones que encontró la auditoría del 2026-07-05. El gate **nunca bloquea el cambio**, solo su propagación INCOMPLETA:

- **Set recién generado** (PRD+FRDs de `spec`, blueprint+WOs de `architecture`): un verificador fresco lo lee entero; una contradicción interna dura **bloquea el cierre de la fase**, como un `[NEEDS CLARIFICATION]` pendiente.
- **Edición al corpus existente** (`change`/`iterate`/`learn`): declaras qué regla vieja reemplazas y el verificador confirma que ningún doc la sigue afirmando y que el porqué quedó registrado (las dos escrituras: doc canónico + decision log).
- **Barrido advisory semanal** (`pandacorp-consistency-sweep`): caza la deriva que se cuele — reporta y ficha como `BL-*`, nunca edita ni bloquea.

Canónico: `factory/standards/document-consistency.md`.
