import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { WORKSPACE_TAB_LABELS } from "./_workspaceTabs";

test("portfolio reuses Architecture after Work orders with a draggable compact model", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio/mission-control/architecture", {
    selector: '[data-testid="data-model-viewer"] input',
  });
  const tabs = page.getByRole("navigation", { name: "Pestañas del espacio de trabajo" });
  await expect(tabs.getByRole("tab")).toHaveText([...WORKSPACE_TAB_LABELS]);
  await expect(page.getByTestId("arch-data-model")).toContainText("Modelo de datos");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  const viewer = page.getByTestId("data-model-viewer");
  await expect(viewer.getByRole("tab", { name: "Diagrama", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const canvas = page.getByTestId("model-viewport");
  const stage = page.getByTestId("model-stage");
  await canvas.scrollIntoViewIfNeeded();
  const initial = await stage.getAttribute("style");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Diagram viewport is absent");
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect(stage).not.toHaveAttribute("style", initial ?? "");
  await expect(canvas).toHaveCSS("overflow", "hidden");
  await expect(viewer.locator("aside")).toHaveCount(0);
  expect(
    await stage
      .locator("td")
      .evaluateAll((cells) =>
        cells
          .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
          .map((cell) => cell.textContent),
      ),
  ).toEqual([]);
  await viewer.getByRole("tab", { name: "Esquema", exact: true }).click();
  await expect(viewer.getByRole("tabpanel").locator("table")).toHaveCount(0);
  await expect(viewer.getByRole("tabpanel").locator("pre")).toHaveCount(6);
  await expect(viewer.getByRole("tabpanel")).toContainText("model users");
  await viewer.getByRole("button", { name: "Ampliar modelo" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe("DIV");
  const dialog = page.getByRole("dialog", { name: "Modelo de datos" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("pre, aside, [role=tablist]")).toHaveCount(0);
  await expect(dialog.getByText("Modelo diseñado.", { exact: false })).toHaveCount(0);
  await expect(page.getByTestId("model-viewport")).toHaveCount(1);
  const windowSize = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(await dialog.boundingBox()).toEqual({ x: 0, y: 0, ...windowSize });
  expect(await page.getByTestId("model-viewport").boundingBox()).toEqual({
    x: 0,
    y: 0,
    ...windowSize,
  });
  const expandedSearch = dialog.getByRole("searchbox");
  await expandedSearch.fill("no-such-entity-987654");
  await expect(dialog.locator("p[role=status]")).toHaveText("Sin coincidencias");
  await expandedSearch.fill("users");
  await expect(dialog.locator("p[role=status]")).toContainText("1");
  await expandedSearch.clear();
  await page.getByTestId("model-close").focus();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole("dialog", { name: "Modelo de datos" })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Ampliar modelo" })).toBeFocused();
});

test("board exposes the same published model even without a narrative architecture digest", async ({
  page,
}) => {
  await gotoHydrated(page, "/board", {
    selector: '[data-testid="board-search"]',
    optional: true,
  });
  await page.getByText("Mission Control factory dashboard", { exact: true }).first().click();
  await expect(page.getByTestId("card-detail-panel-arquitectura")).toBeVisible();
  await expect(
    page.getByTestId("data-model-viewer").getByRole("tab", { name: "Diagrama", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("model-viewport")).toBeVisible();
});

test("model corner controls match the dependency map and retain a full-window fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(Element.prototype, "webkitRequestFullscreen", {
      configurable: true,
      value: undefined,
    });
  });
  await gotoHydrated(page, "/portfolio/mission-control/architecture", {
    selector: '[data-testid="data-model-viewer"] input',
  });
  const appearance = (element: HTMLElement | SVGElement) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      radius: style.borderRadius,
      height: style.height,
      gap: style.gap,
    };
  };
  expect(await page.getByTestId("model-zoom").evaluate(appearance)).toEqual(
    await page.getByTestId("dag-zoom").first().evaluate(appearance),
  );
  await page.getByTestId("model-fullscreen").click();
  const dialog = page.getByRole("dialog", { name: "Modelo de datos" });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(await page.getByTestId("model-viewport").boundingBox()).toEqual({ x: 0, y: 0, ...size });
  const bar = await page.getByTestId("model-zoom").boundingBox();
  if (!bar) throw new Error("Shared model controls missing");
  expect(bar.y).toBeLessThan(12);
  expect(size.width - bar.x - bar.width).toBeLessThan(12);
  await dialog.getByRole("button", { name: "Mover diagrama", exact: true }).click();
  const stage = page.getByTestId("model-stage");
  const initial = await stage.getAttribute("style");
  await dialog.getByRole("button", { name: "Mover a la derecha" }).click();
  await expect(stage).not.toHaveAttribute("style", initial ?? "");
  await page.getByTestId("model-close").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("model-fullscreen")).toBeFocused();
});
