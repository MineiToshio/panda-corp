#!/usr/bin/env bash
# SessionStart hook — recordatorio de la disciplina de bitácora ("documentar todo").
# Inyecta como contexto, al abrir cada sesión, la regla de anotar decisiones por área.
# La regla canónica vive en CLAUDE.md (sección "Bitácora"); esto solo la mantiene top-of-mind.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"📓 Bitácora activa — documentar todo. Ante cualquier decisión relevante (algo que el dueño decide, un cambio de rumbo, una convención nueva, algo no obvio que hicimos y su porqué), anótalo en la bitácora del área ANTES de cerrar el turno — fecha, qué, por qué: cockpit→cockpit/docs/bitacora.md, plugin→plugin/docs/bitacora.md, ideas→fabrica/ideas/bitacora.md, fábrica→fabrica/bitacora.md. Índice: BITACORA.md. Bitácora = historia (qué/por qué); fabrica/decisiones/registro.yaml = política (reglas con default). No anotar cambios triviales ya evidentes en el commit."}}
JSON
