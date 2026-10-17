# ADR-0007 — Readable logical models and diagram-only full-window expansion

- **Status:** Accepted under the owner's explicit direct correction
- **Date:** 2026-10-16
- **Decision agent/runtime:** OpenAI Codex, implementing owner feedback
- **Amends:** ADR-0006 rendering/navigation only; artifact/reader contracts unchanged
- **Traces:** FRD-02 AC-02-015.1–.11, FRD-04 REQ-04-012

## Problem

The actual PandaSaga artifact has 39 entities and 95 relationships. The first delivery used 248px cards, clipping attributes/types, a first-node camera and a 2840×7431px Dagre layout. Expanding repeated the entire inset viewer, including lower details and relation buttons. The owner explicitly rejects this presentation.

## Decision

Keep the native DOM/SVG renderer, drag navigation, keyboard alternatives, same artifact and both entry contexts. Remove the lower ModelInspector and its duplicate relationship list. SVG connectors remain independently selectable with endpoint cardinalities, while schema view retains full logical declarations.

Use exact-pinned **elkjs 0.12.0**, whose [official layered algorithm](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) supports orthogonal routing and fixed ports. Choose RIGHT direction, deterministic seed 7, crossing-minimizing layer sweep, network-simplex placement and [Coffman–Graham](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-layering-coffmanGraham-layerBound.html) with at most three nodes per layer. Content-sized column geometry owns card widths and the actual fixed field-row ports. Unique internal tokens keep opaque artifact IDs out of layout internals. Exactly co-routed composite references receive distinct checked orthogonal offsets in free corridors; their endpoints remain unchanged.

In browsers, the thin ELK API talks directly to ELK's dedicated algorithm worker through a bundled worker URL. Do not nest the bundled Node/fake-worker adapter in a custom browser worker: its environment detection failed in an actual Next browser rehearsal (`_Worker is not a constructor`). Node/test hosts use the bundled adapter; it has no native terminate method, so only real native workers are terminated. Model identity fences stale results; AbortSignal cancels replacement/unmount/20-second timeout work. Pending/error status is explicit.

Initial framing centers a complete connected entity at a readable scale, using degree plus distinct mapped-field participation. It does not fit a large graph into unreadably tiny labels by default. **Ajustar** fits the complete diagram; **Restablecer** restores the readable starting view. Search centers and fits the requested entity. Resize/expansion recomputes usable framing.

**Ampliar modelo** opens only the graph at **100vw × 100dvh**, zero inset, padding, border or surrounding Architecture chrome. Minimal close/search/zoom/pan controls float over the canvas. No source band, tabs, visible help, key legend or lower details appear in the dialog. Inline provenance remains truthful. Escape, focus trapping/restoration and body-scroll restoration remain required.

## Trade-offs and verification

ELK adds an EPL-2.0-or-GPL-3.0-or-later dependency; we use the EPL-2.0 distribution under its published license, without modifying its source. Its heavy algorithm stays off the UI thread and loads with the worker, not with every dashboard page. Dagre remains for work-order graphs. The extra asynchronous boundary requires explicit loading/error/cancellation and actual production-browser bundling evidence; Node-only graph tests cannot qualify that integration.

PandaSaga rehearsal geometry is 7352×3801px with wider cards, rather than the original narrow vertical stack. This changes aspect ratio and preserves full text; it is not a claim of globally optimal density or zero edge crossings. Independent geometry checks must prove all entities/relations, actual ports, nonoverlapping cards, distinct self/parallel routes and no connectors through card interiors. Browser checks must separately prove viewport coverage, no clipped actual cells, readable centering, search, drag, focus and themes at desktop/mobile widths. Evidence belongs in `docs/reviews/readable-fullscreen-model/`; this ADR does not self-certify those checks.
