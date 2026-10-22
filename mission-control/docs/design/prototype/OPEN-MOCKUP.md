# Open the navigable mockup

Open [preview.html](preview.html) for the review frame or [index.html](index.html) for the unframed study. Keep the `assets/` and `data/` folders next to both files. The review frame has desktop/tablet/phone framing, a screen selector and a light/dark selector. Buttons never execute commands or change factory files.

A local server is convenient. From this folder:

```sh
python3 -m http.server 1988 --bind 127.0.0.1
```

Then open `http://127.0.0.1:1988/preview.html`. The real application uses port 1987 and is independent.

## Data: a privacy-safe fixture factory

This is the owner-approved prototype (Órbita, approved 2026-10-21) and the design-freeze oracle. The repository is public, so the prototype renders only **fictional data**. A fixture factory under `fixtures/` (`factory-root/` with portfolio, ideas, backlog, memory and services, `projects/<id>/` with five fictional projects, and `git-state.json` standing in for git history) is written in the formats the app's own readers parse. The same fixture can seed the app build for its fidelity gate. Project and idea ids match the approved review (`mission-control`, `funko-tracker`, `pandasaga`, `pandacast`, `personal-page-v2`), but all their content is invented. Regenerate from the `mission-control` directory:

```sh
node docs/design/prototype/scripts/make-fixtures.mjs        # --vendor refreshes the public skill/agent/standard/rule subsets
node --loader ./scripts/read-model/ts-loader.mjs docs/design/prototype/scripts/export-snapshot.mjs
node --loader ./scripts/read-model/ts-loader.mjs docs/design/prototype/scripts/export-extras.mjs
node docs/design/prototype/scripts/build-prototype.mjs
```

- `export-snapshot.mjs` → `data/snapshot.js`, and `export-extras.mjs` → `data/extras.js`. They run the app's readers over the fixture with a frozen clock (2026-10-21T00:20Z), so the output is byte-identical between runs. `MC_REAL=1` reads the real factory instead and writes the gitignored `data-live/`; a plain run never writes real data into `data/`.
- `capture-manual.mjs` → `data/manual-live.js`: the Manual as rendered by the app started against the fixture (`PANDACORP_FACTORY_ROOT=$PWD/docs/design/prototype/fixtures/factory-root next dev --port 1991`, then `MC_URL=http://127.0.0.1:1991`).
- QA: `qa-flows.mjs`, `qa-matrix.mjs` and `qa-smalltext.mjs` read `QA_BASE` (default `http://127.0.0.1:1988`) and write to the gitignored `evidence/`.

## Editing

`prototype.template.html`, `base.css` (tokens and primitives), `prototype.css` (shell and screens) and `prototype.js` are the editable sources. `scripts/build-prototype.mjs` regenerates `index.html`; never edit the generated file. Earlier rounds are archived under `../explorations/visual-refresh-2026/mockups/`; the previous app prototype is at `../archive/prototype-v1/`.
