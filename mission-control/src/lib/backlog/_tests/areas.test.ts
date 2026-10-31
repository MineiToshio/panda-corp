import { expect, it } from "vitest";
import { backlogAreaKey, countByArea } from "../areas";

it("maps all area codes through one resolver", () => {
  expect(
    [
      "build-engine",
      "plugin-skill",
      "templates",
      "hooks",
      "plugin-hooks",
      "standards",
      "mission-control",
      "plugin-agent",
      "plugin",
      "unknown",
      "toString",
    ].map(backlogAreaKey),
  ).toEqual([
    "buildEngine",
    "pluginSkill",
    "templates",
    "hooks",
    "hooks",
    "standards",
    "missionControl",
    "pluginAgent",
    "plugin",
    "other",
    "other",
  ]);
});

it("counts merged areas, sorting ties by key and supporting empty input", () => {
  expect(
    countByArea(
      ["hooks", "plugin-hooks", "plugin", "templates", "unknown"].map((area) => ({ area })),
    ),
  ).toEqual([
    { key: "hooks", count: 2 },
    { key: "other", count: 1 },
    { key: "plugin", count: 1 },
    { key: "templates", count: 1 },
  ]);
  expect(countByArea([])).toEqual([]);
});
