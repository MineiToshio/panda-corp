/**
 * FRD-08 gate (WO-08-003, WO-08-004): builder-blind browser oracle for the v2 Documentación.
 * Runs against the pinned fixture server. Desktop-only assertions force their own viewport.
 */
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const READER = '[data-testid="doc-reader-authored"]';
const INDEX_NAME = "Índice de la Documentación";

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function allPageHrefs(page: Page): Promise<string[]> {
  await gotoHydrated(page, "/manual/concepts/el-pipeline", { selector: READER });
  const hrefs = await page
    .getByRole("navigation", { name: INDEX_NAME })
    .locator('a[href^="/manual/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return [...new Set(hrefs)];
}

test.describe("REQ-08-001 REQ-08-002 AC-08-020.3 reader", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("AC-08-020.3 the worked concept page: crumbs, counter, group-bound navigation, right index", async ({
    page,
  }) => {
    await gotoHydrated(page, "/manual/concepts/el-pipeline", { selector: READER });
    const crumbs = page.getByRole("navigation", { name: /migas|ruta|breadcrumb/i });
    await expect(crumbs.getByRole("link", { name: "Documentación" })).toHaveAttribute(
      "href",
      "/manual",
    );
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(/El pipeline/);
    await expect(page.getByTestId("doc-reader")).toContainText(/\d+ de \d+/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentación");
    await expect(page.getByRole("link", { name: /Anterior en Conceptos/ })).toHaveAttribute(
      "href",
      /\/manual\/concepts\//,
    );
    await expect(page.getByRole("link", { name: /Siguiente en Conceptos/ })).toHaveAttribute(
      "href",
      /\/manual\/concepts\//,
    );
    const index = page.getByRole("navigation", { name: INDEX_NAME });
    await expect(index.locator('a[aria-current="page"]')).toHaveText(/El pipeline/);
    const paperBox = await page.getByTestId("doc-reader-authored").boundingBox();
    const indexBox = await index.boundingBox();
    expect(indexBox?.x ?? 0).toBeGreaterThan((paperBox?.x ?? 0) + (paperBox?.width ?? 0) - 1);
    await expect(page.getByRole("button", { name: /Índice ·/ })).toBeHidden();
  });

  test("AC-08-020.3 the index's own search filters without leaving the page", async ({ page }) => {
    await gotoHydrated(page, "/manual/concepts/el-pipeline", { selector: READER });
    const index = page.getByRole("navigation", { name: INDEX_NAME });
    await index.getByRole("searchbox").fill("equipo");
    await expect(index.getByRole("link", { name: "El equipo" })).toBeVisible();
    await expect(index.getByRole("link", { name: "Cómo empezar" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/manual\/concepts\/el-pipeline$/);
  });

  test("the first and last pages of a group omit the missing direction", async ({ page }) => {
    await gotoHydrated(page, "/manual/tutorial/como-empezar", { selector: READER });
    await expect(
      page.getByRole("progressbar", { name: "Paso 2 de 2 del tutorial" }),
    ).toHaveAttribute("aria-valuenow", "2");
    await expect(page.getByText("Paso 2 de 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Anterior en Tutorial/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Siguiente en/ })).toHaveCount(0);
  });

  test("REQ-08-003 Referencia entries lead to Configuración and no catalog renders here", async ({
    page,
  }) => {
    await gotoHydrated(page, "/manual/concepts/el-pipeline", { selector: READER });
    const index = page.getByRole("navigation", { name: INDEX_NAME });
    for (const [name, href] of [
      ["Comandos", "/configuration/skills"],
      ["Agentes", "/configuration/agents"],
      ["Reglas de decisión", "/configuration/rules"],
      ["Estándares", "/configuration/standards"],
    ] as const) {
      await expect(index.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    }
    await expect(page.getByTestId("skill-card-spec")).toHaveCount(0);
  });

  test("a markdown page renders its title once", async ({ page }) => {
    await gotoHydrated(page, "/manual/guides/g-implement-parcial", { selector: READER });
    await expect(
      page.getByTestId("doc-reader-authored").getByRole("heading", { name: /^Build parcial/ }),
    ).toHaveCount(1);
  });
});

test.describe("AC-08-020.3 folded index below 900 px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the opened index survives reload through the URL and sits above the page", async ({
    page,
  }) => {
    await gotoHydrated(page, "/manual/concepts/el-pipeline", { selector: READER });
    const index = page.getByRole("navigation", { name: INDEX_NAME });
    await expect(index).toBeHidden();
    const toggle = page.getByRole("button", { name: /Índice · / });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(index).toBeVisible();
    await expect(page).toHaveURL(/[?&]index=1(?:&|$)/);
    const indexBox = await index.boundingBox();
    const paperBox = await page.getByTestId("doc-reader-authored").boundingBox();
    expect(indexBox?.y ?? 0).toBeLessThan(paperBox?.y ?? 0);
    await page.reload();
    await expect(page.getByRole("navigation", { name: INDEX_NAME })).toBeVisible();
    await page.getByRole("button", { name: /Índice · / }).click();
    await expect(page).not.toHaveURL(/index=/);
    await expect(page.getByRole("button", { name: /Índice · / })).toBeFocused();
  });

  test("44 px touch targets on the toggle, index items and previous/next", async ({ page }) => {
    await gotoHydrated(page, "/manual/concepts/el-pipeline?index=1", { selector: READER });
    const heights = await page
      .locator(".index-toggle, .ditem, .docs-nav, .dgroup summary")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(5);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });
});

test.describe("AC-08-020.1 AC-08-020.2 home and search", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("AC-08-020.1 counts are derived and the two cards end level", async ({ page }) => {
    const errors = trackErrors(page);
    await gotoHydrated(page, "/manual", { selector: '[data-testid="manual-shell"]' });
    const search = page.getByRole("searchbox", { name: "Buscar en toda la Documentación" });
    const placeholder = (await search.getAttribute("placeholder")) ?? "";
    const total = Number(/(\d+) páginas/.exec(placeholder)?.[1]);
    const counts = await page
      .locator(".docs-group small")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
    const sum = counts.reduce((acc, text) => acc + Number(/\d+/.exec(text)?.[0] ?? 0), 0);
    expect(sum).toBe(total);
    await expect(page.getByRole("link", { name: /Referencia/ })).toHaveAttribute(
      "href",
      "/configuration",
    );
    await expect(
      page.getByRole("heading", { name: "Después, entiende lo esencial" }),
    ).toBeVisible();
    const cards = await page
      .locator(".docs-pair > *")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().bottom));
    expect(cards).toHaveLength(2);
    expect(Math.abs((cards[0] ?? 0) - (cards[1] ?? 0))).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test("AC-08-020.2 q round-trips reload and back, typing adds no history, no match is honest", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await gotoHydrated(page, "/manual", { selector: '[data-testid="manual-shell"]' });
    const before = await page.evaluate(() => window.history.length);
    const search = page.getByRole("searchbox", { name: "Buscar en toda la Documentación" });
    await search.pressSequentially("gate", { delay: 20 });
    await expect(page).toHaveURL(/[?&]q=gate/);
    expect(await page.evaluate(() => window.history.length)).toBe(before);
    const results = page.getByTestId("docs-results");
    await expect(results.getByRole("link").first()).toBeVisible();
    await expect(results).toHaveAttribute("aria-busy", "false");
    await page.reload();
    await expect(page.getByTestId("docs-results").getByRole("link").first()).toBeVisible();
    await page.getByTestId("docs-results").getByRole("link").first().click();
    await expect(page.getByTestId("doc-reader-authored")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("docs-results").getByRole("link").first()).toBeVisible();
    await page
      .getByRole("searchbox", { name: "Buscar en toda la Documentación" })
      .fill("zzqqxx-nada");
    await expect(page.getByTestId("docs-results")).toContainText(/\S/);
    await expect(page.getByTestId("docs-results").getByRole("link")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("AC-08-020.2 snippets keep adjacent blocks apart and results span every group", async ({
    page,
  }) => {
    await gotoHydrated(page, "/manual", { selector: '[data-testid="manual-shell"]' });
    await page.getByRole("searchbox", { name: "Buscar en toda la Documentación" }).fill("proyecto");
    const results = page.getByTestId("docs-results");
    await expect(results.getByRole("link").first()).toBeVisible();
    const text = (await results.innerText()).replace(/\n/g, " ");
    for (const group of ["Tutorial", "Guías", "Conceptos", "Workflows"])
      expect(text).toContain(group);
    // The chip and the title are separate elements, and a camel-cased brand is not two glued blocks.
    const snippets = await results.getByRole("link").locator("small").allInnerTexts();
    expect(snippets.length).toBeGreaterThan(0);
    const glued = snippets.filter((snippet) =>
      /\p{Ll}[.:]?\p{Lu}\p{Ll}/u.test(snippet.replace(/\b(?:OpenCode|JavaScript)\b/g, "")),
    );
    expect(glued).toEqual([]);
  });
});

test("REQ-08-003 edge: unknown addresses stay bounded, no reader and no index", async ({
  page,
}) => {
  for (const [path, slug] of [
    ["/manual/concepts/no-existe", "no-existe"],
    ["/manual/no-group/x", "x"],
  ] as const) {
    await gotoHydrated(page, path, { selector: '[data-testid="manual-shell"]' });
    await expect(page.getByText("Esta página no existe")).toBeVisible();
    await expect(page.getByText(`La Documentación no tiene una página «${slug}».`)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ir al inicio de la Documentación" }),
    ).toHaveAttribute("href", "/manual");
    await expect(page.getByTestId("doc-reader")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentación");
  }
});

test("REQ-08-007 legacy links keep the resource, the query and never leave the app", async ({
  page,
}) => {
  await page.goto("/manual/reference/skills/spec?q=a");
  await expect(page).toHaveURL(/\/configuration\/skills\/spec\?q=a$/);
  await page.goto("/manual/reference/agents/%2F%2Fevil.example");
  const url = new URL(page.url());
  expect(url.hostname).toBe("127.0.0.1");
  expect(url.pathname.startsWith("/configuration/agents/")).toBe(true);
  const response = await page.goto("/manual/reference/unknown");
  expect(response?.status()).toBe(404);
});

test("REQ-08-001 no page throws, none adds an h1, none overflows a phone", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const hrefs = await allPageHrefs(page);
  expect(hrefs.length).toBeGreaterThanOrEqual(38);
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  const overflowing: string[] = [];
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.getByTestId("doc-reader-authored")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) overflowing.push(`${href}:${overflow}`);
  }
  expect(overflowing).toEqual([]);
  expect(errors).toEqual([]);
});
