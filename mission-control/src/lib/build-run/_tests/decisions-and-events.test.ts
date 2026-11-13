import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  countPendingDecisions,
  parseDecisionBlocks,
  readDecisionSource,
} from "../../docs/activity";
import { readEvents } from "../../events/events";

const roots: string[] = [];
function root() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-v2-decisions-"));
  roots.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of roots.splice(0)) fs.rmSync(dir, { recursive: true });
});
const block = (status: string) =>
  `## 2026-11-12 - Duda d-17: elegir almacenamiento\n- **Id:** \`d-17\` (unidad \`u1\`, build \`run-a\`)\n- **Qué decidir:** ¿Qué opción?\n- **Estado:** ${status}\n`;
it("preserves explicit engine Id and merges resolved mirrors before counting badges", () => {
  const dir = root(),
    inbox = path.join(dir, ".pandacorp/inbox");
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, "decisions.md"), block("PENDIENTE"));
  fs.writeFileSync(path.join(inbox, "decisions.pending.md"), block("RESUELTO: opción A"));
  expect(readDecisionSource(dir)).toMatchObject({
    invalid: false,
    decisions: [{ id: "d-17", resolved: true }],
  });
  expect(countPendingDecisions(dir)).toBe(0);
  expect(parseDecisionBlocks("## 2026-11-12 - Legacy question")[0]?.id).toBe("2026-11-12-1");
});
it("present unreadable or malformed mirror is a source error and canonical decisions survive", () => {
  const dir = root(),
    inbox = path.join(dir, ".pandacorp/inbox");
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, "decisions.md"), block("PENDIENTE"));
  fs.writeFileSync(path.join(inbox, "decisions.pending.md"), "malformed content");
  expect(readDecisionSource(dir)).toMatchObject({
    invalid: true,
    decisions: [{ id: "d-17" }],
    errors: [{ path: path.join(inbox, "decisions.pending.md") }],
  });
  fs.unlinkSync(path.join(inbox, "decisions.pending.md"));
  fs.mkdirSync(path.join(inbox, "decisions.pending.md"));
  expect(readDecisionSource(dir).invalid).toBe(true);
});
it("recognizes v2 vocabulary aliases and scaling payload, filtering project before cap", () => {
  const file = path.join(root(), "events.ndjson");
  const names = [
    "build.scaled",
    "BuildScaled",
    "build_scaled",
    "review.recorded",
    "quota.reading",
    "engine.failure",
    "autonomous.decision",
    "build.handoff",
    "build.waiting-gate",
    "unit.parked",
    "admit.decision",
    "wo_commit",
  ];
  fs.writeFileSync(
    file,
    names
      .map((event) =>
        JSON.stringify({
          event,
          at: "2026-11-12T12:00:00Z",
          project: "p",
          runtime: "codex",
          run_id: "run-a",
          data: { from: 5, to: 3, reason: "swapouts", unit: "u1" },
        }),
      )
      .concat(
        JSON.stringify({ event: "build.scaled", at: "2026-11-12T12:01:00Z", project: "other" }),
      )
      .join("\n"),
  );
  const events = readEvents({ path: file, project: "p", cap: 12 }).events;
  expect(events).toHaveLength(12);
  expect(events.slice(0, 3)).toEqual(
    Array(3).fill(
      expect.objectContaining({
        semanticName: "build.scaled",
        from: 5,
        to: 3,
        reason: "swapouts",
        runId: "run-a",
      }),
    ),
  );
  expect(events.every((e) => !e.semanticName?.startsWith("legacy."))).toBe(true);
});
