# Proposal 43: raw research evidence

Raw evidence behind `docs/proposals/43-done-means-queue-green.md`, gathered 2026-11-20. Working notes are in Spanish (the owner-facing investigation language). The memo's `S/...` paths resolve against this folder.

## Index

- `out/rules.md`: the gate, stamp and queue rules as read from the code.
- `out/measure.md`: timed measurements (full gate, stage times, stamp behaviour).
- `out/episodes-audit.md`: audit of the automatic cause labels and wall-time splits.
- `out/redteam-design.md`, `out/redteam-mech.md`: the two red-teams of v1 (design/data; mechanics against the code).
- `out/final-verification.md`: independent verification of v2.
- `out/dispositions.md`: every finding and what was done with it.
- `out/decisions-es.md`: the six owner decision cards (Spanish) plus the decisions taken on 2026-11-20.
- `out/v3counts.py`: reproduces the episode figures. Run from the factory root: `python3 docs/proposals/43-evidence/out/v3counts.py docs/proposals/43-evidence` (the argument is this folder; it reads `w-tr/episodes.json`).
- `out/*.log`, `out/*.txt`, `out/*.py`, `out/before-mc/`: measurement logs and helper scripts.
- `prompts/`, `runs/*.last.md`: prompts given to the investigation subagents and their final reports.
- `w-tr/`: transcript analysis (episodes, scripts, `episodes.md`, `aggregates.json`).
- `w-mc/`, `w-ext/`, `w-br/`, `w-rt/`: Mission Control timeline, external-project timelines, branch survey, red-team working copy.

## Not versioned

- `w-tr/episodes.json` (5.7 MB): kept on disk, excluded by `.gitignore` to keep the repository small. Without it `v3counts.py` cannot run.
- Omitted from the archive (regenerable intermediates of tens of MB): `w-tr/scan.json`, `w-tr/analysis.json`, `w-tr/candidate-files.txt`, `w-tr/search-audit.json`, and all `__pycache__` folders.
