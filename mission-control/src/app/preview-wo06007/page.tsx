/**
 * WO-06-007 preview route — visual fidelity check (DR-056).
 *
 * Renders PartyScene with a realistic fixture snapshot so the implementer
 * can compare the live render against `docs/frds/frd-06-party/mocks/la-fragua.html`.
 *
 * Visual target:
 *   - 920×560 stage with 3 rooms (Sala de Forja, Tribunal, Bóveda)
 *   - StoneBridges joining the rooms
 *   - AgentSprites in forge slots (≤ wave)
 *   - "+N en cola" badge
 *   - JudgeSprite (dim → active when all WOs in_review)
 *   - Trophy shelf in Bóveda
 *   - Parchment
 *   - FlowStrip (8 beats) always visible
 *   - MissionBar (effort as read-only data)
 *   - PowerOffOverlay (derived from active)
 *
 * NOT shipping code — fidelity check only. Can be removed after IN_REVIEW.
 */

import type { FraguaSnapshot } from "@/app/projects/[slug]/_party/fragua-snapshot/fragua-snapshot";
import { PartyScene } from "@/app/projects/[slug]/_party/PartyScene/PartyScene";

// ---------------------------------------------------------------------------
// Fixture snapshot — an active build with multiple running WOs
// ---------------------------------------------------------------------------

const FIXTURE_SNAPSHOT: FraguaSnapshot = {
  frd: { id: "frd-06-party", title: "FRD-06 Party — La Fragua" },
  mode: "powerful",
  wave: 4,
  running: [
    { wo: "WO-06-001", title: "Event VM module", state: "building" },
    { wo: "WO-06-002", title: "Layout module", state: "building" },
    { wo: "WO-06-003", title: "State map", state: "in_review" },
    { wo: "WO-06-004", title: "Fragua engine", state: "in_review" },
  ],
  queuedCount: 3,
  gate: { open: false },
  trophies: [{ wo: "WO-06-005" }, { wo: "WO-06-006" }, { wo: "WO-06-007" }],
  archivedCount: 2,
  project: { done: 24, total: 48 },
  events: [],
  active: true,
  lastEventAt: "2026-06-20T10:00:00Z",
};

// ---------------------------------------------------------------------------
// Preview page
// ---------------------------------------------------------------------------

export default function PreviewWo06007(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-surface, #111)",
        color: "var(--color-text, #eee)",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        padding: "24px",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1rem", color: "var(--color-text-muted, #888)" }}>
        Preview: WO-06-007 — La Fragua scene (DR-056 fidelity check)
      </h1>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted, #888)" }}>
        Compare with <code>docs/frds/frd-06-party/mocks/la-fragua.html</code>
      </p>

      {/* Active build — all 3 sections visible */}
      <section>
        <h2 style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
          Estado: activo (4 WOs corriendo, 3 en cola)
        </h2>
        <PartyScene snapshot={FIXTURE_SNAPSHOT} />
      </section>

      {/* Factory off state */}
      <section>
        <h2 style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>Estado: fábrica apagada</h2>
        <PartyScene snapshot={{ ...FIXTURE_SNAPSHOT, active: false }} />
      </section>

      {/* All in_review — JudgeSprite should be active */}
      <section>
        <h2 style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
          Estado: todos en revisión (Judge activo)
        </h2>
        <PartyScene
          snapshot={{
            ...FIXTURE_SNAPSHOT,
            running: [
              { wo: "WO-06-001", title: "Event VM module", state: "in_review" },
              { wo: "WO-06-002", title: "Layout module", state: "in_review" },
              { wo: "WO-06-003", title: "State map", state: "in_review" },
              { wo: "WO-06-004", title: "Fragua engine", state: "in_review" },
            ],
            gate: { open: true },
          }}
        />
      </section>
    </div>
  );
}
