# Open the navigable mockup

Open [preview.html](preview.html) for the review frame or [index.html](index.html) for the unframed study. Keep the assets folder next to both files. The review has desktop/tablet/phone framing and a light/dark selector. Project and Manual content comes from a private, timestamped local snapshot. Ancillary samples remain illustrative; buttons do not execute commands or change factory files.

A local server is convenient:

```sh
python3 -m http.server 1988 --bind 127.0.0.1
```

Then open `http://127.0.0.1:1988/preview.html`. The real application uses port 1987 and is independent.

## Rounds 3–4: private real data

The project/Manual flows now use a complete, timestamped local snapshot. It is ignored by Git because it contains the owner's project documents. To regenerate it, run from the `mission-control` directory:

```sh
node --loader ./scripts/read-model/ts-loader.mjs docs/design/explorations/visual-refresh-2026/scripts/export-snapshot.mjs
node docs/design/explorations/visual-refresh-2026/scripts/build-prototype.mjs
```

The template, CSS and script are the editable sources; `index.html` is their generated stable preview. A private offline download may include the snapshot; keep it local. No real app state is edited by the mockup.

Round 4 opens PandaSaga Spec and adds semantic color for document purpose, attention and status. The same navigation/content remains available in both themes.
