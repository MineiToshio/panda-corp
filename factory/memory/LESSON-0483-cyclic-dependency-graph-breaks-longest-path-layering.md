---
id: LESSON-0483
type: gotcha
domain: graph-visualization
tags: [dag, dependency-graph, layering, longest-path, cycles]
context: computing a layered (top-to-bottom or left-to-right) layout for a dependency graph whose edges are declared independently per node rather than derived from a provably acyclic build/import graph
trigger: use this when laying out a dependency graph (e.g. FRD-to-FRD, module-to-module) with longest-path/topological layering and the edge set comes from independently-authored declarations rather than a guaranteed-acyclic source
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Mission Control's dependency-map feature, FRD-level graph"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0419]
---

**Situation:** a dependency-map feature laid out FRD-to-FRD dependency edges using longest-path layering
(rank by the longest chain of incoming edges). Because the edges came from each FRD independently
declaring what it depends on, some pairs of FRDs named EACH OTHER as a dependency (a 2-cycle) — a case
the layering algorithm, which assumes a DAG, had no rule for, so those pairs landed at an arbitrary rank.

**Lesson:** a dependency graph assembled from independently-authored per-node declarations (not derived
from a single build/import graph that is structurally acyclic by construction) can contain real cycles,
and a longest-path/topological layering algorithm silently produces an arbitrary order for any cyclic
pair instead of failing — there is no error to notice, just a layout that looks wrong only once you
already know the real relationship.

**Apply next time:** before ranking, detect cycles and resolve each one to ONE dominant direction with an
explicit tie-break (e.g. "lower id wins") rather than feeding the raw edge set straight to a DAG-only
layering pass; while ranking, skip an edge back to a node already on the current recursion stack (an
on-stack predecessor) instead of treating it as a normal forward dependency.
