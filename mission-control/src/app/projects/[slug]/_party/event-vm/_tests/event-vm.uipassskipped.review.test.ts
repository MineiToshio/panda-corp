/**
 * Reviewer-authored adversarial suite (DR-080) — UiPassSkipped end to end.
 *
 * Drives the REAL pipeline the Party tab uses (readEvents → isFeedEvent →
 * toEventVM) with the exact shapes pandacorp-build.js emits: `pass` as a
 * string, `frd` as a comma-joined FRD list or "" (empty builtFrds), and a
 * PreviewSmoke boolean `pass` interleaved in the same stream.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEvents } from "@/lib/events/events";
import { EVENT_ICON, isFeedEvent, toEventVM } from "../event-vm";

describe("UiPassSkipped — reviewer adversarial (real emitter shapes)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-uipassskipped-review-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function feedFrom(lines: readonly object[]) {
    const file = path.join(tmpDir, "events.ndjson");
    fs.writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
    return readEvents({ path: file }).events.filter(isFeedEvent).map(toEventVM);
  }

  it("renders a multi-FRD foundation-gate skip with pass, every FRD and the reason, own glyph", () => {
    const [vm] = feedFrom([
      {
        event: "UiPassSkipped",
        at: "2026-09-23T10:00:00Z",
        project: "mission-control",
        pass: "foundation-gate",
        frd: "frd-03-board, frd-06-party",
        reason: "no-ui-artifacts",
      },
    ]);
    expect(vm).toBeDefined();
    expect(vm?.icon).toBe(EVENT_ICON.ui_pass_skipped);
    expect(vm?.label).toBe(
      "Pase de UI omitido: foundation-gate · frd-03-board, frd-06-party · no-ui-artifacts",
    );
    expect(vm?.isFailure).toBe(false);
  });

  it("an empty frd (visual-qa with no built FRDs) leaves no dangling separator", () => {
    const [vm] = feedFrom([
      {
        event: "UiPassSkipped",
        at: "2026-09-23T10:00:01Z",
        pass: "visual-qa",
        frd: "",
        reason: "agent-no-result",
      },
    ]);
    expect(vm?.label).toBe("Pase de UI omitido: visual-qa · agent-no-result");
    expect(vm?.label).not.toMatch(/·\s*·|·\s*$/);
  });

  it("an interleaved PreviewSmoke keeps its boolean verdict and never picks up the skipped-pass text", () => {
    const vms = feedFrom([
      {
        event: "UiPassSkipped",
        at: "2026-09-23T10:00:02Z",
        pass: "visual-qa",
        reason: "no-ui-artifacts",
      },
      {
        event: "PreviewSmoke",
        at: "2026-09-23T10:00:03Z",
        frd: "frd-06-party",
        pass: false,
        routes: 4,
        failed: 1,
      },
      {
        event: "PreviewSmoke",
        at: "2026-09-23T10:00:04Z",
        frd: "frd-06-party",
        pass: true,
        routes: 4,
        failed: 0,
      },
    ]);
    const smokes = vms.filter(
      (vm) => vm.icon === EVENT_ICON.test_fail || vm.icon === EVENT_ICON.test_ok,
    );
    expect(smokes).toHaveLength(2);
    expect(smokes.map((vm) => vm.isFailure)).toEqual([true, false]);
    for (const vm of smokes) expect(vm.label).not.toContain("visual-qa");
    expect(vms.filter((vm) => vm.icon === EVENT_ICON.ui_pass_skipped)).toHaveLength(1);
  });
});
