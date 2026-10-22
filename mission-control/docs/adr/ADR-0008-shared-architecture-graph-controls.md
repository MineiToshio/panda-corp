---
id: ADR-0008
status: SUPERSEDED
superseded_by: ADR-0012
last_updated: 2026-10-22
---

# ADR-0008 — Shared Architecture graph controls and native fullscreen

- **Status:** Superseded by ADR-0012 (2026-10-22). Originally accepted under the owner’s explicit direct correction. In v2 the frozen Órbita design is the oracle: the dependency map has no zoom/fit/fullscreen toolbar (FRD-12 AC-12-004.5), the data model has its own compact top-right toolbar (FRD-02 v2), and the viewport-filling fallback dialog is removed.
- **Date:** 2026-10-16
- **Decision agent/runtime:** OpenAI Codex
- **Amends:** ADR-0007 navigation/presentation only
- **Traces:** FRD-02 AC-02-015.3/.6, FRD-04 shared Architecture, FRD-12 dependency-map rendering

## Decision

Use the actual Architecture dependency map as the visual oracle. Promote its existing ZoomControls presentation into components/modules/GraphControls, with shared CSS and copy; promote its standard/WebKit useFullscreen into src/hooks. Route adapters retain the dependency-map public surface and existing behavior. The logical-model adapter consumes the same corner toolbar: zoom out, clickable percentage/reset, zoom in, fit and native fullscreen/minimize. Its optional collapsed directional pad supplies click alternatives to dragging without a bottom toolbar. The model retains readable reset framing; the dependency map retains 100% reset.

The model synchronously flush-mounts a model-only DIV within the expanding click, then requests browser fullscreen on that DIV. The dialog itself is not eligible as a native fullscreen target. Existing viewport-filling dialog presentation supplies an honest fallback when native fullscreen is unsupported, throws or is rejected; no model content is duplicated. Only graph, search and shared controls enter native mode. Native fullscreenchange exit closes the expanded view, and Escape/close restore the actual text/icon opener plus prior body overflow.

Frame-batch wheel and pointer updates with requestAnimationFrame. Direct actions cancel old pending frames; unmount cancels scheduled work. Memoize stable EntityCard and ModelEdges subtrees and keep the entity selection callback stable, so camera motion does not rebuild every field cell. Match the dependency map’s 15% button increment; normalize wheel delta modes and apply proportional scaling to retain fine trackpad movement. This uses no animation/tween and adds no motion requiring a reduced-motion override.

## Trade-offs and evidence

The native API is browser-controlled and may be denied in embedded contexts. Keeping a full-window dialog fallback preserves access and keyboard behavior, while the supported path uses the same real browser capability as the reference. The model keeps its smaller minimum zoom for large ER graphs; dependency-map zoom bounds and behavior are unchanged. No new dependency, model/parser/layout change, project phase or build-state transition is introduced.

Require independent native/fallback/focus/RAF regressions, actual document.fullscreenElement checks in browser, matching toolbar geometry/theme, native exit/minimize, wheel/drag behavior, and production-bundle/live-service qualification. Current delivery evidence lives in docs/reviews/model-graph-consistency/delivery.md; historical delivery reports are not rewritten.
