import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countPendingDecisions } from "@/lib/docs/activity";
import { readSummary } from "../readSummary";
import { summaryFixture } from "./summaryFixture";

let fixture: ReturnType<typeof summaryFixture>;
beforeEach(() => {
  fixture = summaryFixture();
});
afterEach(() => {
  fixture.cleanup();
  vi.unstubAllEnvs();
});
describe("Resumen read errors", () => {
  it.each([
    "unrecognized prose",
    "## Unknown decision heading\ntext",
  ])("AC-04-014.5: malformed decisions are explicit failures: %s", (source) => {
    fixture.write(".pandacorp/inbox/decisions.md", source);
    expect(readSummary(fixture.item.path).decisions.error).toBeDefined();
  });
  it("AC-04-014.5: missing and intentionally empty decisions are genuinely empty, while unreadable sources fail", () => {
    expect(readSummary(fixture.item.path).decisions).toEqual({ value: [] });
    fixture.write(".pandacorp/inbox/decisions.md", "# Decisions\n");
    expect(readSummary(fixture.item.path).decisions).toEqual({ value: [] });
    fs.unlinkSync(path.join(fixture.item.path, ".pandacorp/inbox/decisions.md"));
    fs.mkdirSync(path.join(fixture.item.path, ".pandacorp/inbox/decisions.md"));
    expect(readSummary(fixture.item.path).decisions.error).toBeDefined();
  });
});

it("preserves valid decisions with an error and isolates unknown blocks from pending status", () => {
  fixture.write(
    ".pandacorp/inbox/decisions.md",
    `# Decisions
## 2026-10-25 (PENDIENTE) — Choose stack
- **Estado:** RESUELTO
## Unknown heading
- **Estado:** PENDIENTE
## 2026-10-26 (PENDIENTE) — Choose hosting
`,
  );
  const result = readSummary(fixture.item.path).decisions;
  expect(result.error).toBeDefined();
  expect(result.value.map((point) => [point.id, point.resolved])).toEqual([
    ["2026-10-25-1", true],
    ["2026-10-26-1", false],
  ]);
  expect(countPendingDecisions(fixture.item.path)).toBe(1);
});
