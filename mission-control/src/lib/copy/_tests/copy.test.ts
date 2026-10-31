/** WO-13-010 — IF-13-copy: typed accessor over the frozen Spanish catalogue and the shared date formatters. REQ-13-009 (Spanish names). */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalogue from "@/../docs/design/microcopy.es.json";
import { type CopyKey, t, tRich } from "../copy";
import { formatDate, formatRelative } from "../dates";

function leaves(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") return [[prefix, node]];
  if (typeof node !== "object" || node === null) return [];
  const entries = Object.entries(node);
  if (entries.some(([k]) => k === "one") && entries.some(([k]) => k === "other")) return [];
  return entries.flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

describe("AC-13-010.2: copy accessor", () => {
  it("every leaf key resolves to its catalogue string once its placeholders are filled", () => {
    const all = leaves(catalogue);
    expect(all.length).toBeGreaterThan(1000);
    for (const [key, raw] of all) {
      const vars = Object.fromEntries(
        [...raw.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => [m[1] as string, "X"]),
      );
      expect(t(key as CopyKey, vars), key).toBe(raw.replace(/\{[A-Za-z0-9_]+\}/g, "X"));
    }
  });

  it("fills placeholders, throws on a missing one and selects plural forms", () => {
    expect(t("common.build.minutesAgo", { minutes: 5 })).toBe("hace 5 min");
    expect(() => t("common.build.minutesAgo")).toThrow(/missing "minutes"/);
    expect(t("configuracion.counts.standard", { count: 1 })).toBe("1 estándar");
    expect(t("configuracion.counts.standard", { count: 2 })).toBe("2 estándares");
    expect(() => t("configuracion.counts.standard")).toThrow(/count/);
    // @ts-expect-error an unknown key is a compile error
    expect(() => t("common.noSuchKey")).toThrow(/unknown key/);
  });

  it("tRich renders inline tags as elements and inserts variables as text", () => {
    const html = renderToStaticMarkup(
      tRich("inicio.projectCard.factsOrders", { done: "<i>3</i>", total: 9 }) as never,
    );
    expect(html).toBe("<b>&lt;i&gt;3&lt;/i&gt;/9</b> WO verificadas");
    expect(tRich("common.noDate")).toBe("Sin fecha");
  });
});

describe("AC-13-010.2: shared Spanish dates", () => {
  const NOW = "2026-10-21T12:00:00Z";
  it("formats absolute dates, reading date-only values in UTC and echoing the unparseable", () => {
    expect(formatDate("2026-10-19")).toBe("19 oct. 2026");
    expect(formatDate("not a date")).toBe("not a date");
  });

  it("formats relative ages from the supplied now", () => {
    expect(formatRelative("2026-10-21", NOW)).toBe("hoy");
    expect(formatRelative("2026-10-20", NOW)).toBe("ayer");
    expect(formatRelative("2026-10-16", NOW)).toBe(t("common.relativeTime.days", { days: 5 }));
    expect(formatRelative("2026-10-21T11:30:00Z", NOW)).toBe("hace 30 min");
    expect(formatRelative("2026-10-21T09:00:00Z", NOW)).toBe("hace 3 h");
    expect(formatRelative("garbage", NOW)).toBe("sin registro");
  });
});

it.each([
  "N/A 3",
  "2026-02-30",
  "2026-02-29",
  "2026-04-31",
])("REQ-04-011: invalid date %s stays raw", (value) => expect(formatDate(value)).toBe(value));
it("REQ-04-011: a valid leap day is formatted", () => {
  expect(formatDate("2024-02-29")).toContain("29");
  expect(formatDate("2024-02-29")).not.toBe("2024-02-29");
});
