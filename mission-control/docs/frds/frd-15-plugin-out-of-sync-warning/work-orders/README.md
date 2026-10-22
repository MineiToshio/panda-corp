# Work orders — FRD-15 Plugin out-of-sync warning

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> The authoritative order is the **Build Plan** in [`../blueprint.md`](../blueprint.md). FRD-15 has no
> new v2 work order: its reader and route stay live as built; the Inicio banner is built by FRD-18's
> WO-18-002 and the sidebar pill by FRD-19's WO-19-003.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-15-001 | sync-readers | VERIFIED | — | Installed and source version readers, defensive, never throw (kept live, built) |
| WO-15-002 | sync-verdict | VERIFIED | WO-15-001 | `getPluginSyncState()` semver verdict with per-runtime adapters (kept live, built) |
| WO-15-003 | sync-route | VERIFIED | WO-15-002 | `GET /api/plugin-sync`, uncacheable, always 200, read-only (kept live, built) |

> **Depends on** mirrors each WO's `dependsOn` frontmatter (DR-087).

## Build order

- W0 WO-15-001 → W1 WO-15-002 → W2 WO-15-003, all VERIFIED and not rebuilt.
- Cross-FRD owners of FRD-15's ACs: WO-18-002 (FRD-18, W5: the banner) and WO-19-003 (FRD-19, W6: the
  pill). WO-01-011 (W5) moves the route's reads onto the clock and git seams without behaviour change.

## AC coverage

| AC | Work order |
|---|---|
| AC-15-002.1 | WO-18-002 |
| AC-15-002.2 | WO-18-002 |
| AC-15-002.3 | WO-18-002 |
| AC-15-004.1 | WO-18-002 |
| AC-15-006.1 | WO-19-003 |

## Superseded (v1 history)

- WO-15-004 (`PluginSyncBanner` on the v1 `Banner`) → WO-18-002
