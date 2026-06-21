/**
 * WO-14-002 — Preview route (fidelity check only, not shipped behavior)
 *
 * Renders SnapshotPanel in three states against the frozen prototype:
 *   1. Normal — last green commit, no build running, fresh
 *   2. Building — build in progress at 67%, no staleness
 *   3. Stale — last green commit + building + stale warning (Banner tone=warn)
 *
 * Visual reference: docs/design/prototype/index.html → snapshotPanel(i) (~L867)
 * + bStalenessPanel(i) (~L876), on the frozen tokens.
 *
 * DR-056 fidelity check: compare screenshots of this route against the prototype
 * before marking IN_REVIEW.
 */

import { SnapshotPanel } from "@/app/projects/[slug]/_components/snapshot-panel/snapshot-panel";
import type { SnapshotInfo } from "@/lib/snapshot/snapshot";

const NORMAL_SNAPSHOT: SnapshotInfo = {
  sha: "d150223",
  safeToTest: true,
  worktreeCommand: "git worktree add ../mission-control-review d150223",
  stale: false,
};

const BUILDING_SNAPSHOT: SnapshotInfo = {
  sha: "d150223",
  safeToTest: true,
  worktreeCommand: "git worktree add ../mission-control-review d150223",
  buildingNow: "building now: 67%",
  stale: false,
};

const STALE_SNAPSHOT: SnapshotInfo = {
  sha: "abc1234",
  safeToTest: true,
  worktreeCommand: "git worktree add ../mission-control-review abc1234",
  buildingNow: "building now: 83%",
  stale: true,
};

const NOT_SAFE_SNAPSHOT: SnapshotInfo = {
  sha: "d150223",
  safeToTest: false,
  worktreeCommand: "git worktree add ../mission-control-review d150223",
  buildingNow: "building now: 45%",
  stale: false,
};

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: "32px",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text3, var(--color-text2))",
  marginBottom: "8px",
};

export default function PreviewWo14002(): React.JSX.Element {
  return (
    <main
      data-testid="preview-wo14002"
      style={{
        padding: "24px",
        maxWidth: "640px",
        background: "var(--color-base, var(--color-panel))",
        minHeight: "100dvh",
        color: "var(--color-text)",
      }}
    >
      <h1
        style={{
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "24px",
          color: "var(--color-text)",
        }}
      >
        WO-14-002 — SnapshotPanel fidelity preview
      </h1>

      {/* State 1: Normal — fresh green commit, no build running */}
      <div style={SECTION_STYLE}>
        <p style={LABEL_STYLE}>1 · Normal (fresco, sin build)</p>
        <SnapshotPanel slug="mission-control" snapshot={NORMAL_SNAPSHOT} />
      </div>

      {/* State 2: Building — build at 67%, fresh */}
      <div style={SECTION_STYLE}>
        <p style={LABEL_STYLE}>2 · Building (build en progreso al 67%)</p>
        <SnapshotPanel slug="mission-control" snapshot={BUILDING_SNAPSHOT} />
      </div>

      {/* State 3: Stale + building — staleness warning Banner */}
      <div style={SECTION_STYLE}>
        <p style={LABEL_STYLE}>3 · Stale + building (Banner warn)</p>
        <SnapshotPanel slug="mission-control" snapshot={STALE_SNAPSHOT} />
      </div>

      {/* State 4: safeToTest=false — warn Chip, heading without "seguro para probar" */}
      <div style={SECTION_STYLE}>
        <p style={LABEL_STYLE}>4 · safeToTest=false (HEAD avanzó, chip warn)</p>
        <SnapshotPanel slug="mission-control" snapshot={NOT_SAFE_SNAPSHOT} />
      </div>

      {/* State 5: No snapshot — panel omitted */}
      <div style={SECTION_STYLE}>
        <p style={LABEL_STYLE}>5 · Sin snapshot (panel omitido)</p>
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-text3, var(--color-text2))",
            fontStyle: "italic",
          }}
        >
          (snapshot=null → no panel rendered)
        </div>
        <SnapshotPanel slug="mission-control" snapshot={null} />
      </div>
    </main>
  );
}
