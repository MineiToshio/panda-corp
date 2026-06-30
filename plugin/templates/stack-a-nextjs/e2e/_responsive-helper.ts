import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Smart responsive assertions for a single route at a target viewport (DR-074).
 *
 * This is the SHIPPED, VERBATIM-propagated fix for "the build shipped non-responsive"
 * (DR-059 mechanism: it ships as a stack template, not as prose threaded through skills).
 * It is SMART, not naïve: it distinguishes BROKEN overflow from AUTHOR-DECLARED intentional
 * horizontal scroll (a legit kanban / DAG / wide table marks itself `data-scroll-x="intentional"`),
 * so it doesn't false-red the patterns MC legitimately scrolls — while catching the four things
 * MC actually shipped: per-scroll-root overflow, silent off-canvas clipping, sub-24px tap targets,
 * and a fixed bar occluding the top of `<main>`.
 *
 * TWO TIERS (DR-074 amended 2026-06-30, owner directive):
 *   - FUNCTIONAL / "nothing breaks, everything reachable": content CLIPPED off-canvas (hidden &
 *     unreachable) and `<main>` OCCLUDED by a fixed bar (functionality hidden behind it). These are
 *     real breakage — a feature you cannot reach.
 *   - COSMETIC / polish: horizontal overflow that still SCROLLS (reachable, just ugly) and tap
 *     targets below 24px. "Looks off" but works.
 *
 * `assertResponsive` (BLOCKING) runs BOTH tiers — used at the platform the project actually targets
 * (read from `target_platforms`). `reportBreakageOnly` (ADVISORY, never throws) runs only the
 * FUNCTIONAL tier — used at the OFF-TARGET width (e.g. a desktop-only app viewed on a phone): mobile
 * polish is low-priority there, but functionality must still be reachable, so a real break is surfaced
 * loudly without red-locking the project's commits (DR-074 §5 anti-red-lock principle, preserved).
 */

const SCROLL_X_OPT_OUT = '[data-scroll-x="intentional"]';
const SUBPIXEL_TOLERANCE_PX = 1; // sub-pixel only — never a large tolerance that would hide real overflow

type ResponsiveOptions = {
  /** The viewport width to assert at (e.g. 390 for mobile). */
  readonly mobileWidth: number;
  /** Viewport height to use while asserting (default 844). */
  readonly mobileHeight?: number;
  /** Live transport endpoint glob to abort for determinism (default the canonical one). */
  readonly liveEndpointGlob?: string;
};

/**
 * Settle the page at the target viewport (the #1 flake risk). Viewport BEFORE navigation so the
 * layout is built at the target width; block the live transport so `networkidle` never hangs
 * (DR-071); wait for fonts + `<main>`. Returns the asserted width for message context.
 */
async function settle(page: Page, url: string, options: ResponsiveOptions): Promise<number> {
  const { mobileWidth, mobileHeight = 844, liveEndpointGlob = "**/api/live**" } = options;
  await page.setViewportSize({ width: mobileWidth, height: mobileHeight });
  await page.route(liveEndpointGlob, (r) => r.abort());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main").first()).toBeVisible();
  return mobileWidth;
}

/**
 * Per-scroll-root overflow detection. Returns elements that overflow their own client box, split into
 * `overflowing` (scrollable → COSMETIC) and `clipped` (overflow-x:hidden|clip while wider → content
 * hidden off-canvas → FUNCTIONAL breakage), honoring the author-declared `data-scroll-x="intentional"`
 * escape hatch (the element or any ancestor).
 */
async function detectOverflow(page: Page): Promise<{ overflowing: string[]; clipped: string[] }> {
  return page.evaluate(
    ({ optOutSelector, tolerance }) => {
      const describe = (el: Element): string => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls =
          typeof el.className === "string" && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
            : "";
        return `${tag}${id}${cls}`;
      };
      const isOptedOut = (el: Element): boolean => Boolean(el.closest(optOutSelector));

      const overflowing: string[] = [];
      const clipped: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        if (el.scrollWidth <= el.clientWidth + tolerance) continue;
        if (isOptedOut(el)) continue; // author-declared intentional scroll-x — not a defect
        const overflowX = getComputedStyle(el).overflowX;
        if (overflowX === "hidden" || overflowX === "clip") {
          // content is CLIPPED off-canvas (what MC actually shipped) — silent data loss
          clipped.push(
            `${describe(el)} (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`,
          );
        } else {
          overflowing.push(
            `${describe(el)} (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`,
          );
        }
      }
      return { overflowing, clipped };
    },
    { optOutSelector: SCROLL_X_OPT_OUT, tolerance: SUBPIXEL_TOLERANCE_PX },
  );
}

/**
 * `<main>` occlusion detection. A position:fixed element overlapping the TOP of `<main>`'s content
 * box hides content (the MC GuildBar problem) UNLESS `<main>` reserves space with scroll-margin-top
 * >= the fixed element's height (the legit sticky-header opt-out, WCAG 2.4.11). Returns a message or
 * null. FUNCTIONAL breakage — content hidden behind the bar.
 */
async function detectOcclusion(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return null;
    const mainBox = main.getBoundingClientRect();
    const scrollMarginTop = Number.parseFloat(getComputedStyle(main).scrollMarginTop) || 0;
    const occludesMainTop = (el: HTMLElement): boolean => {
      if (el === main || main.contains(el)) return false;
      if (getComputedStyle(el).position !== "fixed") return false;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return false;
      const overlapsTop = box.top <= mainBox.top && box.bottom > mainBox.top;
      const overlapsX = box.left < mainBox.right && box.right > mainBox.left;
      return overlapsTop && overlapsX && box.height > scrollMarginTop + 1;
    };
    const offender = Array.from(document.querySelectorAll<HTMLElement>("*")).find(occludesMainTop);
    if (!offender) return null;
    const box = offender.getBoundingClientRect();
    return `${offender.tagName.toLowerCase()} (fixed, height ${Math.round(box.height)}px) occludes the top of <main> (scroll-margin-top ${scrollMarginTop}px)`;
  });
}

/**
 * Asserts that `url` is responsive-correct at the target viewport — BOTH tiers, BLOCKING. Throws
 * (failing the test) with a precise message naming the offending element and the check that failed.
 */
export async function assertResponsive(
  page: Page,
  url: string,
  options: ResponsiveOptions,
): Promise<void> {
  const width = await settle(page, url, options);

  // --- Per-scroll-root overflow + silent-clip (the MC failure) ----------------
  const overflow = await detectOverflow(page);
  expect(
    overflow.overflowing,
    `${url} @${width}px — horizontal overflow (no data-scroll-x="intentional"); ` +
      `mark legit kanban/DAG/wide-table scroll-x roots, otherwise make the layout fit:\n` +
      overflow.overflowing.join("\n"),
  ).toEqual([]);
  expect(
    overflow.clipped,
    `${url} @${width}px — content CLIPPED off-canvas (overflow-x:hidden|clip while wider than the box). ` +
      `This hides content silently — fit the layout (or mark it intentional if it is a deliberate scroll-x root):\n` +
      overflow.clipped.join("\n"),
  ).toEqual([]);

  // --- Tap targets (axe `target-size`, SC 2.5.8, 24px line — NOT 44px) --------
  const axe = await new AxeBuilder({ page }).withRules(["target-size"]).analyze();
  const targetSize = axe.violations.filter((v) => v.id === "target-size");
  const tapFailures = targetSize.flatMap((v) => v.nodes.map((n) => n.target.join(" ")));
  expect(
    tapFailures,
    `${url} @${width}px — tap targets below 24px (WCAG 2.2 SC 2.5.8):\n${tapFailures.join("\n")}`,
  ).toEqual([]);

  // --- <main> not occluded by a fixed element ---------------------------------
  const occlusion = await detectOcclusion(page);
  expect(
    occlusion,
    `${url} @${width}px — a fixed element occludes the top of <main>: ${occlusion}. ` +
      `Reserve space with scroll-margin-top >= the fixed element's height (WCAG 2.4.11).`,
  ).toBeNull();
}

/**
 * ADVISORY no-break check for the OFF-TARGET width (DR-074 amended). Runs ONLY the FUNCTIONAL tier —
 * content clipped off-canvas + `<main>` occluded — i.e. "is any functionality hidden / unreachable
 * at this width?". It NEVER throws: on a desktop-only app at a phone width (or a mobile-only app on
 * desktop) cosmetic imperfection is acceptable and low-priority, but a real break (you cannot reach a
 * feature) is surfaced LOUDLY via a test annotation + console warning. Non-blocking by design so it
 * can never red-lock a project's commits (the DR-074 §5 anti-red-lock principle).
 */
export async function reportBreakageOnly(
  page: Page,
  url: string,
  options: ResponsiveOptions,
  testInfo: TestInfo,
): Promise<void> {
  const width = await settle(page, url, options);
  const overflow = await detectOverflow(page);
  const occlusion = await detectOcclusion(page);

  const breaks: string[] = [];
  if (overflow.clipped.length > 0) {
    breaks.push(
      `content CLIPPED off-canvas (hidden & unreachable):\n  ${overflow.clipped.join("\n  ")}`,
    );
  }
  if (occlusion) {
    breaks.push(`<main> occluded by a fixed element (content hidden behind it): ${occlusion}`);
  }

  if (breaks.length > 0) {
    const message =
      `⚠️ RESPONSIVE no-break ADVISORY — ${url} @${width}px (off-target platform):\n` +
      `${breaks.join("\n")}\n` +
      `This is the OFF-TARGET width, so cosmetic imperfection is fine and LOW PRIORITY — but the above ` +
      `hides functionality (you can't reach it). Nothing should be UNREACHABLE on any device; fix when you can. ` +
      `(Advisory — does NOT fail the gate.)`;
    // Surface loudly without failing: an annotation (visible in the report) + a console warning.
    testInfo.annotations.push({ type: "warning", description: message });
    console.warn(message);
  }
}
