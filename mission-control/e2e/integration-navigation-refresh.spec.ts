import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class ControlledEventSource extends EventTarget {
      static sources: ControlledEventSource[] = [];
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      constructor(_url: string) {
        super();
        ControlledEventSource.sources.push(this);
        queueMicrotask(() => this.onopen?.());
      }
      close() {
        ControlledEventSource.sources = ControlledEventSource.sources.filter((s) => s !== this);
      }
    }
    Object.assign(window, { EventSource: ControlledEventSource });
    Object.assign(window, {
      emitLive: (at: string, stateVersion: number) => {
        for (const source of ControlledEventSource.sources) {
          source.onmessage?.(
            new MessageEvent("message", {
              data: JSON.stringify({ events: [], lastEventAt: at, stateVersion }),
            }),
          );
        }
      },
    });
  });
});

for (const start of [
  "/portfolio/mission-control/observability?view=dag&dag=wo&frd=FRD-01",
  "/portfolio?project=mission-control&tab=Observabilidad&view=deps&dag=wo&frd=FRD-01",
]) {
  test(`canonical refresh preserves focus from ${start}`, async ({ page }) => {
    await gotoHydrated(page, start, { selector: ".seg button" });
    await page.clock.install();
    await page.evaluate(() => {
      const emit = Reflect.get(window, "emitLive");
      emit("2098-01-01T00:00:00Z", 1);
    });
    await page.getByRole("button", { name: /WO-01-003 ·/ }).click();
    await expect(page).toHaveURL(/focus=WO-01-003/);
    // Commit the baseline debounce before delivering the advancing frame.
    await page.clock.runFor(200);
    const refreshed = page.waitForResponse((r) => r.request().headers().rsc === "1");
    await page.evaluate(() => Reflect.get(window, "emitLive")("2099-01-01T00:00:00Z", 2));
    await page.clock.runFor(200);
    const response = await refreshed;
    expect(response.ok()).toBe(true);
    expect(new URL(response.url()).searchParams.get("focus")).toBe("WO-01-003");
    await expect(page).toHaveURL(/view=deps.*dag=wo.*frd=FRD-01.*focus=WO-01-003/);
    await expect(page.getByRole("region", { name: "Work order en foco" })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/focus=WO-01-003/);
  });
}

test("server canonicalization preserves client model selections on reload", async ({ page }) => {
  await gotoHydrated(page, "/portfolio/mission-control/architecture?tab=architecture", {
    selector: '[data-testid="data-model-viewer"]',
  });
  await expect(page).not.toHaveURL(/tab=architecture/);
  await page
    .getByTestId("data-model-viewer")
    .getByRole("button", { name: "Diagrama", exact: true })
    .click();
  await page.getByTestId("data-model-viewer").getByRole("searchbox").fill("id");
  await expect(page).toHaveURL(/modelQuery=id/);
  await page.getByTestId("model-fullscreen").click();
  await expect(page).toHaveURL(/expanded=1/);
  await page.reload();
  await expect(page).toHaveURL(/modelQuery=id.*expanded=1/);
  await expect(page.getByTestId("data-model-viewer").getByRole("searchbox")).toHaveValue("id");
});

for (const width of [320, 390, 1280]) {
  test(`radar labels paint inside their bounded SVG at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoHydrated(page, "/achievements", { selector: "svg.radar" });
    await page.evaluate(() => document.fonts.ready);
    const labels = await page.locator("svg.radar").evaluate((svg) => {
      const bounds = svg.getBoundingClientRect();
      return Array.from(svg.querySelectorAll("text"), (text) => {
        const box = text.getBoundingClientRect();
        return {
          text: text.textContent,
          inside: box.left >= bounds.left && box.right <= bounds.right,
          fontSize: Number.parseFloat(getComputedStyle(text).fontSize),
        };
      });
    });
    expect(labels).toHaveLength(6);
    for (const label of labels) {
      expect(label.inside, label.text ?? "label").toBe(true);
      expect(label.fontSize).toBeGreaterThanOrEqual(12);
    }
  });
}
