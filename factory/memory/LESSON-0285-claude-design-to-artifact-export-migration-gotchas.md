---
id: LESSON-0285
type: gotcha
domain: design-tooling
tags: [claude-design, artifact, design-tokens, dtcg, claude-in-chrome, migration]
context: migrating an existing standalone claude.ai/design project to the Artifact-based Design/Design System types ahead of the 2026-12-14 standalone sunset
trigger: use this when exporting or migrating a standalone Claude Design project (design system, tokens, components) to the Artifact tool's Design/Design System types
source: "panda-corp 2026-10-11, Claude Design absorption research (docs/proposals/42-absorb-claude-design-to-artifacts.md / BL-0229, BL-0230) — three distinct export/migration traps hit while mining the live surface"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0229, BL-0230, LESSON-0199, LESSON-0141]
---

**Situation:** mining the live claude.ai/design → Artifact migration path (ahead of the 2026-12-14
standalone sunset) surfaced three independent traps: (1) a Design System Artifact's `tokens.json` uses a
LIST shape (`{tokens:[{name,value,usage}]}`, themes carried per-value) — a DTCG/name-map token file (like
the factory's own `design-tokens.json`) shows up EMPTY there with no error, until converted to the list
shape first; (2) exporting a standalone project via the `claude-in-chrome` extension is flaky in several
independent ways — the first Share click after navigation is often swallowed, a screenshot action can
close the Share menu, the Export HTML dialog appears ~1-2s late, and synthetic JS clicks don't open the
underlying Radix menu (real ref-based clicks + explicit `find` are required); an EMPTY project shows every
export option disabled with no explanation; (3) after migration, an org-level default design system
becomes the default for every NEW Design Artifact created afterward — it has to be explicitly removed (or
not migrated) when design systems are meant to be per-product, not shared.

**Lesson:** a cross-surface migration between two generations of the same vendor's tool is not a clean
1:1 export — the data SHAPE changes silently (no error on a wrong-shape file, just empty output), the UI
automation surface (claude-in-chrome) has several independent flake modes distinct from ordinary web
automation (menu-open timing, disabled-by-emptiness, swallowed first click), and migrated defaults can
leak sideways into unrelated future artifacts (org-level default) if not explicitly checked.

**Apply next time:** when exporting/migrating a Claude Design project to an Artifact type: (a) verify the
target's actual token SHAPE (list-of-objects, not a DTCG name-map) and convert before trusting an empty
result means "nothing to show"; (b) drive claude-in-chrome exports with real ref clicks (not synthetic JS
events), expect the export dialog to lag ~1-2s, and treat "every option disabled" as a signal the source
project is empty rather than a bug; (c) after migrating, explicitly check/remove any org-level default
design system so it doesn't silently become every future artifact's default.
