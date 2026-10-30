/**
 * WO-13-010 — root layout: Spanish document, boot script in <head> before first paint,
 * no next/font anywhere (fonts are self-hosted via @font-face). AC-13-010.2.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/bootScript";
import RootLayout from "../layout";

let tmpRoot: string;
const ORIGINAL = process.env.PANDACORP_FACTORY_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-layout-theme-"));
  fs.mkdirSync(path.join(tmpRoot, "factory"), { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
  else process.env.PANDACORP_FACTORY_ROOT = ORIGINAL;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function childElements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).filter(isValidElement) as ReactElement<Record<string, unknown>>[];
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(full);
    return /\.(ts|tsx|css)$/.test(e.name) ? [full] : [];
  });
}

describe("AC-13-010.2: root layout", () => {
  it("AC-13-010.2: <html lang=es> carries the boot script first in <head>, before the stylesheet link", () => {
    fs.writeFileSync(path.join(tmpRoot, "factory", "profile.md"), "---\nname: Ada\n---\n# Ada\n");
    const html = RootLayout({ children: null }) as ReactElement<{
      lang: string;
      suppressHydrationWarning: boolean;
      children: ReactNode;
    }>;
    expect(html.props.lang).toBe("es");
    expect(html.props.suppressHydrationWarning).toBe(true);
    const head = childElements(html.props.children).find((e) => e.type === "head");
    const [first, second] = childElements(head?.props.children as ReactNode);
    expect(first?.type).toBe("script");
    expect((first?.props.dangerouslySetInnerHTML as { __html: string }).__html).toBe(
      THEME_BOOT_SCRIPT,
    );
    expect(second?.type).toBe("link");
  });

  it("AC-13-010.2: nothing under src/ imports next/font or names Pixelify Sans", () => {
    const here = path.resolve(__dirname, "../..");
    const offenders = walk(here).filter((f) => {
      if (/_tests|\.test\./.test(f)) return false;
      return /next\/font|Pixelify/.test(
        fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""),
      );
    });
    expect(offenders).toEqual([]);
  });
});
