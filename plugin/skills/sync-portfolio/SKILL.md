---
description: Sincroniza el portfolio de Pandacorp - detecta tarjetas movidas en el kanban de ideas (cambios de estado en frontmatter) y refresca el estado de cada proyecto leyendo su status.yaml. Usar en panda-corp, a demanda o como job periódico.
---

# /pandacorp:sync-portfolio

Sincronización fábrica ↔ proyectos. Se ejecuta EN panda-corp.

## Parte 1 — Detectar tarjetas movidas (kanban → acciones)

1. Corre el escáner de estados:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/scan-ideas.sh"
   ```
   Compara el `estado:` actual de cada ficha contra el snapshot anterior (`.pandacorp-cache/ideas-snapshot.txt`) y lista los cambios.
2. Por cada cambio detectado, actúa según el estado NUEVO:
   - `seleccionada` → avisa al dueño que está lista para `/pandacorp:scaffold <idea>` (o ejecútalo si el dueño pidió modo automático)
   - `descartada` → verifica que la ficha tenga el racional anotado (DR-011)
   - otros cambios → solo regístralos en el reporte

## Parte 2 — Refrescar el portfolio (proyectos → fábrica)

3. Por cada fila de `factory/portfolio.md`: lee el `docs/status.yaml` del proyecto siguiendo su ruta y actualiza fase/resumen/fecha de sync.
4. **Ruta rota** (carpeta movida o borrada): NO borres la fila — márcala `⚠️ ruta no encontrada` y pregunta al dueño.
5. Consistencia: si un proyecto está `lanzada` pero su ficha de idea no, corrige la ficha (y viceversa, reporta la discrepancia).

## Parte 3 — Reporte

6. Resumen corto: tarjetas movidas y acción tomada, estado de cada proyecto activo, discrepancias encontradas.

## Reglas
- Este skill está diseñado para correr sin interacción (job diario futuro): cuando no haya humano presente, solo reporta y registra — no ejecuta scaffolds automáticos salvo instrucción previa explícita.
