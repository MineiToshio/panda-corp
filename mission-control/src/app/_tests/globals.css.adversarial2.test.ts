/** WO-13-010 — adversarial: the v1 compatibility layer never redefines an Órbita name. AC-13-010.4. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const tokens = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/design/design-tokens.json"), "utf8"),
);

describe("AC-13-010.4: compatibility layer boundary", () => {
  it("AC-13-010.4: no Órbita token name is declared inside the fenced v1 block", () => {
    const start = css.indexOf("v1 compatibility layer");
    const end = css.indexOf("/* .manual-live");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const declared = [...css.slice(start, end).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map(
      (m) => m[1],
    );
    const orbita = new Set(
      Object.values(tokens.light as Record<string, Record<string, string>>).flatMap((g) =>
        Object.keys(g),
      ),
    );
    expect(declared.filter((n) => orbita.has(n as string))).toEqual([]);
  });
});
