import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Smart responsive assertions for a single route at a mobile viewport (DR-074).
 *
 * This is the SHIPPED, VERBATIM-propagated fix for "the build shipped non-responsive"
 * (DR-059 mechanism: it ships as a stack template, not as prose threaded through skills).
 * It is SMART, not naïve: it distinguishes BROKEN overflow from AUTHOR-DECLARED intentional
 * horizontal scroll (a legit kanban / DAG / wide table marks itself `data-scroll-x="intentional"`),
 * so it doesn't false-red the patterns MC legitimately scrolls — while catching the four things
 * MC actually shipped: per-scroll-root overflow, silent off-canvas clipping, sub-24px tap targets,
 * and a fixed bar occluding the top of `<main>`.
 *
 * The caller (responsive.spec.ts) runs this ONLY when the project's `target_platforms`
 * includes mobile (see _target.ts). For desktop-only/API/scraper projects it is never invoked.
 */

const SCROLL_X_OPT_OUT = '[data-scroll-x="intentional"]';
const SUBPIXEL_TOLERANCE_PX = 1; // sub-pixel only — never a large tolerance that would hide real overflow

type ResponsiveOptions = {
  /** The mobile viewport width to assert at (e.g. 390). */
  readonly mobileWidth: number;
  /** Viewport height to use while asserting (default 844). */
  readonly mobileHeight?: number;
  /** Live transport endpoint glob to abort for determinism (default the canonical one). */
  readonly liveEndpointGlob?: string;
};

/**
 * Asserts that `url` is responsive-correct at the mobile viewport. Throws (failing the test)
 * with a precise message naming the offending element and the check that failed.
 */
export async function assertResponsive(
  page: Page,
  url: string,
  options: ResponsiveOptions,
): Promise<void> {
  const { mobileWidth, mobileHeight = 844, liveEndpointGlob = "**/api/live**" } = options;

  // --- Settle FIRST (the #1 flake risk) ---------------------------------------
  // Mobile viewport before navigation so the layout is built at the target width.
  await page.setViewportSize({ width: mobileWidth, height: mobileHeight });
  // Block the live transport (SSE/EventSource/websocket/poll): a long-lived connection keeps the
  // network perpetually busy, so `networkidle` never settles (DR-071). We use domcontentloaded +
  // explicit readiness waits instead; aborting the live endpoint also keeps the DOM deterministic.
  await page.route(liveEndpointGlob, (r) => r.abort());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main").first()).toBeVisible();

  // --- Per-scroll-root overflow + silent-clip (the MC failure) ----------------
  // Evaluated in-page in ONE pass: for EVERY element decide whether it overflows its own client box,
  // honoring the author-declared escape hatch (the element OR any ancestor marked intentional).
  const overflow = await page.evaluate(
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

  expect(
    overflow.overflowing,
    `${url} @${mobileWidth}px — horizontal overflow (no data-scroll-x="intentional"); ` +
      `mark legit kanban/DAG/wide-table scroll-x roots, otherwise make the layout fit:\n` +
      overflow.overflowing.join("\n"),
  ).toEqual([]);
  expect(
    overflow.clipped,
    `${url} @${mobileWidth}px — content CLIPPED off-canvas (overflow-x:hidden|clip while wider than the box). ` +
      `This hides content silently — fit the layout (or mark it intentional if it is a deliberate scroll-x root):\n` +
      overflow.clipped.join("\n"),
  ).toEqual([]);

  // --- Tap targets (axe `target-size`, SC 2.5.8, 24px line — NOT 44px) --------
  const axe = await new AxeBuilder({ page }).withRules(["target-size"]).analyze();
  const targetSize = axe.violations.filter((v) => v.id === "target-size");
  const tapFailures = targetSize.flatMap((v) => v.nodes.map((n) => n.target.join(" ")));
  expect(
    tapFailures,
    `${url} @${mobileWidth}px — tap targets below 24px (WCAG 2.2 SC 2.5.8):\n${tapFailures.join("\n")}`,
  ).toEqual([]);

  // --- <main> not occluded by a fixed element ---------------------------------
  // A position:fixed element overlapping the TOP of <main>'s content box hides content (the MC
  // GuildBar problem) UNLESS <main> (or its content) reserves space with scroll-margin-top >= the
  // fixed element's height — the legit sticky-header pattern (WCAG 2.4.11).
  const occlusion = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return null;
    const mainBox = main.getBoundingClientRect();
    const scrollMarginTop = Number.parseFloat(getComputedStyle(main).scrollMarginTop) || 0;
    // A fixed element occludes <main>'s top if it overlaps the top edge AND is taller than the
    // reserved scroll-margin (the legit sticky-header opt-out). Extracted so each function stays
    // within the cognitive-complexity budget.
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
  expect(
    occlusion,
    `${url} @${mobileWidth}px — a fixed element occludes the top of <main>: ${occlusion}. ` +
      `Reserve space with scroll-margin-top >= the fixed element's height (WCAG 2.4.11).`,
  ).toBeNull();
}
