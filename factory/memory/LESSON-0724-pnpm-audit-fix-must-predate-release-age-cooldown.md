---
id: LESSON-0724
type: gotcha
domain: dependency-management
tags: [pnpm, supply-chain, audit, overrides, minimumReleaseAge]
context: pnpm's audit flags a transitive dependency for a known advisory, and the obvious fix (override to the latest patched release) is being applied
trigger: "use this when `pnpm audit` is red on a transitive dependency and you're about to add a `pnpm.overrides` entry pinning it to the newest patched version"
source: "funko-tracker — .pandacorp/run/lessons.md note: CI `audit` red on a transitive `effect` (pulled in via `prisma`/`@prisma/config`) ReDoS advisory; the note's own fix instruction was 'pin a version older than the 7-day cooldown'; confirmed live via the shipped `package.json` override `effect: 3.22.4` (commit `14b9a0a2`)"
provenance: agent-inferred
created: 2026-11-23
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---
**Situation:** `pnpm audit` flagged a transitive dependency (`effect`, pulled in via `prisma`) for a known regex-denial-of-service advisory. The intuitive fix — override to the very latest published version that contains the patch — ran into pnpm's own supply-chain safeguard: a `minimumReleaseAge`/cooldown-style policy that treats a recently-published package version as not-yet-trustworthy and will not resolve to it, regardless of whether it's the one with the fix.

**Lesson:** when a dependency-advisory fix is itself a brand-new release, "upgrade to the newest patched version" and "pnpm will actually resolve to that version" are not the same claim — a release-age/cooldown guard (meant to blunt supply-chain attacks that compromise a maintainer account and ship a malicious "patch" release within hours) can reject the very fix you're trying to apply if it's too fresh.

**Apply next time:** when overriding a dependency to clear a security advisory, check whether the chosen patched version is older than the project's (or pnpm's default) minimum-release-age window before pinning it — pick the oldest version that both contains the fix AND clears that cooldown, rather than reflexively grabbing the newest tag and being surprised when the install still resolves the vulnerable one.

**Caveat:** captured from a single project's CI note describing the symptom+fix in prose, not independently re-derived against pnpm's actual documented `minimumReleaseAge` mechanics — treat the specific "7-day" figure as this project's observed config, not a universal constant, until corroborated.
