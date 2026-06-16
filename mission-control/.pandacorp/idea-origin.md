# Idea origin — Pandacorp (the factory dashboard)

It emerged in the factory's design conversation (2026-06-13). The owner wanted a **graphical interface**, not to operate everything from the terminal, but with one hard condition: **use only their Claude Max subscription** (not the headless `claude -p` pool).

The solution: a **local, read-only** web dashboard that **never calls Claude** — it only reads files and tells the owner which command to copy and paste into Claude Code. It is the **factory's own interface**, which is why it lives inside `panda-corp/mission-control/` (an exception to "no product code lives here": it is not a client product).

It is the factory's first project and serves as dogfooding of the pipeline. The navigable prototype (`mission-control/prototype/index.html`) acted as the design phase; this PRD + FRDs formalize the product.
