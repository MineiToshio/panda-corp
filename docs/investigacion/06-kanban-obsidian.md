# Investigación: Kanban en Obsidian sobre frontmatter (2026-06)

## Conclusión

**Sí funciona exactamente como el dueño lo imaginó**: plugin **Bases Kanban** (ewerx) sobre las Bases nativas de Obsidian. Arrastrar una tarjeta entre columnas **escribe el nuevo `estado:` en el frontmatter del archivo .md** en disco. La detección del cambio se hace por escaneo periódico + git diff.

## Hallazgos clave

### Obsidian Bases (nativo, v1.9+)
- Vistas de base de datos sobre frontmatter, configuradas en archivos `.base` (YAML). Vistas nativas: tabla, cards, lista — **sin kanban nativo con drag**.
- La API de Bases (estable desde Obsidian 1.10.6) permitió plugins comunitarios que añaden la vista kanban **con write-back de frontmatter al arrastrar**:

| Plugin | ¿Escribe frontmatter al arrastrar? | Nota |
|---|---|---|
| **Bases Kanban** (ewerx) ← elegido | ✅ | El más descargado; mapea Bases→kanban directo |
| Base Board (mderazon) | ✅ | Más opciones (WIP limits, edición inline); maneja mejor columnas vacías |
| Kanban Bases View (xiwcx) | ✅ | Swimlanes por segunda propiedad |
| Plugin Kanban clásico (mgmeyers) | ❌ (solo con plugin compañero "Status Updater" y tarjetas-wikilink) | El board es un archivo aparte; no se autogenera de una carpeta — descartado |
| Dataview/Datacore | ❌ (solo lectura / edición en tabla) | descartado para kanban |

- Caveat: en el plugin ewerx las columnas vacías desaparecen si ningún archivo tiene ese estado (alternativa: Base Board). Drag en móvil limitado.

### Configuración (`ideas.base` en la raíz del vault panda-corp)

```yaml
filters:
  and:
    - 'estado != null'
properties:
  estado: {displayName: "Estado"}
  tipo: {displayName: "Tipo"}
  score: {displayName: "Score"}
views:
  - type: kanban            # registrado por el plugin bases-kanban
    name: "Pipeline Ideas"
    groupBy: {property: estado, direction: ASC}
    order: [score, file.name]
```

### Detección de cambios (lado fábrica)

Tres capas, de simple a sofisticada:
1. **Escaneo periódico con caché** (recomendado para empezar): script compara `estado:` actual vs snapshot anterior; corre por cron/launchd o como parte del skill `/actualizar-portfolio`. Cero dependencias.
2. **git diff**: plugin obsidian-git auto-comitea cada N min; hook post-commit grep-ea `^[+-]estado:` y dispara al agente. Audit trail gratis.
3. **fswatch (macOS)** para tiempo real: filtrar archivos temporales `.!*` (Obsidian escribe atómico: temp + rename) y excluir `.obsidian/`.

Pitfalls: ignorar en git `.obsidian/workspace.json` y `plugins/*/data.json` (ruido); filtrar eventos de archivos `.!*`.

### Escritura programática (agente → vault)
- **obsidian-local-rest-api** (coddingtonbear) + **obsidian-mcp-server** (cyanheads): MCP con herramienta `obsidian_manage_frontmatter` para que los agentes lean/escriban estados sin tocar archivos a mano. Opcional — los agentes también pueden editar el frontmatter directamente con Edit, que es más simple y suficiente al inicio.

Fuentes: [Bases syntax](https://obsidian.md/help/bases/syntax) · [ewerx/obsidian-bases-kanban](https://github.com/ewerx/obsidian-bases-kanban) · [mderazon/obsidian-base-board](https://github.com/mderazon/obsidian-base-board) · [obsidian-git](https://github.com/Vinzent03/obsidian-git) · [local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api) · [obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) · [Guía Bases 2026](https://got.md/obsidian-bases/)
