# Pending decisions — proj-a

## OPEN: Should we add Playwright e2e tests?
- **Context:** Architecture §2 excludes Playwright from v1, but critical flows might need coverage.
- **Options:** (A) Keep Vitest only for v1. (B) Add Playwright for the 5 most critical flows.
- **Owner action needed:** Choose A or B.

## OPEN: Default event cap for readEvents
- **Context:** Architecture §3 mentions cap of 200 but no hard requirement stated.
- **Options:** (A) 200 (current proposal). (B) 500 for longer sessions.
