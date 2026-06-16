# WO-01-001 — `pathExists` read-only probe

**Module:** `lib/fs-utils.ts` (new tiny module — see report)
**IDs touched:** `IF-01-pathExists`; REQ-01-010
**Dependencies:** WO-01-000 (fixtures)

## EARS criteria (from FRD-01)

- AC-01-010.1 — IF a project's path does not exist, THEN the system SHALL mark it as not found and
  SHALL NOT break the rest of the view.

## Contract

```ts
export function pathExists(p: string): boolean;   // never throws; false on absent or on error
```

Read-only existence probe used by `readStatus`, `readProjectDocs` and the FRD-03 not-found badge.
Synchronous (Server Component friendly), backed by `fs.existsSync` wrapped to swallow errors.

## Definition of done

- `lib/fs-utils.test.ts` (RED first): returns `true` for a known fixture path, `false` for a
  non-existent path, `false` (no throw) for an invalid/permission-error path.
- Never writes, never throws.
- `.pandacorp/verify.sh` green.
