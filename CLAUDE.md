# Pandacorp — Fábrica de software 100% IA

Este repo es **la fábrica**: el know-how de la empresa. Aquí NUNCA vive código de producto.

## Qué hay aquí

- `fabrica/constitucion.md` — principios y estándares innegociables. **Léela antes de cualquier trabajo de fábrica.**
- `fabrica/estandares/` — estándares de ingeniería que se inyectan en cada proyecto (convenciones, estructura, patrones, calidad, stack recomendado). El stack es sugerencia; se elige y aprueba en el blueprint.
- `fabrica/ideas/` — base de ideas (una ficha .md por idea, frontmatter con `estado`)
- `fabrica/portfolio.md` — índice de proyectos creados y su estado (punteros, no contenido)
- `fabrica/decisiones/registro.yaml` — registro de decisiones con defaults pre-aprobados
- `plugin/` — el plugin `pandacorp` (skills, agentes, hooks, plantillas). Symlinked a `~/.claude/skills/pandacorp`
- `docs/` — visión, investigación y propuestas
- `ideas.base` — vista kanban de Obsidian sobre la base de ideas

## Cómo se opera la fábrica

| Acción | Skill |
|---|---|
| Explorar/aclarar una idea difusa en conversación (descubierta) | `/pandacorp:explore [tema]` |
| Capturar/cristalizar una idea de Sergio (one-shot o desde lo conversado) | `/pandacorp:new-idea` |
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

**Iterar sin avanzar (DR-032).** Ninguna fase manual (`explore`, `new-idea`, `spec`, `design`, `blueprint`) auto-avanza de columna: produce su output, marca `avance_pendiente: true` y espera tu "ok, avanza". **Re-correr la misma fase = seguir puliendo** (refina, no regenera ni repite lo descartado). La esencia del ida-y-vuelta se persiste en `docs/iteracion.md` del proyecto (en ideas sin proyecto: `fabrica/ideas/_borradores/<slug>.md`), para retomar aunque pierdas la conversación. No aplica a `implement` (autónomo, ya reanudable) ni cambia el gate de producción.

## Mantenimiento del plugin

El plugin está instalado desde el marketplace local de este repo (`claude plugin install pandacorp@panda-corp`, scope usuario, versión = SHA del commit). **Tras editar cualquier cosa en `plugin/`**: commitear y correr `claude plugin update pandacorp@panda-corp` (los cambios aplican al reiniciar sesión). Validar con `claude plugin validate plugin/`.

El cockpit **avisa del desfase** (FRD-15): si hay cambios en `plugin/` sin commitear, o el SHA instalado (`~/.claude/plugins/installed_plugins.json`) quedó atrás del último commit del plugin, muestra un banner con el comando de actualización. Así no se olvida.

## Reglas de esta carpeta

1. Idioma: documentos en español; código, commits y nombres de archivos técnicos en inglés.
2. Toda decisión recurrente se resuelve consultando `fabrica/decisiones/registro.yaml`. Si no está cubierta: escalar a Sergio UNA vez y codificar su respuesta como regla nueva en el registro.
3. Gates humanos (Sergio): selección de ideas (ejecutar `/pandacorp:scaffold` sobre la elegida; descartar el resto desde el cockpit), elección de diseño, release a producción, gastar dinero, comunicaciones externas, borrar datos. El tablero de ideas es solo-lectura: los estados los escriben los skills.
4. Los agentes nunca marcan sus propios checks: la verificación es de scripts/CI.
5. El estado de cada idea vive SOLO en el frontmatter de su ficha. El estado detallado de cada proyecto vive SOLO en su `docs/estado.yaml`. El portfolio solo guarda punteros y resúmenes.
