# Contexto común (léelo entero)

Investigación de SOLO LECTURA para el dueño de la fábrica de software "Pandacorp". Pregunta de fondo: por qué
hacer merge a `main` con `.pandacorp/merge-queue.sh` tarda de 30 min a más de una hora (a veces una mañana) cuando
la implementación ya dijo "lista, todo verde", y cuántas vueltas de "rojo → arreglo → rojo" ocurren.

Rutas:
- Fábrica: `/Users/Shared/Proyectos/panda-corp` (plugin en `plugin/`, decisiones en `factory/decisions/registry.yaml`,
  estándares en `factory/standards/`, rutas de proyectos en `factory/portfolio.md`).
- Mission Control: `/Users/Shared/Proyectos/panda-corp/mission-control` (comparte el `.git` de la fábrica).
- funko-tracker y personal-page-v2: sus rutas están en `factory/portfolio.md`.
- Cada proyecto trae en `.pandacorp/`: `merge-queue.sh` (rebase serializado → gate de integración → fast-forward),
  `verify.sh` (gate completo; `--light` para el hook Stop), `green-stamp.sh` (árbol certificado, DR-146),
  `change-reconcile.mjs`, y estado en `.pandacorp/run/` (p. ej. `gate-report.json`, logs de la cola, `green-stamp`).
- Los worktrees de sesiones pueden tener su propio `.pandacorp/run/` (usa `git worktree list`).

Límites duros:
- NO edites, crees ni borres nada dentro de los proyectos ni de la fábrica. NO hagas commit ni push.
- NO ejecutes `verify.sh`, `merge-queue.sh`, tests, builds ni servidores: en esta ola solo se leen artefactos existentes.
- Solo puedes escribir en tu directorio de trabajo actual (scratch). Deja ahí tu informe y los scripts que uses.
- Los archivos de log/transcripción son grandes: usa `rg`, `jq`, `python3` con filtros; no vuelques archivos enteros.

Reglas de evidencia:
- Cada cifra lleva la etiqueta **medida** (con ruta del archivo + línea/timestamp/comando que la produjo) o **estimada**
  (con el razonamiento). Nunca presentes una estimación como medida.
- Si un artefacto que esperabas no existe, dilo explícitamente ("no existe X; busqué en A, B, C") y rodea el hueco con
  otra fuente. No inventes.
- Tu mensaje final es un resumen de ≤ 40 líneas con los hallazgos clave y la ruta del informe completo.
