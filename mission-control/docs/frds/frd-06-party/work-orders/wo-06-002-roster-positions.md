# WO-06-002 — Roster + station positions (pure layout)

**Components/Interfaces:** `IF-06-roster`, `IF-06-positions`, `IF-06-agent-color` · **Traces:** REQ-06-001, REQ-06-002, REQ-06-005
**Deploy unit:** Party tab (pure logic module) · **Location:** `app/projects/[slug]/_party/layout.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-06-001.1: The view SHALL show 4 **pixel-art zones** (Research = library, Backend = forge, Frontend = workshop, Testing = lab), each with its label.
- AC-06-002.1: EACH workflow subagent (researcher, backend, frontend, testing) SHALL appear as a **sprite** (its avatar) placed in its zone.
- AC-06-005.1: The researcher is **on demand**: backend and frontend consult it when they need to (it is not a fixed step at the start).

## Scope
- `rosterFor(mode): Role[]` — port `MCROSTER` from the prototype (`pro/balanced/powerful/deep`), typed against FRD-11's mode enum.
- `mcPositions(roster, mode): Pos[]` — port the prototype's pure layout (2-in-column, 4-corner, 3+2, 3+3 deep, ring fallback). Center stays empty (handoffs route through `MCCENTER`).
- `agentColor(role): string` — role → CSS color token **key** (value owned by FRD-13).
- Zone↔role mapping (Research/library, Backend/forge, Frontend/workshop, Testing/lab) as a typed constant.

## Dependencies
- FRD-11 mode enum (`pro|balanced|powerful|deep`).
- FRD-01 `lib/status` for the build-mode field type (read elsewhere; here only the enum).
- FRD-13 token keys for `agentColor` (key only; no value coupling).

## TDD / Definition of done
- Tests: each mode yields the expected roster; positions for n=2..6 match the documented shapes and never collide with center; researcher present only in `powerful/deep` rosters; `agentColor` returns a stable key per role.
- Pure, no DOM. Gate green (vitest + tsc + biome).
