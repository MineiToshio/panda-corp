# Fixture: cross-FRD work-order map

## 0. Global rules every blueprint and WO inherits

| File / dir | Writer(s) (wave) | Rule |
|---|---|---|
| `package.json` | WO-01-001 (W0) | one writer per wave |

## 1. Foundation wave

WO-01-001 builds the shell.

## 2. Work-order catalogue

### FRD-01 Shell (1 WO, 2 ACs)

**WO-01-001 App shell**
- W0 · foundation · medium · dependsOn: []
- Installs: `pnpm add --save-exact next@16.0.0`

### FRD-02 List (1 WO, 1 AC)

**WO-02-001 List**
- W1 · feature · low · dependsOn: [WO-01-001]

## 3. Global DAG

| Wave | Work orders |
|---|---|
| W0 | WO-01-001 |
| W1 | WO-02-001 |

## 5. Per-FRD notes for authors

### FRD-02 (author B)

Reads the goal from FRD-01's seam.

## 8. Lead resolutions of §6 (BINDING; they override §2 where they differ)

1. The list route is `/lista`.
