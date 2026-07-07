# .pandacorp/ — Pandacorp factory integration

This folder is the integration layer between this project and the **Pandacorp** factory (a 100% AI software factory). It is this project's analogue of `.github/`: everything that exists so the factory can operate lives here, separated from the product.

- **Managed by the factory.** `guide.md`, `status.yaml` and the machinery here are written by the `/pandacorp:*` skills — don't hand-edit them; `/pandacorp:upgrade` regenerates them.
- **With the plugin** installed, work on this project through the skills (see `guide.md`).
- **Without the plugin** (you cloned just this repo), the project is fully workable on its own — follow `AGENTS.md` and `docs/` by hand. The skills are the *assisted* path, not a requirement.

| Path | Committed? | What |
|---|---|---|
| `guide.md` | yes | the project's Pandacorp guide (imported by `CLAUDE.md`) |
| `status.yaml` | yes | machine-readable state (phase, version, overlay_version…) |
| `idea-origin.md` | yes | frozen copy of the originating idea card |
| `track.jsonl` | yes | durable build timeline (append-only; Mission Control reads it) |
| `build-journal.jsonl` | yes | durable progressive-learning build journal (append-only; attempts/verdicts/diagnoses/resolutions) |
| `verify.sh` | yes | the build's verification gate (created by the blueprint) |
| `comms/` | no (gitignored) | Spanish owner-facing narrative (summary, iteration, progress…) |
| `inbox/` | no (gitignored) | owner↔skills channel (bugs, pending decisions) |
| `run/` | no (gitignored) | runtime state (locks, caches) |
