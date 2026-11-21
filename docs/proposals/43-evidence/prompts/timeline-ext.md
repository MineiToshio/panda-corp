Lee primero `/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/prompts/common.md` y cúmplelo.

# Tarea: línea de tiempo real de merges en funko-tracker y personal-page-v2

Localiza ambos proyectos en `/Users/Shared/Proyectos/panda-corp/factory/portfolio.md` (y sus worktrees con
`git -C <proyecto> worktree list`). Lee `.pandacorp/status.yaml` de cada uno: anota `phase`, si está lanzado
(externo/interno) y `overlay_version`.

Produce `timeline-ext.md` en tu directorio de trabajo, con una sección por proyecto, cada una con:

1. **Inventario de fuentes**: contenido de `.pandacorp/run/` del checkout principal y de cada worktree (nombres,
   tamaños, fechas): `gate-report.json` (y cualquier histórico), logs de `merge-queue.sh`, `green-stamp`, locks/leases.
   Lee `merge-queue.sh` y `verify.sh` solo lo necesario para saber DÓNDE escriben logs y qué marcas dejan
   (`[full-gate]`, `[certified-tree]`, códigos de salida como 21) y busca esos logs.
2. **Tiempo por etapa de `verify.sh`**: tabla etapa → duración por cada `gate-report.json` o log hallado, con fecha,
   modo (full / `--light` / `--only`), verde o rojo y etapa fallida. Si hay varios, min/mediana/máx por etapa.
3. **Corridas de la cola**: cada ejecución de `merge-queue.sh` con rastro: inicio, fin, duración, rama, resultado
   (aterrizó / rojo en qué etapa / conflicto de rebase / main ocupado / exit 21) y si usó `[certified-tree]` o
   `[full-gate]`. Cuenta árbol certificado aprovechado vs gate completo.
4. **Historial git** (`git log --since='3 weeks ago' --date=iso` y `git reflog --date=iso` de main): secuencias de
   commits `fix`/"gate"/"flaky"/"baseline"/"snapshot" pegadas a un trabajo declarado terminado (señal de vueltas
   rojo → arreglo → rojo), con hash, hora, mensaje; y tiempo entre el último commit de trabajo y la llegada a main
   cuando se pueda inferir.
5. **Estado vivo ahora**: locks, leases o procesos de build/implement vivos (archivos en `.pandacorp/run/`,
   `ps aux | rg -i 'verify.sh|merge-queue|playwright|vitest|pandacorp-build'`). Solo reporta.
6. **Huecos**: qué no deja rastro y no se puede medir a posteriori.

Criterio de aceptación: cada fila cita su fuente (ruta + línea o timestamp). Comprueba al final que las sumas por
etapa cuadran con la duración total reportada (o explica la diferencia).
