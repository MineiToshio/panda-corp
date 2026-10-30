/** WO-13-010 — adversarial: no pixel-RPG residue survives in the Órbita stylesheet. AC-13-010.2, AC-13-010.4. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs
  .readFileSync(path.resolve(__dirname, "../globals.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("AC-13-010.2: no v1 skin residue", () => {
  it("AC-13-010.2: no Pixelify variable, no light-theme attribute selector, no v1 three-elevation set", () => {
    expect(css).not.toMatch(/--font-pixelify|Pixelify/);
    expect(css).not.toMatch(/\[data-theme="light"\]/);
    expect(css).not.toMatch(/--color-card2:\s*#/);
  });

  it("AC-13-010.4: the .fragua scope never redeclares the scene tokens themselves", () => {
    const fragua = css.slice(css.indexOf(".fragua {"));
    const block = fragua.slice(0, fragua.indexOf("}"));
    expect(block.match(/^\s*--scene-[a-z0-9-]+\s*:/gm)).toBeNull();
  });
});
