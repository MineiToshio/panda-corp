# WO-02-004 — `discardIdea` (the single write)

**Module:** `lib/discard.ts`
**IDs touched:** `CMP-02-discard`, `IF-02-discardIdea`; REQ-02-007
**Dependencies:** WO-01-000 (fixtures), `lib/config.ts` (shipped), gray-matter

## EARS criteria (from FRD-02)

- AC-02-007.1 — WHEN the owner presses "Discard idea", the system SHALL rewrite `status: discarded`
  in the `.md` frontmatter, **preserving the rest of the file** (Pandacorp's only write).

## Contract

```ts
type DiscardResult = { ok: true } | { ok: false; reason: "not-found" | "parse-error" };
export function discardIdea(slug: string, ideasDir?: string): DiscardResult;  // defaults config.IDEAS_DIR
```

- Resolve `<ideasDir>/<slug>.md`. Not found → `{ ok: false, reason: "not-found" }`.
- Parse with gray-matter, set `data.status = "discarded"`, re-serialize **preserving the body and
  all other frontmatter fields verbatim** (order/values of untouched fields intact).
- This is the **ONLY `fs.write` in the whole codebase** (architecture §1/§7). It writes exactly one
  frontmatter field of one card. No other module writes.
- Parse failure → `{ ok: false, reason: "parse-error" }`, leave the file untouched.

## Definition of done

- `lib/discard.test.ts` (RED first) — operate on a **copy** of a fixture card (write to a temp dir
  so the source fixture is not mutated; use `PANDACORP_FACTORY_ROOT` pointing at the temp tree):
  - `discardIdea("idea-discovered")` → `{ ok: true }`; re-reading shows `status: discarded` and the
    body + other frontmatter fields **unchanged**.
  - already-discarded card → idempotent `{ ok: true }`.
  - missing slug → `{ ok: false, reason: "not-found" }`, nothing written.
- The test asserts no OTHER file under the tree was modified (write isolation).
- `.pandacorp/verify.sh` green.

## Status

- [ ] BLOCKED — freeze-on-red applied 2026-06-16. HEAD frozen at `last_green_sha=99103c2` (WO-02-003).
  No new commits allowed until this block is lifted. Pending adversarial review verdict.
  See `.pandacorp/status.yaml` `blocked_work_orders` entry for WO-02-004.
