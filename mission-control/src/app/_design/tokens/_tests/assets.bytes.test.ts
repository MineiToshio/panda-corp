/** WO-13-010 — CMP-13-assets and fonts: staged public files are byte-identical to the prototype's (LESSON-0216). AC-13-010.2. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../../..");
const PROTO = path.join(ROOT, "docs/design/prototype/assets");
const same = (proto: string, pub: string) => {
  const a = fs.readFileSync(path.join(PROTO, proto));
  const b = fs.readFileSync(path.join(ROOT, "public", pub));
  expect(a.length, pub).toBeGreaterThan(0);
  expect(a.equals(b), pub).toBe(true);
};

describe("AC-13-010.2: staged assets are original bytes", () => {
  it("fonts and licences", () => {
    for (const f of [
      "SpaceGrotesk.ttf",
      "JetBrainsMono.ttf",
      "inter-400.ttf",
      "inter-500.ttf",
      "inter-600.ttf",
      "inter-700.ttf",
      "inter-800.ttf",
      "SpaceGrotesk-LICENSE.txt",
      "Inter-OFL.txt",
      "JetBrainsMono-LICENSE.txt",
    ])
      same(f, `fonts/${f}`);
    expect(fs.existsSync(path.join(ROOT, "public/fonts/manrope-400.ttf"))).toBe(false);
  });

  it("brand mark, agent sprites, zone rooms and ranks", () => {
    same("pandacorp.png", "brand/pandacorp.png");
    for (const f of fs
      .readdirSync(PROTO)
      .filter((n) => n.endsWith(".png") && n !== "pandacorp.png"))
      same(f, `prototype/assets/agents/${f}`);
    for (const f of fs.readdirSync(path.join(PROTO, "zones")))
      same(`zones/${f}`, `prototype/assets/zones/${f}`);
    for (const f of fs.readdirSync(path.join(PROTO, "ranks"))) same(`ranks/${f}`, `ranks/${f}`);
  });
});
