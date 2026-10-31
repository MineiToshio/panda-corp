import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectLastAchievement } from "../achievement";
import { deriveFlightGroups } from "../flight";
import { readProjectInbox } from "../inbox";
import { pulseTiles } from "../pulse";
import { deriveOwnerTurn } from "../turn";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "inicio-"));
  fs.mkdirSync(path.join(root, ".pandacorp/inbox/changes"), { recursive: true });
});
afterEach(() => {
  // Remove only known fixture files; managed-state directories remain intact.
  fs.rmSync(path.join(root, ".pandacorp/inbox/changes/ready.md"), { force: true });
  fs.rmSync(path.join(root, ".pandacorp/inbox/decisions.md"), { force: true });
});
const instant = "2026-10-30T12:00:00Z";
function inbox() {
  return readProjectInbox({ name: "Example", id: "example", path: root });
}
function change(status: string) {
  fs.writeFileSync(
    path.join(root, ".pandacorp/inbox/changes/ready.md"),
    `---\ntype: change\nstatus: ${status}\ndate: '2026-10-20'\n---\n# Improve search\nKeep the query.`,
  );
}
describe("Inicio resolvers", () => {
  it("AC-18-022.2 REQ-18-010/011/012: decisions first, resolved and engine logs excluded, ready only, scoped count", () => {
    fs.writeFileSync(
      path.join(root, ".pandacorp/inbox/decisions.md"),
      "## 2026-10-20 (PENDIENTE) — Choose hosting\n**Qué decidir:** Pick A.\n## 2026-10-20 (PENDIENTE) — Finished\n- **Estado:** RESUELTO\n## 2026-10-20 — 12:30 Engine tick",
    );
    change("ready");
    const result = deriveOwnerTurn([inbox()], instant);
    expect(result.count).toBe(2);
    expect(result.items.map((item) => item.kind)).toEqual(["decision", "change"]);
    expect(result.items[0]).toMatchObject({
      command: "/pandacorp:decide 2026-10-20-1",
      ageDays: 10,
      ask: "Pick A.",
    });
    expect(result.items[1]?.command).toBe("/pandacorp:implement change:ready");
    expect(deriveOwnerTurn([inbox()], instant, "other").count).toBe(0);
    change("building");
    expect(deriveOwnerTurn([inbox()], instant).count).toBe(1);
  });
  it("AC-18-022.3: building and drafts stay out of the owner queue and empty groups disappear", () => {
    expect(deriveFlightGroups([inbox()])).toEqual([]);
    change("building");
    expect(deriveFlightGroups([inbox()])[0]).toMatchObject({
      kind: "building",
      rows: [{ title: "Improve search" }],
    });
    change("draft");
    expect(deriveOwnerTurn([inbox()], instant).count).toBe(0);
    expect(deriveFlightGroups([inbox()])[0]).toMatchObject({ kind: "draft", rows: [{ count: 1 }] });
  });
  it("REQ-18-003: malformed sources surface named errors instead of a calm queue", () => {
    fs.writeFileSync(
      path.join(root, ".pandacorp/inbox/decisions.md"),
      "## Malformed decision\nNo supported heading",
    );
    change("invalid");
    const result = deriveOwnerTurn([inbox()], instant);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ project: "Example", source: "decisions" }),
        expect.objectContaining({ project: "Example", source: "changes" }),
      ]),
    );
  });
  it("AC-18-022.4 AC-12-001.3: pulse uses the card counts with no more than five signals", () => {
    expect(pulseTiles([])).toHaveLength(3);
    expect(pulseTiles([]).map((tile) => tile.value)).toEqual([0, 0, 0]);
  });
  it("REQ-18-012: decisions across projects precede changes and no queue truncates silently", () => {
    change("ready");
    const first = inbox();
    const second = {
      ...first,
      id: "second",
      name: "Second",
      changes: [],
      decisions: Array.from({ length: 30 }, (_, index) => ({
        id: `choice-${index}`,
        title: `Choice ${index}`,
        date: "2026-10-20",
        status: "pending" as const,
        resolved: false,
      })),
    };
    const result = deriveOwnerTurn([first, second], instant);
    expect(result.count).toBe(31);
    expect(result.items.slice(0, 30).every((item) => item.kind === "decision")).toBe(true);
    expect(result.items.at(-1)?.kind).toBe("change");
    expect(deriveOwnerTurn([first, second], instant, "second").count).toBe(30);
  });
  it("REQ-18-004: last achievement uses numeric date order and one seven-day freshness predicate", () => {
    const base = {
      name: "First",
      category: "Discovery" as const,
      rarity: "Común" as const,
      condition: "",
      unlocked: true,
    };
    expect(
      selectLastAchievement([{ ...base, date: "2026-10-29T12:00:00Z" }], instant),
    ).toMatchObject({ title: "First", fresh: true });
    expect(selectLastAchievement([{ ...base, date: "2026-10-01" }], instant)?.fresh).toBe(false);
    expect(selectLastAchievement([], instant)).toBeNull();
  });
});

it("preserves valid pending decisions alongside unsupported headings", () => {
  fs.writeFileSync(
    path.join(root, ".pandacorp/inbox/decisions.md"),
    "## OPEN: Choose hosting\n## Unsupported heading\n- **Estado:** RESUELTO\n## RESUELTO — Finished\n## RESUELTO: Also finished\n",
  );
  const result = deriveOwnerTurn([inbox()], instant);
  expect(result.items.map((item) => item.title)).toEqual(["Choose hosting"]);
  expect(result.errors).toEqual([{ project: "Example", source: "decisions" }]);
});
it.each([
  "obsolete",
  "discarded",
  "ready # queued",
  "'discarded # archived'",
])("accepts closed and commented queue status %s without a false notice", (status) => {
  change(status);
  const result = deriveOwnerTurn([inbox()], instant);
  expect(result.errors).toEqual([]);
  expect(result.count).toBe(status.startsWith("ready") ? 1 : 0);
});
