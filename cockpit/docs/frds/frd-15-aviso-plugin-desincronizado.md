# FRD-15 — Aviso de plugin desincronizado

Caza el despiste más común: editar el plugin de la fábrica y olvidar commitear / correr `claude plugin update`. El cockpit detecta el desfase entre el plugin **instalado** y el **código fuente** del repo, y avisa. Solo-lectura (lee archivos + git local; no llama a Claude).

## Cómo se detecta (todo local)

- **Versión instalada**: leer `~/.claude/plugins/installed_plugins.json` → la `version` de `pandacorp@panda-corp` (un SHA de commit, scope usuario). Lo mismo que muestra `claude plugin list`.
- **Estado del código fuente** en el repo de la fábrica:
  - último commit que tocó el plugin: `git log -1 --format=%H -- plugin/`
  - ¿hay cambios sin commitear?: `git status --porcelain -- plugin/`

## Criterios de aceptación (EARS)

- SI hay **cambios sin commitear** bajo `plugin/`, el cockpit DEBERÁ mostrar un **aviso persistente** arriba: "Plugin desincronizado — hay cambios sin commitear".
- SI el **SHA instalado ≠ último commit que tocó `plugin/`** (commiteado pero no reinstalado), DEBERÁ mostrar el aviso: "El plugin instalado está atrasado".
- EL aviso DEBERÁ mostrar el **comando para copiar** `claude plugin update pandacorp@panda-corp` y recordar la secuencia (commitea si hace falta → corre el comando → reinicia la sesión de Claude Code).
- EL aviso DEBERÁ **desaparecer solo** cuando el plugin vuelva a estar sincronizado (sin cambios sin commitear y SHA instalado == último commit del plugin).
- EL aviso NO DEBERÁ ejecutar nada (solo-lectura): muestra el comando, el dueño lo corre.

## No-objetivos
- No corre `git` ni `plugin update` por el dueño. No instala nada.

## Nota de implementación
En la app real (Next.js), un endpoint server-side hace los reads de archivo/git y devuelve el estado; el prototipo lo simula con un flag (`PLUGIN_SYNC`). Ver la regla de mantenimiento del plugin en el `CLAUDE.md` de la fábrica.
