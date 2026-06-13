# Pandacorp — Fábrica de software 100% IA

Este repo es **la fábrica**: el know-how de la empresa. Aquí NUNCA vive código de producto.

## Qué hay aquí

- `fabrica/constitucion.md` — principios y estándares innegociables. **Léela antes de cualquier trabajo de fábrica.**
- `fabrica/ideas/` — base de ideas (una ficha .md por idea, frontmatter con `estado`)
- `fabrica/portfolio.md` — índice de proyectos creados y su estado (punteros, no contenido)
- `fabrica/decisiones/registro.yaml` — registro de decisiones con defaults pre-aprobados
- `plugin/` — el plugin `pandacorp` (skills, agentes, hooks, plantillas). Symlinked a `~/.claude/skills/pandacorp`
- `docs/` — visión, investigación y propuestas
- `ideas.base` — vista kanban de Obsidian sobre la base de ideas

## Cómo se opera la fábrica

| Acción | Skill |
|---|---|
| Capturar una idea de Sergio | `/pandacorp:new-idea` |
| Buscar dolores monetizables en internet | `/pandacorp:discover` |
| Pedir ranking/recomendación de ideas | `/pandacorp:recommend` |
| Crear el proyecto de una idea seleccionada | `/pandacorp:scaffold` |
| Sincronizar portfolio y detectar tarjetas movidas | `/pandacorp:sync-portfolio` |

Las fases de producto (`/pandacorp:spec`, `:design`, `:blueprint`, `:work-orders`, `:implement`, `:release`, `:new-version`) se ejecutan **dentro de la carpeta del proyecto**, nunca aquí.

## Mantenimiento del plugin

El plugin está instalado desde el marketplace local de este repo (`claude plugin install pandacorp@panda-corp`, scope usuario, versión = SHA del commit). **Tras editar cualquier cosa en `plugin/`**: commitear y correr `claude plugin update pandacorp@panda-corp` (los cambios aplican al reiniciar sesión). Validar con `claude plugin validate plugin/`.

## Reglas de esta carpeta

1. Idioma: documentos en español; código, commits y nombres de archivos técnicos en inglés.
2. Toda decisión recurrente se resuelve consultando `fabrica/decisiones/registro.yaml`. Si no está cubierta: escalar a Sergio UNA vez y codificar su respuesta como regla nueva en el registro.
3. Gates humanos (Sergio): selección de ideas (ejecutar `/pandacorp:scaffold` sobre la elegida; descartar el resto desde el cockpit), elección de diseño, release a producción, gastar dinero, comunicaciones externas, borrar datos. El tablero de ideas es solo-lectura: los estados los escriben los skills.
4. Los agentes nunca marcan sus propios checks: la verificación es de scripts/CI.
5. El estado de cada idea vive SOLO en el frontmatter de su ficha. El estado detallado de cada proyecto vive SOLO en su `docs/estado.yaml`. El portfolio solo guarda punteros y resúmenes.
