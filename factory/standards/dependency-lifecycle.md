# Dependency lifecycle

> Domain: Security/Quality · Severity: **MUST** (audit, licenses, removal hygiene) / **SHOULD** (update cadence) · Enforcement: `security-auditor` hardening pass + `architect` install step + knip (`verify.sh`). Operative form: `rules/code-conventions.md` (Dependencies) + `rules/web-security.md` (supply chain) — no separate rule file (stated deliberately; the operative bullets already live there).

Adoption-time policy (pin exact versions, immutable installs, ~7-day cooldown, no lifecycle scripts) is canonical in [web-security.md](web-security.md) (SEC-3/SEC-4/SEC-5) and version choice in `conventions.md`/DR-052 — this standard owns what happens **after** adoption.

## Rule — update cadence: deliberate, not reflexive
- **Security patches ASAP**: a high/critical audit finding on an installed dependency is fixed in its own change, not batched.
- **Minors/patches batched** on a maintenance pass (post-launch loop or a deliberate chore change) — never opportunistically mid-feature, never mid-build (DR-052: in-flight stays pinned).
- **Majors only deliberately**: their own change, migration notes read first, cooled down (SEC-4).

## Rule — audit gate
- **`pnpm audit --audit-level high` must be clean** (fail on high/critical) at every hardening pass and before any external release. A finding without an available fix is escalated to the owner with the exposure stated — never silently accepted.

## Rule — removal hygiene
- A dependency no longer imported is **removed in the same change** that dropped its last import; `knip` catches leftovers (wired, QUAL-2).

## Rule — licenses
- **Permissive only by default**: MIT / Apache-2.0 / BSD / ISC. **Copyleft (GPL/AGPL) or unusual/no license → escalate to the owner** before installing (human gate — it constrains the product's distribution, an owner decision like spending money).

## How it is verified
- **Audit**: the `security-auditor` hardening pass runs `pnpm audit --audit-level high` (named manual step; a CI wiring candidate).
- **License + cooldown at install**: the `architect`'s install step checks license and release date before `pnpm add` (the same named step as SEC-4); copyleft escalation is a human gate.
- **Removal hygiene**: `knip` in `verify.sh` (wired).
- **Cadence discipline**: review-only (`reviewer` flags an unrelated version bump inside a feature change).

## Why
Dependencies are the largest attack and rot surface a small product has. Reflexive bumping imports risk with no benefit; never updating accrues unpatchable debt. A deliberate cadence — security now, minors batched, majors on purpose — plus a hard license line keeps both risks bounded with near-zero routine cost.
