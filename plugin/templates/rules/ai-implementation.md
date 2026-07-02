---
description: AI implementation discipline — comments, in-repo docs, no dead code, grounded APIs, lesson citations.
applies_when: always
globs: ["**/*"]
source: Pandacorp standard — ai-implementation
---

# AI implementation discipline

- Comments explain **why / invariants** only. Never narrate the diff (`// changed X to Y`), reference the conversation/ticket/work order in code, or add tutorial comments. If a comment restates the code, delete it.
- **No doc files inside `src/`** and no parallel doc trees (`NOTES.md`, `IMPLEMENTATION.md`, `CHANGES.md` next to code) — product/technical docs live in `docs/` per the FRD skeleton. A package README only when setup is non-obvious.
- **No dead or commented-out code, ever** — git is the archive. No speculative abstractions or "future-proofing" params — rule of three (see clean-code).
- **Verify against the INSTALLED version, not training memory**: check `package.json` and the version-matched docs (the `AGENTS.md` pointer) before citing a framework API, config key or file convention.
- When a factory memory lesson shapes a choice, **cite its `LESSON-NNNN` id** in the commit message or the work order's Status-Note.
