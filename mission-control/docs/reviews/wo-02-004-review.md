# WO-02-004 review — `discardIdea` (the single write)

**Reviewer:** Opus 4.8 (DR-015, distinct model from the implementer)
**Date:** 2026-06-16
**Module:** `lib/discard.ts` · `lib/discard.test.ts` · caller `app/board/actions.ts`
**Verdict:** **APPROVED**

## Evidence re-run from clean (not trusting the self-report)

- `bash .pandacorp/verify.sh` → **green**: biome (0 errors), tsc (0 errors), vitest **1145 passed / 4 skipped**. Consistent with the implementer's self-report.
- Reviewer adversarial suite added: `lib/discard.adversarial.test.ts` — **10 tests, all pass** (incl. after running the whole suite, 1155 passed). Covers: symlink write-through isolation, trailing-newline byte fidelity, idempotent byte-stability, mutation-killing on the write, subdir/dotfile/absolute-path/NUL slugs, and a `---` fence inside the body.

## Adversarial probing performed (DR-015 / DR-016)

1. **Symlink write-through (write-isolation invariant).** Planted a symlink inside the ideas dir pointing at an out-of-tree file and called `discardIdea`. Verified **deterministically across 8 repeated runs**: the function returns `{ ok: false, reason: "not-found" }` and the external file is **never** modified. Write-isolation (architecture §1/§7) holds. (A first exploratory run produced a spurious failure I could not reproduce; deterministic re-runs and a direct `lstat`/`stat` diagnostic confirmed it was a test-state flake, not a defect in `discard.ts`. Retracted.)
2. **Mutation-killing the single write.** Asserted on the **raw bytes** that `status: discarded` is present and `status: discovered` is gone after discard. This kills both the "drop the `data.status` assignment" mutant and the "remove `fs.writeFileSync`" mutant — either would leave the file saying `discovered` and fail the test. The implementer's own suite also has a strong byte/field-equality mutation killer (`discard.test.ts:512-558`).
3. **Trailing-newline branch (`lib/discard.ts:127-129`).** A card with no trailing newline keeps its body byte-identical after discard — the special-case branch is correct.
4. **Idempotent byte-stability.** Discarding an already-discarded card a second time is a fixed point (no byte drift).
5. **Path/abuse inputs.** Empty slug, NUL-bearing slug, absolute-path slug, `../../etc/passwd`, `sub/idea`, dotfile slug, and double-`.md` slug are all handled without throwing and without escaping the ideas dir.

## Lens summary

- **Correctness:** meets AC-02-007.1 — `status` rewritten to `discarded`, body + all other frontmatter fields preserved (value-level, verified across 12 parametric type cases + reviewer probes), idempotent, every error path typed. Strong.
- **Security:** path-traversal guard (string-prefix + `isFile` check) rejects empty/NUL/absolute/`..` slugs and does not write through symlinks. The single mutation surface (`app/board/actions.ts`) is `"use server"`, human-triggered, never throws, revalidates only on success. No secrets, no injection surface, no new dependencies.
- **Quality:** tight scope (one module + its test + its sole caller), no duplication, no scope creep, strict typing with no `any`/`@ts-ignore`, no hardcoded values. Appropriately sized to review in isolation.

## Findings

### [MINOR — non-blocking] "Verbatim" is value-level, not byte-level — `lib/discard.ts:120`

`gray-matter.stringify` strips redundant quoting on re-serialize (real fixture: `title: "AI-powered..."` → `title: AI-powered...`, `project_type: "SaaS"` → `project_type: SaaS`). Parsed **values** are identical, so the contract's "values of untouched fields intact" is satisfied; the raw file bytes of untouched fields can change cosmetically. No action required — flagging only so "verbatim" is understood as value-level. If exact byte preservation of untouched fields is ever required, that would need a surgical line-level frontmatter edit instead of full re-serialization.

## Artifacts left for the suite

- `lib/discard.adversarial.test.ts` — promote/keep as the permanent regression anchor (symlink isolation, byte fidelity, mutation killers). biome + tsc clean.
