import { expect, type Page, type TestInfo } from "@playwright/test";

type TimelineWindow = Window & { navigationTimeline?: unknown[] };

/** Attribute history rewrites without changing application navigation semantics. */
export async function observeHistory(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as TimelineWindow;
    target.navigationTimeline = [];
    function record(event: Record<string, unknown>): void {
      const entry = {
        ...event,
        at: Date.now(),
        document: performance.timeOrigin,
        state: history.state,
      };
      target.navigationTimeline?.push(entry);
      // Playwright's trace retains console events across native navigations and hard reloads.
      console.debug("navigation-history", JSON.stringify(entry));
    }
    for (const method of ["pushState", "replaceState"] as const) {
      const original = history[method].bind(history);
      history[method] = (...args: Parameters<History[typeof method]>) => {
        record({
          method,
          from: location.href,
          to: args[2],
          nextState: args[0],
          length: history.length,
          stack: new Error().stack,
        });
        return original(args[0], args[1], args[2]);
      };
    }
    window.addEventListener("popstate", () => {
      record({
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
        state: history.state,
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

/**
 * Reload, then wait for the hydration COMMIT. `__reactProps$` appears during hydration's render
 * phase, before Next installs its popstate listener and rewrites the entry from its server URL:
 * a Back in that gap is lost. The root layout's ledger action is the first POST after that commit.
 */
export async function reloadCommitted(page: Page): Promise<void> {
  const committed = page.waitForRequest((request) => request.method() === "POST");
  await page.reload();
  await committed;
}
