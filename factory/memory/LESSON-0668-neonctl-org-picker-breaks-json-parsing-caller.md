---
id: LESSON-0668
type: gotcha
domain: infra-cli
tags: [neon, neonctl, cli-gotcha, interactive-prompt, multi-org-account]
context: a script invokes `neonctl` (or any CLI with an account/org-scoping step) non-interactively and parses its stdout as JSON
trigger: use this when a script invokes `neonctl` non-interactively and parses its stdout as JSON, on an account that may belong to more than one organization
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-10/11 (agent-inferred): `neonctl projects list` opened an interactive organization picker (instead of returning project data) when the authenticated account belonged to more than one Neon organization, and the ingest script's JSON parse of neonctl's stdout crashed on the picker's prompt text; fixed by pinning NEON_PROJECT_ID (and/or the equivalent org-scoping flag) so neonctl never needs to ask."
provenance: agent-inferred
created: 2026-11-11
status: active
promotion: approved
confidence: medium
times_applied: 0
applied_in: []
links: [EXT-8, DR-149]
---

**Situation:** a script called `neonctl projects list` and parsed the output as JSON. On an account that
belongs to more than one Neon organization, `neonctl` silently switched to an interactive org-selection
prompt instead of returning project data — the script's JSON parser then crashed trying to parse prompt
text as JSON, with no obvious connection between "account has multiple orgs" and "JSON parse error."

**Lesson:** a CLI that can fall back to an interactive disambiguation prompt (here, triggered purely by
an account-level property — belonging to more than one org — rather than anything about the specific
command or its flags) breaks any non-interactive caller the moment that account-level condition becomes
true, and the resulting error (a JSON parse failure) gives no hint that an interactive prompt was the
actual cause.

**Apply next time:** when scripting `neonctl` (or any CLI with a similar org/account/project-scoping
step) non-interactively, always pin the scoping value explicitly (`NEON_PROJECT_ID` / the equivalent
flag) rather than relying on the CLI resolving a single default on its own — don't wait for a
multi-org account to surface the gap in production.
