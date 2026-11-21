Lee primero `/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/prompts/common.md` y cúmplelo.

# Tarea: línea de tiempo real de merges en Mission Control

Proyecto: `/Users/Shared/Proyectos/panda-corp/mission-control` (y sus worktrees: `git -C /Users/Shared/Proyectos/panda-corp worktree list`).

Produce `timeline-mc.md` en tu directorio de trabajo con:

1. **Inventario de fuentes**: qué hay en `.pandacorp/run/` del checkout principal y de cada worktree (nombres, tamaños,
   fechas): `gate-report.json` (y cualquier histórico), logs de `merge-queue.sh`, `green-stamp`, locks/leases. Lee
   `merge-queue.sh` y `verify.sh` solo lo necesario para saber DÓNDE escriben logs y qué marcas dejan
   (`[full-gate]`, `[certified-tree]`, códigos de salida como 21) y busca esos logs ahí.
2. **Tiempo por etapa de `verify.sh`**: tabla etapa → duración, de cada `gate-report.json` (o log) que encuentres, con
   fecha, si fue full / `--light` / `--only`, verde o rojo, y la etapa que falló. Si hay varios reportes, da min/mediana/máx.
3. **Corridas de la cola**: cada ejecución de `merge-queue.sh` que dejó rastro: inicio, fin, duración, rama, resultado
   (aterrizó / rojo en qué etapa / conflicto de rebase / main ocupado / exit 21), y si usó `[certified-tree]` o `[full-gate]`.
   Cuenta cuántas veces se aprovechó el árbol certificado frente a cuántas corrió el gate completo.
4. **Historial git** (últimas 3 semanas, `git log --since='3 weeks ago' --date=iso -- mission-control`): detecta secuencias
   de commits tipo `fix`/"gate"/"flaky"/"baseline"/"snapshot" que siguen de cerca a un trabajo declarado terminado
   (señal de vueltas rojo → arreglo → rojo). Da ejemplos con hash, hora y mensaje, y el tiempo entre el primer commit del
   trabajo y su llegada a main cuando se pueda inferir (reflog: `git reflog --date=iso` de main).
5. **Estado vivo ahora**: ¿hay locks, leases o procesos de build/implement vivos en este proyecto? (archivos en
   `.pandacorp/run/`, `ps aux | rg -i 'verify.sh|merge-queue|playwright|vitest|pandacorp-build'`). Solo reporta.
6. **Huecos**: qué no deja rastro y por tanto no se puede medir a posteriori.

Criterio de aceptación: cada fila de cada tabla cita su fuente (ruta + línea o timestamp). Comprueba tú mismo al final
que las sumas por etapa cuadran con la duración total reportada (o explica la diferencia).
