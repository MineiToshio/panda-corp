<!--
  TEMPLATE for the cross-FRD work-order map (architecture planning stage 2).
  Written by ONE planner into .pandacorp/run/architecture/wo-map.md (runtime scaffolding of the phase; agent-facing,
  English). It is the input every blueprint author follows; once the blueprints and work orders exist, THEY are the
  source of truth (the Build Plan tables + WO frontmatter) and the map is not maintained further.
  Replace every <...>. Keep the section numbers: authors and the reconciler cite them ("map §0.1").
-->

# <product>: cross-FRD work-order map

> Input for the parallel per-FRD blueprint authors. FINAL for coupling, numbering, artifacts, waves, AC ownership and
> installs. Authors refine CMP/IF names, contracts and per-WO prose inside these boundaries; if a boundary is
> impossible, they report it in the ledger instead of re-deciding it. Source-of-truth hierarchy:
> `FRD > FDD > design-tokens > blueprint > work order`. Read against: `docs/product/architecture.md`,
> `docs/product/data-model.json`, the ADRs, `docs/analytics/events.md`, every FRD/FDD, `docs/design/components.md`,
> the installed scaffold and the versions record.

Totals: **<N> work orders** (<FRD-01 n · FRD-02 n · ...>), **<W> waves (W0 to W<W-1>)**, **<F> foundation WOs**,
**<A> ACs, each placed exactly once**. Author split: A = <FRDs>, B = <FRDs>, ...

## 0. Global rules every blueprint and WO inherits

### 0.1 Shared-file ownership (one writer, or serialized writers in different waves)

| File / dir | Writer(s) (wave) | Rule |
|---|---|---|
| `package.json`, lockfile | <WO (W0)>, <WO (W1)>, ... | At most ONE writer per wave; only `pnpm add --save-exact <pkg>@<ver>` from §2 |
| root layout / app shell (`src/app/layout.tsx`) | <foundation shell WO> | DR-075; nobody else edits it |
| env / constants / routes modules | <platform WO> | every env var of architecture.md declared once; `.env.example` is complete (a new var = plan defect) |
| `docs/design/components.md` | <foundation WO>, then <WO (W?)> | rows appended by the WO that creates the component (DR-057) |
| schema + migrations + `docs/product/data-model.json` | <data-layer WO>; later writers serialized | DATA-7 same-change rule |
| `e2e/routes.ts`, `e2e/shell.ts` | <shell WO> | lists every surface up front |
| canonical gate files (`verify.sh`, `biome.json`, `knip.json`, VERBATIM e2e) | nobody | DR-059 |
| shared test folders | per FILE | a WO owns only test files named after its own module |

### 0.2 Data-layer rule
One owning WO per file in the data layer (`src/queries/<model>.ts` writes + simple reads; cross-model reads in a
purpose file owned by the feature WO). The calling convention (client singleton, optional transaction parameter).

### 0.3 Pre-created seams (stub → replaced by its owner)
| Stub (created by) | Replaced by | Contract |
|---|---|---|
| <registry/dispatcher module> (<WO>) | <WO per entry> | an honest "not wired" stub (fails loud), never a fake success |

### 0.4 Other binding conventions
<API contract per backend WO at `docs/api/<wo-id>.md` (DR-060); copy only from the microcopy file; hydration-safe
forms; fidelity gate mode; knip reachability of harness/stub modules; ...>

## 1. Foundation wave

<the design-system primitives and the app shell (DR-057, DR-075), numbered as their owning FRD's WOs with
`foundation: true` (never `WO-00-*`), and what every feature WO may assume exists after it>

## 2. Work-order catalogue

Format per WO: wave · foundation · difficulty · dependsOn · ACs (REQ) · artifacts · API contract · mocks · installs ·
notes.

### FRD-NN <title> (<n> WOs, <a> ACs)

**WO-NN-MMM <title>**
- W<k> · foundation|feature · low|medium|high · dependsOn: [<ids>]
- Summary: <one or two lines: what this slice delivers>
- ACs: <AC-NN-MMM.K, ...> (REQ-NN-MMM) — or "none (enables REQ-...)" for foundation/tooling
- Artifacts: `<glob>`, `<glob>`, `docs/api/WO-NN-MMM.md`
- API contract: `docs/api/WO-NN-MMM.md` (<what it exposes>), consumers: <WO ids>
- Mocks (binding visual spec, DR-054): `docs/frds/<frd>/mocks/<file>.html#<state>` ... | n/a (non-UI)
- Installs: `pnpm add --save-exact <pkg>@<ver>` ... | none
- Notes: <the decisions this WO must not re-open>

## 3. Global DAG

### 3.1 Wave table
| Wave | Work orders |
|---|---|
| W0 | <ids> |

### 3.2 Disjointness within each wave (by design)
<per wave, why the artifacts do not overlap; shared files resolved by §0.1>

### 3.3 Test-side supersession (BL-0051)
<any WO that derogates a blessed test's contract: the re-bless is in the same WO or in a WO that does not dependOn it>

## 4. Granularity
<why each WO is one cohesive view/capability inside the DR-100 band; merges/splits made and why>

## 5. Per-FRD notes for authors
### FRD-NN (author <X>)
<what this author must pay attention to: seams to publish, cross-FRD consumers, oracle states that span FRDs>

## 6. Inconsistencies and gaps found
<numbered; each routed to the architect, the PM (FRD amendment) or the owner>

## 7. AC coverage matrix (<A> ACs, each exactly once)
| FRD | AC → WO |
|---|---|
| FRD-NN (<a>) | <001.1→NN-MMM · 001.2→NN-MMM · ...> |

AC-less WOs (allowed; trace to the REQs they enable): <ids>.

## 8. Lead resolutions of §6 (BINDING; they override §2 where they differ)
1. <resolution>
