---
id: LESSON-0283
type: pattern
domain: agent-tooling
tags: [tool-description, drift, third-party-surface, dr-058, claude-design]
context: relying on a recorded decision (a DR, a standard) about how a third-party tool/surface behaves, instead of the tool's own current description
trigger: use this when about to act on a recorded DR/standard about a third-party tool or external surface (an MCP server, a built-in tool, a platform feature) rather than re-reading that tool's live description/docs first
source: "panda-corp 2026-10-11 — DesignSync's live tool description had flipped to 'Never use it to make a design, deck or prototype' while DR-058 still said 'generate the system with DesignSync (claude.ai/design)'; caught only by re-reading the tool description directly during proposal 42's research (docs/proposals/42-absorb-claude-design-to-artifacts.md)"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0027, DR-058, BL-0229, BL-0230]
---

**Situation:** `factory/standards`/the registry encoded DR-058 ("adopt Claude Design, generate with
DesignSync") as a durable default back in 2026-06/07. By 2026-10-11 Anthropic had changed the tool's own
live description to the opposite instruction ("never use it to make a design... those are made with the
Artifact tool"), and announced the standalone surface's sunset. Nothing re-checked the tool's own words;
the DR was trusted as still current until a direct re-read caught the drift.

**Lesson:** a recorded decision about a third-party tool/platform is a snapshot of that surface's
behavior AT THE TIME IT WAS WRITTEN. The surface itself is NOT versioned or notified through the
factory's own change process — it can change silently underneath the DR. This generalizes LESSON-0027
("an audit finding is a snapshot, re-verify against the live artifact") from the factory's OWN code to
any EXTERNAL tool/platform surface the factory has written a standing rule about.

**Apply next time:** before acting on, or telling the owner to rely on, a DR/standard that prescribes
HOW to use a third-party tool or platform feature, re-read that tool's own current description/docs
first (its tool description, its support article, its changelog) — don't trust the DR's prose as still
accurate just because it's committed. If it drifted, treat the DR as superseded-pending and flag it for
reconciliation (never silently keep acting on the stale prescription).
