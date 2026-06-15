# Pandacorp — Fábrica de software 100% IA

Este repo es **la fábrica**: el know-how de la empresa. Aquí NUNCA vive código de producto.

## Qué hay aquí

- `factory/constitution.md` — principios y estándares innegociables. **Léela antes de cualquier trabajo de fábrica.**
- `factory/standards/` — estándares de ingeniería que se inyectan en cada proyecto (convenciones, estructura, patrones, calidad, stack recomendado, servicios externos/cuentas/secretos). El stack es sugerencia; se elige y aprueba en el blueprint. Servicios por defecto, modelo de cuentas, secretos (SOPS+age) y pagos (Polar) viven en `external-services.md`.
- `factory/ideas/` — base de ideas (una ficha .md por idea, frontmatter con `estado`). **Tus fichas son personales (gitignored)**; se versiona la plantilla `_idea-template.md`.
- `factory/profile.md` — perfil del dueño (nombre, objetivos, GitHub, ruta de proyectos). **Personal (gitignored)**; lo genera `/pandacorp:onboarding` desde `profile.example.md`. La fábrica lo lee para personalizarse.
- `factory/portfolio.md` — índice de proyectos creados y su estado (punteros, no contenido). **Personal (gitignored)**; seed en `portfolio.example.md`.
- `factory/decisions/registry.yaml` — registro de decisiones con defaults pre-aprobados
- `plugin/` — el plugin `pandacorp` (skills, agentes, hooks, plantillas). Instalado vía marketplace local (ver *Mantenimiento del plugin*).
- `docs/` — visión, investigación y propuestas
- `DECISION-LOG.md` — índice de bitácoras de decisiones (una por área). Ver sección **Bitácora**.
- `ideas.base` — vista kanban de Obsidian sobre la base de ideas

## Cómo se opera la fábrica

| Acción | Skill |
|---|---|
| **Configurar la fábrica (primer arranque, tras clonar)** | `/pandacorp:onboarding` |
| Explorar/aclarar una idea difusa en conversación (descubierta) | `/pandacorp:explore [tema]` |
| Capturar/cristalizar una idea del dueño (one-shot o desde lo conversado) | `/pandacorp:new-idea` |
| Buscar dolores monetizables en internet | `/pandacorp:discover` |
| Pedir ranking/recomendación de ideas | `/pandacorp:recommend` |
| Crear el proyecto y documentar el MVP de una idea (handoff) | `/pandacorp:spec <idea>` |
| Sincronizar portfolio y detectar tarjetas movidas | `/pandacorp:sync-portfolio` |

`/pandacorp:spec <idea>` es el **handoff**: se corre DESDE la fábrica con el nombre de la idea, crea la carpeta/repo del proyecto y documenta el MVP (investigación + PRD + FRDs).

Las demás fases se ejecutan **dentro de la carpeta del proyecto**, sin nombre:
- `/pandacorp:design` — mockups y sistema de diseño (iterar en la conversación).
- `/pandacorp:blueprint` — crea blueprint **+ work orders**.
- `/pandacorp:implement` — arranca la construcción con un workflow dinámico (Dynamic Workflows) que orquesta a los subagentes, se sigue en Mission Control.
- `/pandacorp:release` — auditoría + deploy (gate humano para producción).
- `/pandacorp:iterate` — agregar funcionalidades o cambios en cualquier momento (en construcción o lanzado).

Opcionales/internos: `:new-version` (hito grande con mini-PRD), `:scaffold` y `:work-orders` (pasos que normalmente invocan `spec`/`blueprint`).

**Iterar sin avanzar (DR-032).** Ninguna fase manual (`explore`, `new-idea`, `spec`, `design`, `blueprint`) auto-avanza de columna: produce su output, marca `avance_pendiente: true` y espera tu "ok, avanza". **Re-correr la misma fase = seguir puliendo** (refina, no regenera ni repite lo descartado). La esencia del ida-y-vuelta se persiste en `docs/iteration.md` del proyecto (en ideas sin proyecto: `factory/ideas/_drafts/<slug>.md`), para retomar aunque pierdas la conversación. No aplica a `implement` (autónomo, ya reanudable) ni cambia el gate de producción.

## Mantenimiento del plugin

El plugin está instalado desde el marketplace local de este repo (`claude plugin install pandacorp@panda-corp`, scope usuario). **Tras editar cualquier cosa en `plugin/`**: (1) **sube la versión** en `plugin/.claude-plugin/plugin.json` según semver (ver abajo); (2) commitear; (3) correr `claude plugin update pandacorp@panda-corp` (los cambios aplican al reiniciar sesión). Validar con `claude plugin validate plugin/`.

**Versionado del plugin (semver, DR-034).** El plugin lleva `version` en `plugin/.claude-plugin/plugin.json` (fuente de verdad) y **se sube en cada cambio** de `plugin/`:
- **PATCH** (`x.y.Z`) — fix, ajuste o doc sin cambiar el comportamiento de skills/agentes.
- **MINOR** (`x.Y.0`) — capacidad nueva compatible (skill o agente nuevo, opción nueva).
- **MAJOR** (`X.0.0`) — breaking change (renombrar/eliminar un skill, cambiar un flujo de forma incompatible con proyectos existentes).

Anota el porqué del cambio en `plugin/docs/decision-log.md`. La instalación local sigue rastreando el SHA del commit para detectar desfase (ver abajo); la `version` es la etiqueta semántica del release.

Mission Control **avisa del desfase** (FRD-15): si hay cambios en `plugin/` sin commitear, o el SHA instalado (`~/.claude/plugins/installed_plugins.json`) quedó atrás del último commit del plugin, muestra un banner con el comando de actualización. Así no se olvida.

## Bitácora — documentar todo

Documentar un cambio son **dos cosas, siempre, y en el sitio correcto**:

1. **Actualizar el doc canónico** (la verdad actual) — el documento *dueño* de ese hecho, para que describa la realidad de ahora.
2. **Anotar la decisión en la bitácora del área** (la historia) — fecha, *qué*, *por qué*, enlazando el doc que se tocó.

El doc canónico responde *"¿qué es verdad ahora?"*; la bitácora, *"¿cómo llegamos aquí y por qué?"*. Un FRD dice qué hace la app hoy; la bitácora, qué cambió y por qué. Hacen falta **los dos**: solo el FRD pierde el porqué; solo la bitácora deja el FRD mintiendo.

**Doc canónico — dónde se actualiza cada tipo de cambio:**

| Cambio | Doc dueño |
|---|---|
| Comportamiento/feature de la app (qué hace, criterios de aceptación) | el **FRD** correspondiente (`docs/frds/`); feature nueva → FRD nuevo |
| Alcance/objetivo de producto, métricas | el **PRD** (`docs/prd.md`) |
| Arquitectura, stack, modelo de datos, decisión técnica | el **blueprint** + un **ADR** |
| Diseño visual, tokens, componentes | **DESIGN.md** / design tokens |
| Skill/agente/hook del plugin | el **archivo en `plugin/`** |
| Una idea (contenido/estado) | su **ficha** `factory/ideas/<slug>.md` |
| Convención/estándar de ingeniería | `factory/standards/` |
| Regla recurrente con default | `factory/decisions/registry.yaml` |

**Bitácora — una por área (la historia, con el porqué):** índice en `DECISION-LOG.md` (raíz).

| Área | Archivo |
|---|---|
| Mission Control (app Next.js) | `mission-control/docs/decision-log.md` |
| Plugin pandacorp | `plugin/docs/decision-log.md` |
| Ideas (base y su proceso) | `factory/ideas/decision-log.md` |
| Fábrica (constitución, estándares, operación) | `factory/decision-log.md` |

**Regla:** ante cualquier decisión o cambio relevante, actualiza el **doc canónico** *y* anota la entrada en la **bitácora del área** **antes de cerrar el turno**; enlázalos (en la entrada, campo *Impacto* → qué doc se actualizó). Lo más reciente arriba. No anotar cambios triviales ya evidentes en el commit. El `status.yaml` de cada proyecto lo escriben los skills/CI, no a mano.

**Tres cosas distintas, no las mezcles:** el **doc canónico** (FRD/PRD/blueprint/DESIGN/ficha) es la **verdad actual**; la **bitácora** es **historia**; `factory/decisions/registry.yaml` es **política** (reglas con default). Una decisión que crea una regla va al registro *y* a la bitácora; un cambio de la app va a su FRD *y* a la bitácora. Para los **proyectos de producto** esta disciplina se inyecta como estándar propagable (`factory/standards/documentation.md`): cada proyecto nace con su `docs/decision-log.md` y la regla en su `CLAUDE.md`/`AGENTS.md`.

## Reglas de esta carpeta

1. Idioma — **el estado en git decide el idioma** (regla *committed = inglés / gitignored = español*). Todo lo **committeado** va en inglés: código, commits, **nombres de archivo y carpeta**, y los documentos de producto/técnicos (PRD, FRD, blueprint, ADR, README, tests, y la `docs/decision-log.md` del proyecto). Todo lo **gitignored** va en español: la comunicación con Pandacorp (resumen del proyecto, `docs/decisions.md`, logs, actividad, feed de Mission Control, `docs/iteration.md`) y los datos personales del dueño. `docs/status.yaml` se committea con solo estado de máquina en inglés (claves/enums/contadores/SHAs); su prosa legible vive en la capa española gitignored. Así, quien clona el repo lo ve todo en inglés y el dueño opera Pandacorp en español. Detalle en `factory/standards/conventions.md` (Idioma) y `DR-009`.
2. Toda decisión recurrente se resuelve consultando `factory/decisions/registry.yaml`. Si no está cubierta: escalar al dueño UNA vez y codificar su respuesta como regla nueva en el registro.
3. Gates humanos (el dueño): selección de ideas (ejecutar `/pandacorp:scaffold` sobre la elegida; descartar el resto desde Mission Control), elección de diseño, release a producción, gastar dinero, comunicaciones externas, borrar datos. El tablero de ideas es solo-lectura: los estados los escriben los skills.
4. Los agentes nunca marcan sus propios checks: la verificación es de scripts/CI.
5. El estado de cada idea vive SOLO en el frontmatter de su ficha. El estado detallado de cada proyecto vive SOLO en su `docs/status.yaml`. El portfolio solo guarda punteros y resúmenes.
6. Documentar todo: cada decisión relevante se anota en la bitácora del área (ver sección **Bitácora**) antes de cerrar el turno. La bitácora es historia; `registry.yaml` es política.
7. **Marco vs datos del dueño (DR-033).** Distingue siempre tres planos y NUNCA mezcles datos personales con el marco versionado:
   - **El marco** — versionado y compartido, igual para cualquiera que clone el repo: `plugin/`, `factory/constitution.md`, `factory/standards/`, `factory/decisions/registry.yaml`, la app **Mission Control**, plantillas y los seeds `*.example.md`.
   - **Los datos del dueño** — personales y **gitignored**, NUNCA al repo público: `factory/profile.md` (el perfil que genera `/pandacorp:onboarding`; de ahí la fábrica saca nombre, objetivos, intereses, activos, cuenta de GitHub y ruta de proyectos — es la **única fuente** de configuración del usuario), `factory/portfolio.md` y `factory/ideas/*.md`. Secretos/credenciales tampoco van al repo (DR-037).
   - **Los proyectos de producto** — en carpetas/repos **hermanos**, fuera de la fábrica, con su propia documentación en su `docs/`.
