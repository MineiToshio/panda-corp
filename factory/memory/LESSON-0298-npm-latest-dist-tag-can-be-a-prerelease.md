---
id: LESSON-0298
type: gotcha
domain: dependency-management
tags: [npm, dist-tag, semver, prerelease, stack-proposal, prisma]
context: resolving a dependency's "latest" version when researching or proposing a stack
trigger: "use this when picking a dependency version for a stack proposal/blueprint by reading npm's `latest` dist-tag — verify it is actually a stable release, not a release candidate, before pinning it"
source: "pandacast .pandacorp/run/lessons.md inbox note, 2026-10-10, architecture stack-proposal research — Prisma's `latest` npm dist-tag resolved to 8.0.0-rc.22, a release candidate, not a stable release"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 2
applied_in: [pandasaga, funko-tracker]
links: []
---

**Situation:** while researching dependency versions for a stack proposal, `npm view <pkg> version` /
the package registry's `latest` dist-tag was read as "the current stable version" — for Prisma at the
time, `latest` pointed to `8.0.0-rc.22`, a pre-release (release candidate), not a stable cut.

**Lesson:** a package's `latest` npm dist-tag is a maintainer-set pointer, not a guarantee of stability —
maintainers sometimes ship a release candidate under `latest` during a major-version transition (betas
usually use `next`/`beta`/`rc` tags, but this is a convention, not an enforced rule; `latest` can still
land on an RC). Trusting `latest` blindly when proposing a stack version can pin a project to pre-release
code without anyone noticing.

**Apply next time:** when resolving "the current stable version" of a dependency for a stack proposal or
blueprint, don't stop at the `latest` dist-tag — check the full version list (`npm view <pkg> versions`,
or the registry/changelog page) for a version string containing no pre-release suffix (`-rc`, `-beta`,
`-alpha`, `-next`) that is the highest such stable version, and use THAT as "latest stable". Flag it
explicitly in the stack proposal if `latest` and "latest stable" diverge, since the owner/reviewer will
likely assume they're the same.
