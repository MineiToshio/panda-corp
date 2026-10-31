import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { SURFACES } from "./routes";

// Reviewer-authored (DR-080), FRD-13 close: the contracts a stylesheet read cannot prove, measured on
// the real surfaces in both themes. Motion is reduced before axe runs, because a card caught mid
// entrance reports a contrast its settled colour does not have (LESSON-0047).
const THEMES = ["light", "dark"] as const;
const NUMERIC_TEXT = /^[\d\s.,:/%+-]+$/;

async function open(page: Page, path: string, theme: (typeof THEMES)[number]): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.route("**/api/live**", (route) => route.abort());
  await page.goto(path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

for (const surface of SURFACES) {
  for (const theme of THEMES) {
    test(`AA contrast · ${surface.id} · ${theme}`, async ({ page }) => {
      await open(page, surface.path, theme);
      const axe = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      const failures = axe.violations.flatMap((rule) =>
        rule.nodes.map((node) => `${node.target.join(" ")}: ${node.any[0]?.message}`),
      );
      expect(failures).toEqual([]);
    });
  }

  test(`reduced motion leaves nothing running · ${surface.id}`, async ({ page }) => {
    await open(page, surface.path, "dark");
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .map((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return `${target?.tagName ?? "?"}.${target?.getAttribute("class") ?? ""}`;
        }),
    );
    expect(running).toEqual([]);
  });

  test(`no text below 12 px and tabular figures · ${surface.id}`, async ({ page }) => {
    await open(page, surface.path, "dark");
    const failures = await page.evaluate(() => {
      const scaleOf = (element: Element): number => {
        let scale = 1;
        for (let node: Element | null = element; node; node = node.parentElement) {
          const { transform } = getComputedStyle(node);
          if (transform !== "none") scale *= new DOMMatrix(transform).a;
        }
        return scale;
      };
      const rendered = (node: Node): HTMLElement | null => {
        const parent = node.parentElement;
        if (!parent || !node.textContent?.trim()) return null;
        if (parent.closest("script,style,nextjs-portal,.sr-only")) return null;
        const style = getComputedStyle(parent);
        const hidden = style.visibility === "hidden" || style.display === "none";
        return hidden || parent.getBoundingClientRect().width <= 1 ? null : parent;
      };
      const found: { text: string; where: string; size: number; tabular: boolean }[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const parent = rendered(walker.currentNode);
        if (!parent) continue;
        const style = getComputedStyle(parent);
        found.push({
          text: walker.currentNode.textContent?.trim().slice(0, 30) ?? "",
          where: `${parent.tagName}.${parent.className}`,
          size: Number.parseFloat(style.fontSize) * scaleOf(parent),
          tabular: style.fontVariantNumeric.includes("tabular-nums"),
        });
      }
      for (const label of document.querySelectorAll<SVGTextElement>("svg text")) {
        const matrix = label.getScreenCTM();
        const style = getComputedStyle(label);
        if (!matrix || !label.textContent?.trim() || style.visibility === "hidden") continue;
        found.push({
          text: label.textContent.trim().slice(0, 30),
          where: "svg text",
          size: Number.parseFloat(style.fontSize) * Math.hypot(matrix.a, matrix.b),
          tabular: style.fontVariantNumeric.includes("tabular-nums"),
        });
      }
      return found;
    });
    const small = failures.filter(({ size }) => size < 11.95);
    const proportional = failures.filter(
      ({ text, tabular }) => NUMERIC_TEXT.test(text) && /\d/.test(text) && !tabular,
    );
    expect(
      small.map(({ text, where, size }) => `${size.toFixed(1)}px ${text} in ${where}`),
    ).toEqual([]);
    expect(proportional.map(({ text, where }) => `${text} in ${where}`)).toEqual([]);
  });

  test(`no request leaves the machine · ${surface.id}`, async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(baseURL ?? "") && !url.startsWith("data:") && !url.startsWith("blob:")) {
        external.push(url);
      }
    });
    await open(page, surface.path, "dark");
    await page.evaluate(() => document.fonts.ready);
    expect(external).toEqual([]);
    const families = await page.evaluate(() => [...document.fonts].map((font) => font.status));
    expect(families).not.toContain("error");
  });
}

test("AC-13-010.3: tabbing on a phone never leaves focus under a sticky bar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await open(page, "/manual", "dark");
  const covered: string[] = [];
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press("Tab");
    const issue = await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement;
      const box = focused.getBoundingClientRect();
      const y = box.top + box.height / 2;
      const hit = document.elementFromPoint(box.left + box.width / 2, y);
      const clear = !hit || hit.closest("nextjs-portal") || focused.contains(hit);
      return clear || hit.contains(focused)
        ? null
        : `${focused.tagName} "${focused.textContent?.slice(0, 24)}" under ${hit.tagName}`;
    });
    if (issue) covered.push(issue);
  }
  expect(covered).toEqual([]);
});
