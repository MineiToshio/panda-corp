/** FRD-03 REVIEWER: boundaries of the relative age and the source shape of the recovery command. */
import { describe, expect, it } from "vitest";
import { formatAgo } from "../formatAgo";
import { allProjects } from "../portfolio";

const NOW = new Date("2026-10-30T12:00:00Z");
const minutesAgo = (minutes: number): string =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();
const plain = (text: string): string => text.replace(/\s/g, " ");

describe("REQ-03-007 relative age boundaries (reviewer)", () => {
  it.each([
    [59, "hace menos de 1 h"],
    [60, "hace 1 h"],
    [43 * 60, "hace 43 h"],
    [48 * 60 - 1, "hace 47 h"],
    [48 * 60, "hace 2 días"],
    [24 * 60 * 90, "hace 90 días"],
  ])("%i minutes ago reads %s", (minutes, label) => {
    expect(plain(formatAgo(minutesAgo(minutes), NOW))).toBe(label);
  });

  it("a clock-skewed future commit never reads as a negative age", () => {
    expect(plain(formatAgo(minutesAgo(-600), NOW))).toBe("hace menos de 1 h");
  });

  it.each([null, "", "not-a-date"])("%j reads as no record, never NaN", (value) => {
    expect(formatAgo(value, NOW)).toBe("sin registro");
  });
});

describe("portfolio source (reviewer)", () => {
  const table = (repo: string, phase: string): string =>
    [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      `| Gone | /nonexistent/gone | ${repo} | x | ${phase} | — | — | — | 2026-06-15 |`,
      "",
    ].join("\n");

  it("U2: a markdown-link repo cell yields a bare URL fit for `git clone`", () => {
    const [item] = allProjects(table("[repo](https://github.com/acme/gone)", "architecture"));
    expect(item?.repo).toBe("https://github.com/acme/gone");
  });

  it.each([
    ["product", "product"],
    ["design", "design"],
    ["producto", "product"],
    ["diseño", "design"],
  ])("REQ-03-001: advisory phase %s resolves to %s", (cell, phase) => {
    expect(allProjects(table("—", cell))[0]?.stage).toBe(phase);
  });

  it("REQ-03-001: an unknown advisory phase is kept, not dropped", () => {
    const items = allProjects(table("—", "unheard-of"));
    expect(items).toHaveLength(1);
    expect(items[0]?.stage).toBeUndefined();
  });
});
