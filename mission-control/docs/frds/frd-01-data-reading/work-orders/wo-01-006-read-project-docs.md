# WO-01-006 — `readProjectDocs` (feature-centric tree discovery)

**Module:** `lib/docs.ts`
**IDs touched:** `CMP-01-docs`, `IF-01-readProjectDocs`; REQ-01-007
**Dependencies:** WO-01-000 (fixtures), WO-01-001 (`pathExists`)

## EARS criteria (from FRD-01)

- AC-01-007.1 — The system SHALL read, per project, the feature-centric product documents in
  `docs/` (DR-049): the product layer (`docs/product/prd.md` + `docs/product/architecture.md`), each
  feature module under `docs/frds/frd-NN-<slug>/` (`frd.md`, and when present `fdd.md`,
  `blueprint.md`, `mocks/`, `work-orders/`), plus global `docs/adr/`, `docs/analytics/`,
  `docs/decision-log.md`, and the owner-facing `.pandacorp/` layer (`comms/progress.md`,
  `inbox/decisions.md`, `inbox/bugs/`).

## Contract

```ts
type FrdModule = {
  slug: string; hasFdd: boolean; hasBlueprint: boolean; hasMocks: boolean; hasWorkOrders: boolean;
};
type ProjectDocsIndex = {
  prd?: string; architecture?: string;   // present-path of each product-layer doc
  frds: FrdModule[];
  hasAdr: boolean; hasAnalytics: boolean; hasDecisionLog: boolean;
  comms: { progress?: string; decisions?: string; bugs: string[] };
};

export function readProjectDocs(projectPath: string): ProjectDocsIndex;
```

- **Discovery, not full ingestion:** report which docs exist (and their paths) so FRD-04/05/08 can
  read content on demand. (Heavy content reads belong to those features' `lib/docs`/`work-orders`
  usage; here we index the tree.)
- Enumerate `docs/frds/frd-*` dirs → one `FrdModule` each, probing for the optional artifacts.
- Tolerate any missing layer: absent → empty array / `false` / `undefined`. Never throws.

## Definition of done

- `lib/docs.test.ts` (RED first) against `proj-a`:
  - `prd` and `architecture` paths present.
  - `frds` contains `frd-01-x` with `hasBlueprint: true`, `hasWorkOrders: true`.
  - `hasAdr`, `hasDecisionLog` true; `comms.progress`, `comms.decisions` present; `comms.bugs` has 1.
  - A project with only a bare `docs/` → mostly empty index, no throw.
- No write; fail-soft per blueprint §3.
- `.pandacorp/verify.sh` green.
