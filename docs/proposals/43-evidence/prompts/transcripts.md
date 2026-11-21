Lee primero `/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/prompts/common.md` y cúmplelo.

# Tarea: reconstruir, desde las transcripciones de sesiones, cada episodio real de merge a main

Fuentes: transcripciones JSONL de Claude Code en `~/.claude/projects/*/*.jsonl` (incluye subcarpetas de subagentes si
existen) y de Codex en `~/.codex/sessions/**/rollout-*.jsonl`. Ventana: desde 2026-11-01 hasta hoy (2026-11-20);
si hay pocos episodios, amplía a octubre. Los archivos son muy grandes: escribe scripts `python3`/`jq`/`rg` que
extraigan solo lo necesario (guárdalos en tu directorio de trabajo). Excluye la sesión que está investigando esto ahora
(la que contiene este mismo texto).

Un **episodio** = una sesión intenta aterrizar un trabajo con `merge-queue.sh` (cualquier llamada de herramienta cuyo
comando contenga `merge-queue.sh`, sin contar `--help`). Para cada episodio extrae:

- proyecto (por el cwd o la ruta), sesión (archivo), fecha;
- qué gate había corrido la sesión ANTES del primer intento de cola y con qué resultado: ¿`verify.sh` completo,
  `--light`, `--only=…`, `--tests=…`, tests sueltos (`vitest`, `playwright`), o ninguno? ¿Hubo una frase tipo
  "listo / todo verde / done" antes del primer intento?
- cada invocación de `merge-queue.sh`: hora de inicio (timestamp del tool_use), hora de fin (timestamp del
  tool_result; si corrió en background, cuando llega la notificación o el resultado), duración, código de salida y
  desenlace: aterrizó / rojo en qué etapa de `verify.sh` y con qué mensaje (cita ≤ 3 líneas) / conflicto de rebase /
  main ocupado / exit 21 (main avanzó) / timeout;
- si la salida muestra `[certified-tree]` o `[full-gate]`;
- entre un rojo y el siguiente intento: qué se cambió (archivos) y con qué se verificó el arreglo antes de volver a la
  cola (gate completo, parcial, un solo test, nada);
- clasificación de la causa de cada rojo, con la evidencia textual: (a) defecto real del propio cambio que el gate
  previo no había corrido; (b) main avanzó / interacción con otro cambio tras el rebase; (c) test inestable o
  dependiente del orden (mismo árbol pasa al reintentar sin cambios); (d) baseline visual; (e) rojo en archivos de
  otra sesión; (f) entorno (worktree sin bootstrap, puertos, base de datos de test, dependencias, caché);
  (g) el arreglo anterior rompió otra cosa; (h) otra/indeterminada;
- tiempo total de pared desde el primer intento de cola (o desde el "listo" previo, si lo hay) hasta el aterrizaje
  o el abandono; número de vueltas.

Entrega `episodes.md` con: (1) tabla de episodios (una fila por episodio) y debajo el detalle por intento;
(2) agregados: nº de episodios, % que aterriza al primer intento, mediana y máximo de tiempo de pared, mediana de
duración de UNA corrida de cola por proyecto, distribución de causas de rojo, cuántos episodios vieron
`[certified-tree]`; (3) los 3 peores episodios narrados en ≤ 8 líneas cada uno con citas; (4) los episodios que SÍ
aterrizaron rápido y qué tenían de distinto; (5) limitaciones del método (qué no se pudo determinar).

Criterio de aceptación: cada episodio cita archivo de transcripción + timestamps; las duraciones salen de timestamps
(medidas), no de impresiones. Al final, re-ejecuta tu script de conteo y confirma que los agregados coinciden con la
tabla. Si no encuentras ninguna invocación, demuestra la búsqueda (comando + conteo) y prueba variantes del nombre
(`merge-queue`, `merge_queue`, `.pandacorp/merge`).
