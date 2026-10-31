import { describe, expect, it } from "vitest";
import { navActive } from "../navActive";

describe("shell active destination mapping", () => {
  it.each([
    ["/", "inicio"],
    ["/board", "tablero"],
    ["/board/idea/proposal", "tablero"],
    ["/portfolio", "portfolio"],
    ["/portfolio/project/spec", "portfolio"],
    ["/projects", "portfolio"],
    ["/projects/mission-control/summary", "portfolio"],
    ["/proposals/memory", "propuestas"],
    ["/achievements", "logros"],
    ["/manual/reference", "documentacion"],
    ["/configuration/rules", "configuracion"],
    ["/manual-other", null],
    ["/projects-other", null],
    ["/boardwalk", null],
    ["/missing", null],
    ["", null],
    ["manual", null],
  ])("AC-19-002.2, AC-25-010.1: %s maps to %s", (path, expected) => {
    expect(navActive(path)).toBe(expected);
  });
});
