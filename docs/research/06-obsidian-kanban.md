# Research: Kanban in Obsidian over frontmatter (2026-06)

## Conclusion

**Yes, it works exactly as the owner imagined**: the **Bases Kanban** plugin (ewerx) on top of Obsidian's native Bases. Dragging a card between columns **writes the new `status:` into the .md file's frontmatter** on disk. Change detection is done via periodic scanning + git diff.

## Key findings

### Obsidian Bases (native, v1.9+)
- Database views over frontmatter, configured in `.base` files (YAML). Native views: table, cards, list — **no native kanban with drag**.
- The Bases API (stable since Obsidian 1.10.6) enabled community plugins that add the kanban view **with frontmatter write-back on drag**:

| Plugin | Writes frontmatter on drag? | Note |
|---|---|---|
| **Bases Kanban** (ewerx) ← chosen | ✅ | The most downloaded; maps Bases→kanban directly |
| Base Board (mderazon) | ✅ | More options (WIP limits, inline editing); handles empty columns better |
| Kanban Bases View (xiwcx) | ✅ | Swimlanes by a second property |
| Classic Kanban plugin (mgmeyers) | ❌ (only with the companion "Status Updater" plugin and wikilink cards) | The board is a separate file; it isn't auto-generated from a folder — discarded |
| Dataview/Datacore | ❌ (read-only / table editing) | discarded for kanban |

- Caveat: in the ewerx plugin, empty columns disappear if no file has that status (alternative: Base Board). Drag on mobile is limited.

### Configuration (`ideas.base` at the root of the panda-corp vault)

```yaml
filters:
  and:
    - 'status != null'
properties:
  status: {displayName: "Estado"}
  project_type: {displayName: "Tipo"}
  score: {displayName: "Score"}
views:
  - type: kanban            # registered by the bases-kanban plugin
    name: "Pipeline Ideas"
    groupBy: {property: status, direction: ASC}
    order: [score, file.name]
```

### Change detection (factory side)

Three layers, from simple to sophisticated:
1. **Periodic scan with cache** (recommended to start): a script compares the current `status:` against the previous snapshot; runs via cron/launchd or as part of the `/actualizar-portfolio` skill. Zero dependencies.
2. **git diff**: the obsidian-git plugin auto-commits every N min; a post-commit hook greps `^[+-]status:` and triggers the agent. Free audit trail.
3. **fswatch (macOS)** for real time: filter out temporary `.!*` files (Obsidian writes atomically: temp + rename) and exclude `.obsidian/`.

Pitfalls: ignore `.obsidian/workspace.json` and `plugins/*/data.json` in git (noise); filter out `.!*` file events.

### Programmatic writing (agent → vault)
- **obsidian-local-rest-api** (coddingtonbear) + **obsidian-mcp-server** (cyanheads): an MCP with an `obsidian_manage_frontmatter` tool so agents can read/write statuses without touching files by hand. Optional — agents can also edit the frontmatter directly with Edit, which is simpler and sufficient at first.

Sources: [Bases syntax](https://obsidian.md/help/bases/syntax) · [ewerx/obsidian-bases-kanban](https://github.com/ewerx/obsidian-bases-kanban) · [mderazon/obsidian-base-board](https://github.com/mderazon/obsidian-base-board) · [obsidian-git](https://github.com/Vinzent03/obsidian-git) · [local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api) · [obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) · [Bases guide 2026](https://got.md/obsidian-bases/)
