import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

async function shell(page: Page, width: number, theme: string, path = "/board") {
  await page.setViewportSize({ width, height: 900 });
  await gotoHydrated(page, path, { selector: "#app" });
  await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
  await expect(page.locator('#app[data-hydrated="true"]')).toBeVisible();
  return {
    sidebar: page.locator("aside#sidebar"),
    nav: page.getByTestId("app-nav"),
    menu: page.locator("#menu"),
    bottom: page.locator("nav#bottomnav"),
  };
}

for (const theme of ["light", "dark"]) {
  test(`AC-19-003.1/.5: desktop sidebar and centered content frame (${theme})`, async ({
    page,
  }) => {
    const { sidebar, nav, menu, bottom } = await shell(page, 1280, theme);
    await expect(sidebar).toBeVisible();
    expect(await sidebar.boundingBox()).toMatchObject({ x: 0, width: 252 });
    await expect(sidebar).not.toHaveAttribute("inert");
    await expect(menu).toBeHidden();
    await expect(bottom).toBeHidden();
    await expect(nav.getByRole("link")).toHaveCount(7);
    await expect(nav.getByRole("link", { name: "Portafolio", exact: true })).toBeVisible();
    const frame = await page.locator("main#content").evaluate((main) => {
      const rect = main.getBoundingClientRect();
      const css = getComputedStyle(main);
      return {
        x: rect.x,
        width: rect.width,
        left: Number.parseFloat(css.paddingLeft),
        right: Number.parseFloat(css.paddingRight),
      };
    });
    expect(frame.x).toBe(252);
    expect(frame.left).toBe(40);
    expect(frame.right).toBe(40);
    expect(frame.width - frame.left - frame.right).toBeLessThanOrEqual(1180);
    await page.setViewportSize({ width: 1900, height: 900 });
    const wide = await page.locator("main#content").boundingBox();
    expect(wide?.width).toBe(1260);
    expect(wide?.x).toBe((1900 - 252 - 1260) / 2 + 252);
  });

  test(`AC-19-003.2: tablet rail shows mini labels without a drawer (${theme})`, async ({
    page,
  }) => {
    const { sidebar, nav, menu } = await shell(page, 768, theme);
    expect(await sidebar.boundingBox()).toMatchObject({ width: 76 });
    await expect(sidebar).not.toHaveAttribute("inert");
    await expect(menu).toBeHidden();
    await expect(nav.getByRole("link", { name: "Docs", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Ajustes", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Documentación", exact: true })).toHaveCount(0);
    expect(
      await page.locator("#content").evaluate((node) => getComputedStyle(node).paddingLeft),
    ).toBe("24px");
  });

  test(`AC-19-003.3/.4: phone bars, drawer dismissal and focus return (${theme})`, async ({
    page,
  }) => {
    const { sidebar, nav, menu, bottom } = await shell(page, 375, theme);
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-controls", "sidebar");
    await expect(sidebar).toHaveAttribute("inert");
    await expect(bottom.getByRole("link")).toHaveCount(4);
    const more = bottom.getByRole("button", { name: "Más", exact: true });
    for (const target of await bottom.locator("a, button").all()) {
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    for (const opener of [menu, more]) {
      await opener.click();
      await expect(sidebar).not.toHaveAttribute("inert");
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await expect(
        sidebar.getByRole("link", { name: "Pandacorp Mission Control: ir a Inicio", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(opener).toBeFocused();
    }
    await menu.click();
    await page.locator("#scrim").click({ position: { x: 350, y: 100 } });
    await expect(sidebar).toHaveAttribute("inert");
    await menu.click();
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await nav.getByRole("link", { name: "Tablero", exact: true }).click();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    await nav.getByRole("link", { name: "Portafolio", exact: true }).click();
    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    await page.goBack();
    await expect(page).toHaveURL(/\/board$/);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1)).toBe(true);
    const control = page
      .locator("#content")
      .locator("a[href]:visible, button:visible:not(:disabled), input:visible")
      .last();
    await control.focus();
    await expect(control).toBeFocused();
    await expect
      .poll(async () => {
        const focus = await control.boundingBox();
        const top = await page.locator("header.topbar").boundingBox();
        const foot = await bottom.boundingBox();
        return (
          !!focus &&
          !!top &&
          !!foot &&
          focus.y >= top.y + top.height &&
          focus.y + focus.height <= foot.y
        );
      })
      .toBe(true);
  });

  test(`AC-19-001.5: first keyboard stop skips to the single main in place (${theme})`, async ({
    page,
  }) => {
    await shell(page, 375, theme);
    const path = new URL(page.url()).pathname;
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Saltar al contenido", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#content")).toBeFocused();
    expect(new URL(page.url()).pathname).toBe(path);
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test(`AC-19-004.1, AC-25-010.1: workspace and configuration keep navigation (${theme})`, async ({
    page,
  }) => {
    await shell(page, 1280, theme, "/projects/mission-control");
    await expect(page.locator("aside#sidebar")).toBeVisible();
    await expect(page.getByTestId("app-nav-portfolio")).toHaveAttribute("aria-current", "page");
    await page.evaluate(() => {
      Object.assign(window, { shellNavigationSentinel: true });
    });
    await page.getByTestId("app-nav-configuracion").click();
    await expect(page).toHaveURL(/\/configuration(\/|$)/);
    await expect(page.getByTestId("app-nav-configuracion")).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => Reflect.get(window, "shellNavigationSentinel"))).toBe(true);
    await expect(page.locator("aside#sidebar")).toBeVisible();
  });
}
