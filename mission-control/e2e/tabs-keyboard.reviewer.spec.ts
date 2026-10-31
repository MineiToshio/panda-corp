import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

// Reviewer-authored (DR-080): the roving focus of the shared Tabs primitive has to stay on screen in
// a real browser, because jsdom has no layout and cannot prove any of this.

const PATH = "/projects/mission-control/summary";
const LIST = '[role="tablist"][data-testid="tabs-root"]';

async function focusedTabIsVisible(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((selector) => {
        const list = document.querySelector(selector);
        const tab = document.activeElement;
        if (!list || !(tab instanceof HTMLElement) || tab.getAttribute("role") !== "tab") {
          return "focus left the tablist";
        }
        const strip = list.getBoundingClientRect();
        const box = tab.getBoundingClientRect();
        if (box.left < strip.left - 1 || box.right > strip.right + 1) {
          return `clipped: tab ${box.left}-${box.right}, strip ${strip.left}-${strip.right}`;
        }
        // Both edges, not the centre: an overflow arrow may hide half a tab and still pass a midpoint.
        const y = box.top + box.height / 2;
        for (const x of [box.left + 1, box.right - 1]) {
          if (!tab.contains(document.elementFromPoint(x, y))) return `covered at x=${x}`;
        }
        return "visible";
      }, LIST),
    )
    .toBe("visible");
}

async function walk(page: Page): Promise<void> {
  const tabs = page.locator(LIST).getByRole("tab");
  const count = await tabs.count();
  expect(count).toBeGreaterThan(1);
  await page.locator(`${LIST} [role="tab"][tabindex="0"]`).focus();
  await page.keyboard.press("Home");
  await focusedTabIsVisible(page);
  for (let index = 1; index < count; index += 1) {
    await page.keyboard.press("ArrowRight");
    await focusedTabIsVisible(page);
  }
  await page.keyboard.press("Home");
  await focusedTabIsVisible(page);
  await page.keyboard.press("End");
  await focusedTabIsVisible(page);
  await page.keyboard.press("ArrowRight");
  await expect(tabs.first()).toBeFocused();
  await focusedTabIsVisible(page);
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.last()).toBeFocused();
  await focusedTabIsVisible(page);
}

test("AC-13: keyboard focus stays in view on the overflowing tab strip @390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoHydrated(page, PATH, { selector: '#app[data-hydrated="true"]' });
  const overflow = await page.locator(LIST).evaluate((list) => list.scrollWidth - list.clientWidth);
  expect(overflow).toBeGreaterThan(0);
  await walk(page);
});

test("AC-13: keyboard focus stays in view with the full strip @1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoHydrated(page, PATH, { selector: '#app[data-hydrated="true"]' });
  await walk(page);
});

test("AC-13: keyboard focus stays in view when the strip overflows @1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoHydrated(page, PATH, { selector: '#app[data-hydrated="true"]' });
  await page.addStyleTag({ content: ".tabs-wrap { max-width: 320px; }" });
  await expect
    .poll(() => page.locator(LIST).evaluate((list) => list.scrollWidth - list.clientWidth))
    .toBeGreaterThan(0);
  await walk(page);
});
