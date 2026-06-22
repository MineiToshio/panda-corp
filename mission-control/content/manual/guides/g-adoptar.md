---
title: "Adoptar un proyecto que ya tienes"
group: guides
order: 8
---

# Adoptar un proyecto que ya tienes

¿Tienes un proyecto que NO nació del handoff de Pandacorp —uno externo, brownfield— y quieres meterlo bajo la fábrica? Para eso está `/pandacorp:adopt`. Es el espejo brownfield de `scaffold` (greenfield): en vez de crear un proyecto vacío, **envuelve lo que ya existe**, para que desde entonces los skills `/pandacorp:*`, Mission Control y el write-gate apliquen sobre él. Se corre **DENTRO** de la carpeta del proyecto existente.

> El cuerpo paso a paso se compone en React (`GuideAdoptar`); este markdown respalda el índice del Manual.

- **Tocar un proyecto existente = gate humano.** adopt presenta el **plan de adopción** y espera tu OK antes de escribir nada (DR-045, DR-038).
- **Lee el proyecto para entenderlo (sin escribir aún).** Inspecciona stack, estructura, `git log` y `git remote` para inferir la **fase real** a partir del código: deploy vivo / CI a prod / URL de producción → `operation`; código sustancial + tests pero sin deploy → `implementation`; solo boilerplate → `architecture`. Declara la inferencia **y su evidencia**.
- **Inyecta el overlay SIN pisar.** Copia las plantillas (`CLAUDE.md`, `AGENTS.md`, `.pandacorp/`) pero nunca sobrescribe: ficheros nuevos se copian; si ya tienes `CLAUDE.md`, **añade** las líneas de import sin tocar tu contenido; `.pandacorp/guide.md` siempre se (re)escribe (es regenerable).
- **Reconstruye docs as-built mínimas** para que el proyecto tenga la documentación base que el resto de skills esperan.
- **Registra en la fábrica.** Crea una **ficha de idea retroactiva** `factory/ideas/<slug>.md` (`status: in-pipeline`, `project:` con la ruta absoluta, `return_type`, nota "proyecto externo adoptado"), la copia a `.pandacorp/idea-origin.md`, y añade la fila al `factory/portfolio.md`.
- **Hace el handoff a los skills normales.** Desde ahí operas el proyecto como cualquier otro: `/pandacorp:iterate`, `/pandacorp:implement`, `/pandacorp:release`…

**Enlaces:** tras adoptar, el proyecto aparece en el Portfolio de Mission Control con su fase inferida, igual que un proyecto nacido del handoff.
