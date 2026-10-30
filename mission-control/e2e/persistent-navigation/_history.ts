import { expect, type Page, type TestInfo } from "@playwright/test";

type TimelineWindow = Window & { navigationTimeline?: unknown[] };

/** Attribute history rewrites without changing application navigation semantics. */
export async function observeHistory(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as TimelineWindow;
    target.navigationTimeline = [];
    for (const method of ["pushState", "replaceState"] as const) {
      const original = history[method].bind(history);
      history[method] = (...args: Parameters<History[typeof method]>) => {
        target.navigationTimeline?.push({
          method,
          from: location.href,
          to: args[2],
          length: history.length,
          stack: new Error().stack,
        });
        return original(args[0], args[1], args[2]);
      };
    }
    window.addEventListener("popstate", () => {
      target.navigationTimeline?.push({
        method: "popstate",
        url: location.href,
        length: history.length,
      });
    });
  });
}

/** Record the exact interactive node's hydration, not its server-rendered ancestor's. */
export async function historyCheckpoint(
  page: Page,
  step: string,
  selector: string,
  info: TestInfo,
): Promise<void> {
  const state = await page.evaluate(
    ({ step, selector }) => {
      const node = document.querySelector(selector);
      return {
        step,
        url: location.href,
        length: history.length,
        hydrated:
          !!node &&
          Object.keys(node).some(
            (key) => key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"),
          ),
        timeline: (window as TimelineWindow).navigationTimeline,
      };
    },
    { step, selector },
  );
  await info.attach(`history-${step}`, {
    body: JSON.stringify(state),
    contentType: "application/json",
  });
  if (process.env.NAVIGATION_TRACE) console.info(JSON.stringify(state));
}

/** Wait for the next interactive node after a reload or native link navigation. */
export async function expectHydrated(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector).first()).toBeVisible();
  await page.waitForFunction((selector) => {
    const node = document.querySelector(selector);
    return (
      !!node &&
      Object.keys(node).some(
        (key) => key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"),
      )
    );
  }, selector);
}
