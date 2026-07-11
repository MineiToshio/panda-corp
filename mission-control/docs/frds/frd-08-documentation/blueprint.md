---
id: FRD-08-blueprint
type: blueprint
parent: FRD-08
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-21'
---
# FRD-08 — Documentation (the Manual / "Códice del gremio") · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **per-FRD blueprint** (DR-049). It references the
> **[platform architecture](../../product/architecture.md)** (the `lib/**` data layer §6, the
> read-only invariant §1/§7, the app surface §11 `app/manual`) and the
> **[FRD-07 blueprint](../frd-07-configuration/blueprint.md)** (which owns the same derivation
> readers). Read those first.

## 1. Feature summary

A navigable factory **Manual** inside Mission Control — the **operable surface of the factory's
know-how**, organized with **Diátaxis**: Tutorial ("Empezar aquí"), How-to ("Guías"), Reference
("Referencia"), Explanation ("Conceptos"). It must be sufficient for someone with **no prior
context** (including a handoff to another person) to understand and operate the factory.

The defining architectural constraint (DR-046): the **Reference catalogs** — commands (skills),
agents (party), decision rules, standards — are **DERIVED from the canonical source at build/read
time**, never a hand-maintained copy, so a new/renamed/removed skill, agent, rule or standard
appears automatically with **zero drift**. The hand-authored **Tutorial / Guides / Concepts** pages
are kept in sync by the documentation discipline (a change to how the factory is operated updates
the affected page in the same change — root `CLAUDE.md` "Decision log").

## 2. How the Reference is DERIVED (the DR-046 core)

The Reference **reuses the exact same readers** that FRD-07 introduces (architecture §6) — there is
**one** derivation path, not two:

| Reference catalog | Reader (owned by FRD-07) | Canonical source |
|---|---|---|
| Commands (skills) | `IF-07-reference` → `readSkills()` | `plugin/skills/<slug>/SKILL.md` (slug = dir name, `description` frontmatter) |
| Agents (party) | `IF-07-reference` → `readAgents()` | `plugin/agents/<id>.md` (`name`, `description`, `model`) |
| Decision rules | `IF-07-registry` → `readDecisionRules()` | `factory/decisions/registry.yaml` |
| Standards | `IF-07-standards` → `readStandards()` | `factory/standards/*.md` (+ derivation gap, FRD-07 §6) |

**Build/read-time, not hand copy.** In Mission Control these are Server Components that call the
readers on each render (the factory repo is the read-only database, architecture §1) — equivalent to
build-time derivation for a static export. The acceptance test for DR-046 is: **adding/renaming a
skill/agent/rule/standard in the factory makes it appear/rename in the Reference with no edit to any
Manual file.** FRD-08 owns the **presentation** of these catalogs in the Manual's Reference section;
FRD-07 owns the readers and the Configuration presentation. They share the readers; they do not
duplicate them.

> The prototype reconciles `CONFIG.{skills,agents,rules,estandares}` **by hand** (a stopgap). The
> Next.js Manual MUST replace that with the live derivation above (Mission Control decision-log
> 2026-06-15). A hand-maintained catalog array in the real app is the anti-pattern this FRD forbids.

## 3. Where the hand-authored pages live (Diátaxis)

Tutorial / Guides / Concepts are **content**, not derived. They are authored as markdown/MDX inside
Mission Control and rendered by the reading area. The page set (from the FRD AC + prototype
`DOCNAV`), grouped by Diátaxis quadrant:

- **Empezar aquí (Tutorial):** "Cómo empezar" (first run → first command).
- **Guías (How-to):** "Cómo operas a diario", "Cómo se construye", "Cómo hand-off a otra persona".
- **Referencia (Reference, DERIVED):** Commands · Agents · Decision rules · Standards (§2).
- **Conceptos (Explanation):** "Qué es Pandacorp", "El pipeline", "El equipo", "Estándares y reglas",
  "Arquitectura del sistema", "Mission Control por dentro", "Estado y archivos", "Hooks/gates/seguridad",
  "Stacks (golden paths)", "Construcción desatendida", "El plugin", "Autoaprendizaje".

**DR-049 currency (AC):** any Concept/Guide page that describes a project's documentation structure
SHALL reflect the **feature-centric** layout — the product layer (`docs/product/`), per-feature
module folders `docs/frds/frd-NN-<slug>/` (`frd.md` + on-demand `fdd.md`/`blueprint.md`/`mocks/`/
`work-orders/`), the global `docs/{adr,analytics,reviews,decision-log.md}`, the ID spine
(`REQ-NN-MMM → AC-NN-MMM.K → CMP/IF-NN → WO-NN-MMM`) and the hierarchy `FRD > FDD > design-tokens >
blueprint > work order` — NOT the old by-type layout (flat `docs/frds/`, global `docs/blueprint.md`,
global `docs/work-orders/`). The derived Reference picks up DR-049 and the rewritten `structure.md`
standard automatically (no extra work).

## 4. Storage of hand-authored content

The authored pages live as **MDX/markdown files inside the app** (e.g. `app/manual/content/<group>/<slug>.mdx`
or a `content/manual/` tree), discovered by a thin index. This keeps them version-controlled with the
app and renderable by `react-markdown` (architecture §2). They are NOT read from the factory repo —
they ARE the Manual content. (Distinct from the per-project docs read by `lib/docs.ts`, which is a
different feature, FRD-04/05.) A small `lib/manual.ts` indexes the authored pages; **flagged as a new
`lib/` module** (not in architecture §6's list — see §7).

## 5. Components & interfaces

### Interfaces
- **`IF-08-manual-index`** — `lib/manual.ts` (**NEW**, §7): `readManualPages(): ManualPage[]` → `{ group, slug, title, order, body }` for the authored Tutorial/Guides/Concepts pages. Pure, fixture-tested.
- Reuses **`IF-07-reference`, `IF-07-registry`, `IF-07-standards`** for the Reference (no new reader).

### Components (`app/manual/`)
- **`CMP-08-manual-page`** — `app/manual/page.tsx` (Server Component): side menu (pages grouped by Diátaxis quadrant) + reading area. App surface architecture §11 `app/manual`. → AC "side menu + reading area".
- **`CMP-08-doc-nav`** — the side menu; groups Empezar aquí / Guías / Referencia / Conceptos. → AC "side menu".
- **`CMP-08-doc-reader`** — renders the selected page (authored markdown via `react-markdown`, or a Reference catalog view). → AC "renders each page".
- **`CMP-08-reference-commands`** — Reference: commands list, derived from `readSkills()`. → DR-046 AC.
- **`CMP-08-reference-agents`** — Reference: agents/party list, derived from `readAgents()`. → DR-046 AC.
- **`CMP-08-reference-rules`** — Reference: decision rules, derived from `readDecisionRules()`. → DR-046 AC.
- **`CMP-08-reference-standards`** — Reference: standards, derived from `readStandards()`. → DR-046 AC.
- **`CMP-08-concept-pages`** — the authored Tutorial/Guides/Concepts content (MDX), including the DR-049 feature-centric structure page. → AC "pages cover…", "sufficient for no-context reader", DR-049 currency.

### Reused
- `CopyButton` (FRD-02) for inline commands inside pages.
- `react-markdown` (architecture §2) for rendering.
- FRD-13 tokens for all styling.

## 6. Read-only & security posture
All reads (`fs.read*`), no writes (architecture §7). Inline command chips **copy** strings, never
execute (architecture §1). The Reference's derivation introduces no new write path.

## 7. New `lib/` module (flagged)
`lib/manual.ts` is **not** in architecture §6's table. It indexes the **app-local authored Manual
content** (Tutorial/Guides/Concepts MDX), distinct from `lib/docs.ts` (which reads **per-project**
docs). It is a thin, pure reader over the app's own `content/manual/` tree. Recorded here as the
single new module FRD-08 introduces; everything else reuses FRD-07's readers.

## 8. Traceability (REQ → AC → CMP/IF)

FRD-08 states EARS bullets (no explicit `REQ-08-MMM` ids). Work orders assign `AC-08-MMM.K`.

| FRD-08 EARS bullet | Component(s) / Interface(s) |
|---|---|
| Side menu with pages + reading area that renders each page | `CMP-08-manual-page`, `CMP-08-doc-nav`, `CMP-08-doc-reader` |
| Pages cover: what Pandacorp is, the flow, stages, commands, modes, standards, operate/handoff | `CMP-08-concept-pages` |
| Sufficient for a no-context reader to understand & operate | `CMP-08-concept-pages` (Diátaxis completeness) |
| Reference (commands/agents/rules/standards) DERIVED from canonical source, not hand-copied (DR-046) | `CMP-08-reference-*` + `IF-07-reference/registry/standards` |
| Manual stays in sync: Reference auto-derived; Tutorial/Guides/Concepts kept current by discipline (DR-046) | `CMP-08-reference-*` (auto) + `CMP-08-concept-pages` (discipline) |
| Multi-runtime page exposes the current R0 permission boundary and safe-point-only cold switch | `CMP-08-concept-pages` (`ConceptMultiRuntime` + `RuntimeComparison`) |
| Concept/Guide pages reflect the feature-centric DR-049 layout + ID spine + hierarchy | `CMP-08-concept-pages` (the structure page) |

## 9. Build Plan (Phase 2)

The Phase 2 re-anchor collapses the former UI work orders (shell + two Reference + concept content)
into **one coarse UI WO**; the authored-content index `lib/manual.ts` stays VERIFIED and is consumed
as-is. Build foundation-first.

**Coarse WO set**
| WO | Status | Artifacts (disjoint) | Builds |
|---|---|---|---|
| WO-08-001 | VERIFIED | `lib/manual.ts` | `readManualPages` (consume) |
| **WO-08-002** | **PLANNED** | `src/app/manual/**` | the whole Documentación UI surface |

**DAG & parallelism**
```
FRD-13 foundation (WO-13-006 PageTitle/SectionHead/Tabs · WO-13-007 Panel/Chip/CmdRow/Button/DocHeading · WO-13-008 ItemSlot)
        ▼
FRD-07 WO-07-005 (Configuración UI — the SkillCard/AgentCard/RuleCard/StandardCard)
        ▼
WO-08-002 (Documentación UI)  ◄── reuses FRD-07's catalog cards VERBATIM; consumes VERIFIED readers (WO-08-001 + FRD-07 readers)
```
One UI WO remains, so no intra-FRD UI parallelism; its single artifact glob (`src/app/manual/**`) is
**disjoint** from FRD-07's (`src/app/configuration/**`).

**Cross-FRD deps line (foundation-first):** `frd-13` (foundation primitives + tokens) **must build
before** WO-08-002; **`frd-07`** must build before it too — the Referencia **reuses** FRD-07's
`SkillCard`/`AgentCard`/`RuleCard`/`StandardCard` + shared detail verbatim (DR-057, no fork), and the
four catalogs are **derived live** through FRD-07's readers (DR-046). Build order:
`frd-13 → frd-07 (WO-07-005) → frd-08 (WO-08-002)`.
