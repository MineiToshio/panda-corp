# Open the navigable mockup

Open [preview.html](preview.html) for the review frame or [index.html](index.html) for the unframed study. Keep the `assets/` and `data/` folders next to both files. The review frame has desktop/tablet/phone framing, a screen selector and a light/dark selector. Buttons never execute commands or change factory files.

A local server is convenient. From this folder:

```sh
python3 -m http.server 1988 --bind 127.0.0.1
```

Then open `http://127.0.0.1:1988/preview.html`. The real application uses port 1987 and is independent.

## Round 5: three private captures

All data is read-only and ignored by Git (`data/.gitignore`), because it contains the owner's project documents and factory state. Regenerate from the `mission-control` directory:

```sh
node --loader ./scripts/read-model/ts-loader.mjs docs/design/explorations/visual-refresh-2026/scripts/export-snapshot.mjs
node --loader ./scripts/read-model/ts-loader.mjs docs/design/explorations/visual-refresh-2026/scripts/export-extras.mjs
node docs/design/explorations/visual-refresh-2026/scripts/capture-manual.mjs
node docs/design/explorations/visual-refresh-2026/scripts/build-prototype.mjs
```

- `export-snapshot.mjs` → `data/snapshot.js`: ideas, projects, documents, work orders, Spec, architecture (including `.env.example` names with their comments and the project's services from the factory directory, public fields only), changes, activity, decisions and the Manual index, through the app's own readers.
- `export-extras.mjs` → `data/extras.js`: backlog, memory health and streams, skills, agents, decision rules, standards, the guild (level, trophies, missions, seals, ranks, statistics with the Informe series assembled like the app's `/achievements` page: weekly flow, funnel, phase transitions, usage, radar) and factory health (plugin version drift, pending branches and worktrees per repo, decision context, last commit per project).
- `capture-manual.mjs` → `data/manual-live.js`: the 38 Manual pages as rendered by the app served at `http://127.0.0.1:1987` (override with `MC_URL`). It needs that app running and Playwright from `mission-control`.

The study still opens without `extras.js` or `manual-live.js`; the affected screens then say which capture is missing.

## Editing

`prototype.template.html`, `base.css` (tokens and primitives), `prototype.css` (shell and screens) and `prototype.js` are the editable sources. `scripts/build-prototype.mjs` regenerates `index.html`; never edit the generated file. Earlier rounds are archived under `mockups/`.
