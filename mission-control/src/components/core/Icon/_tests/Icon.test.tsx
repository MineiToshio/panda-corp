/** WO-13-010 — CMP-13-icon: the data module corresponds exactly to the exported SVG files. REQ-13-009. */
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "../Icon";
import { ICON_NODES } from "../iconData";

const DIR = path.resolve(__dirname, "../../../../../docs/design/prototype/icons");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".svg"));

describe("AC-13-010.2: Icon data and rendering", () => {
  it("name set and child markup equal the exported files", () => {
    expect(Object.keys(ICON_NODES).sort()).toEqual(files.map((f) => f.slice(0, -4)).sort());
    for (const file of files) {
      const name = file.slice(0, -4) as keyof typeof ICON_NODES;
      const inner = fs
        .readFileSync(path.join(DIR, file), "utf8")
        .replace(/^[\s\S]*?<svg[^>]*>/, "")
        .replace(/<\/svg>\s*$/, "");
      const { container } = render(<Icon name={name} />);
      const rendered = [...(container.querySelector("svg")?.children ?? [])]
        .map((c) => c.outerHTML.replace(/\s*\/?>$/, "").replace(/<(\w+)\s/, "<$1 "))
        .join("");
      const sorted = (s: string) =>
        [...s.matchAll(/<(\w+)([^>]*?)\/?>/g)].map(
          (m) =>
            `${m[1]}|${[...(m[2] ?? "").matchAll(/([\w-]+)="([^"]*)"/g)]
              .map((a) => `${a[1]}=${a[2]}`)
              .sort()
              .join(",")}`,
        );
      expect(sorted(rendered), name).toEqual(sorted(inner));
    }
  });

  it("sizes, decorative versus labelled", () => {
    const { container, rerender } = render(<Icon name="check" size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("22");
    expect(svg?.getAttribute("class")).toBe("i lg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    rerender(<Icon name="check" size="sm" label="Completado" />);
    expect(screen.getByRole("img", { name: "Completado" }).getAttribute("width")).toBe("15");
  });
});
