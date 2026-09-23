/**
 * events — UiPassSkipped field parsing (render-uipassskipped-timeline change).
 *
 * The real emitter (pandacorp-build.js) writes `pass` as a STRING naming which
 * UI pass was skipped ("foundation-gate" | "visual-qa") — a different meaning
 * from PreviewSmoke's `pass` (boolean pass/fail flag). Both share the same raw
 * field name, so the string form is parsed into its own `uiPass` field, keeping
 * `pass: boolean` untouched for PreviewSmoke.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEvents } from "../events";

describe("readEvents — UiPassSkipped field parsing", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-events-uipassskipped-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNdjson(lines: object[]): string {
    const file = path.join(tmpDir, "events.ndjson");
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));
    return file;
  }

  it("parses the real production-shaped UiPassSkipped line (pass string, frd, reason)", () => {
    const file = writeNdjson([
      {
        event: "UiPassSkipped",
        at: "2026-09-23T10:00:00Z",
        project: "mission-control",
        pass: "foundation-gate",
        frd: "frd-06-party",
        reason: "no-ui-artifacts",
      },
    ]);
    const [ev] = readEvents({ path: file }).events;
    expect(ev?.event).toBe("UiPassSkipped");
    expect(ev?.uiPass).toBe("foundation-gate");
    expect(ev?.frd).toBe("frd-06-party");
    expect(ev?.reason).toBe("no-ui-artifacts");
  });

  it("does not collide with PreviewSmoke's boolean `pass` (different fields)", () => {
    const file = writeNdjson([
      { event: "PreviewSmoke", at: "2026-09-23T10:00:01Z", pass: false, routes: 5, failed: 2 },
      {
        event: "UiPassSkipped",
        at: "2026-09-23T10:00:02Z",
        pass: "visual-qa",
        reason: "agent-no-result",
      },
    ]);
    const { events } = readEvents({ path: file });
    expect(events[0]?.pass).toBe(false);
    expect(events[0]?.uiPass).toBeUndefined();
    expect(events[1]?.pass).toBeUndefined();
    expect(events[1]?.uiPass).toBe("visual-qa");
  });

  it("drops a malformed (non-string) `pass` on UiPassSkipped without dropping the event", () => {
    const file = writeNdjson([
      { event: "UiPassSkipped", at: "2026-09-23T10:00:03Z", pass: 42, reason: "no-ui-artifacts" },
    ]);
    const [ev] = readEvents({ path: file }).events;
    expect(ev?.event).toBe("UiPassSkipped");
    expect(ev?.uiPass).toBeUndefined();
    expect(ev?.reason).toBe("no-ui-artifacts");
  });
});
