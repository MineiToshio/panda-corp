import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { backlogAreaKey, countByArea } from "../areas";

const catalogue = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "docs/design/microcopy.es.json"), "utf8"),
) as { propuestas: { backlog: { areas: Record<string, string> } } };

describe("IF-22-areas", () => {
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
    "valueOf",
    "",
  ])("maps the inherited or empty name %j to other", (area) => {
    expect(backlogAreaKey(area)).toBe("other");
  });

  it.each([
    "Hooks",
    "HOOKS",
    " hooks",
    "build_engine",
    "buildEngine",
  ])("does not guess at the near-miss code %j", (area) => {
    expect(backlogAreaKey(area)).toBe("other");
  });

  it("every leaf resolves in the copy catalogue with the frozen plain name", () => {
    const expected: readonly (readonly [string, string])[] = [
      ["build-engine", "Motor de construcción"],
      ["plugin-skill", "Skills"],
      ["templates", "Plantillas de proyecto"],
      ["hooks", "Controles automáticos"],
      ["plugin-hooks", "Controles automáticos"],
      ["standards", "Estándares"],
      ["mission-control", "Mission Control"],
      ["plugin-agent", "Agentes"],
      ["plugin", "Plugin"],
      ["otros", "Otros"],
    ];
    for (const [code, name] of expected) {
      expect(catalogue.propuestas.backlog.areas[backlogAreaKey(code)]).toBe(name);
    }
  });

  it("merges, orders by count then key, and never drops an unknown area", () => {
    const items = ["hooks", "plugin-hooks", "standards", "plugin", "nuevo", "raro"].map((area) => ({
      area,
    }));
    const snapshot = JSON.stringify(items);
    expect(countByArea(items)).toEqual([
      { key: "hooks", count: 2 },
      { key: "other", count: 2 },
      { key: "plugin", count: 1 },
      { key: "standards", count: 1 },
    ]);
    expect(JSON.stringify(items)).toBe(snapshot);
    const total = countByArea(items).reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(items.length);
  });

  it("an empty list has no areas", () => {
    expect(countByArea([])).toEqual([]);
  });
});
