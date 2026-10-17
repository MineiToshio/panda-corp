import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

type LocationCase = {
  family: string;
  href: string;
  selected: string;
  next: string;
  nextPath: string;
  content: string;
};
const cases: LocationCase[] = [
  {
    family: "board",
    href: "/board/idea-in-pipeline/spec",
    selected: "card-detail-tab-spec",
    next: "card-detail-tab-arquitectura",
    nextPath: "/board/idea-in-pipeline/architecture",
    content: "card-detail-panel-spec",
  },
  {
    family: "portfolio",
    href: "/portfolio/mission-control/spec",
    selected: "tab-spec",
    next: "tab-architecture",
    nextPath: "/portfolio/mission-control/architecture",
    content: "card-detail-spec",
  },
  {
    family: "standalone",
    href: "/projects/mission-control/spec",
    selected: "tab-spec",
    next: "tab-architecture",
    nextPath: "/projects/mission-control/architecture",
    content: "card-detail-spec",
  },
  {
    family: "proposals",
    href: "/proposals/backlog",
    selected: "proposals-tab-backlog",
    next: "proposals-tab-memoria",
    nextPath: "/proposals/memory",
    content: "backlog-panel",
  },
  {
    family: "achievements",
    href: "/achievements/ranks",
    selected: "logros-tab-rangos",
    next: "logros-tab-resumen",
    nextPath: "/achievements/summary",
    content: "logros-tabs",
  },
  {
    family: "configuration",
    href: "/configuration/rules/DR-009",
    selected: "config-tab-rules",
    next: "config-tab-standards",
    nextPath: "/configuration/standards",
    content: "rule-detail",
  },
];

async function assertLocation(page: Page, target: LocationCase): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${target.href.replaceAll("/", "\\/")}$`));
  await expect(page.getByTestId(target.selected)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId(target.content)).toBeVisible();
}

for (const target of cases) {
  test(`${target.family}: direct, reload, fresh paste, Back and Forward restore semantic selection`, async ({
    page,
    browser,
  }) => {
    await gotoHydrated(page, target.href, { selector: `[data-testid="${target.selected}"]` });
    await assertLocation(page, target);
    await page.reload();
    await assertLocation(page, target);
    const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    try {
      const pasted = await fresh.newPage();
      await pasted.goto(page.url());
      await assertLocation(pasted, target);
    } finally {
      await fresh.close();
    }
    await page.getByTestId(target.next).click();
    await expect(page).toHaveURL(new RegExp(`${target.nextPath}$`));
    await expect(page.getByTestId(target.next)).toHaveAttribute("aria-selected", "true");
    await page.goBack();
    await assertLocation(page, target);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`${target.nextPath}$`));
    await expect(page.getByTestId(target.next)).toHaveAttribute("aria-selected", "true");
  });
}

test("authored Manual selection, anchor, fresh paste and history restore the addressed article", async ({
  page,
  browser,
}) => {
  const href = "/manual/concepts/el-pipeline#el-pipeline--de-idea-a-producto";
  await gotoHydrated(page, href, { selector: '[data-testid="doc-nav-item-concepts-el-pipeline"]' });
  await expect(page.getByTestId("doc-reader-authored")).toContainText("pipeline");
  await expect(page.locator("#el-pipeline--de-idea-a-producto")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  try {
    const pasted = await fresh.newPage();
    await pasted.goto(page.url());
    await expect(pasted.getByTestId("doc-reader-authored")).toContainText("pipeline");
    await expect(pasted.locator("#el-pipeline--de-idea-a-producto")).toBeVisible();
  } finally {
    await fresh.close();
  }
  await page.getByTestId("doc-nav-item-reference-rules").click();
  await expect(page).toHaveURL(/\/manual\/reference\/rules/);
  await page.goBack();
  await expect(page.getByTestId("doc-reader-authored")).toContainText("pipeline");
  await page.goForward();
  await expect(page.getByTestId("doc-reader-reference")).toBeVisible();
});

test("home and root default resolution retain one meaningful history entry", async ({ page }) => {
  await gotoHydrated(page, "/achievements/ranks", {
    selector: '[data-testid="logros-tab-rangos"]',
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
  await page.goto("/portfolio");
  await expect(page).toHaveURL(/\/portfolio\/mission-control\/summary$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/portfolio\/mission-control\/summary$/);
});

test("model schema entity and search restore; search replaces history and expanded paste never requests native fullscreen", async ({
  page,
  browser,
}) => {
  const href =
    "/portfolio/mission-control/architecture?model=schema&schemaTable=users&entity=users&modelQuery=email";
  await gotoHydrated(page, href, { selector: '[data-testid="data-model-viewer"] input' });
  const viewer = page.getByTestId("data-model-viewer");
  await expect(viewer.getByRole("tab", { name: "Esquema", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(viewer.locator('details[aria-label="users"]')).toHaveAttribute("open", "");
  await expect(viewer.getByRole("searchbox")).toHaveValue("email");
  await page.reload();
  await expect(viewer.locator('details[aria-label="users"] code')).toBeVisible();
  const beforeSearch = await page.evaluate(() => history.length);
  await viewer.getByRole("searchbox").fill("users");
  await expect.poll(() => new URL(page.url()).searchParams.get("modelQuery")).toBe("users");
  expect(await page.evaluate(() => history.length)).toBe(beforeSearch);
  await viewer.getByRole("tab", { name: "Diagrama", exact: true }).click();
  await page.goBack();
  await expect(viewer.getByRole("tab", { name: "Esquema", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goForward();
  await expect(viewer.getByRole("tab", { name: "Diagrama", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const expanded = new URL(page.url());
  expanded.searchParams.set("expanded", "1");
  const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  try {
    const pasted = await fresh.newPage();
    await pasted.goto(expanded.toString());
    await expect(pasted.getByRole("dialog", { name: "Modelo de datos" })).toBeVisible();
    expect(await pasted.evaluate(() => document.fullscreenElement)).toBeNull();
    await pasted.reload();
    await expect(pasted.getByRole("dialog", { name: "Modelo de datos" })).toBeVisible();
    expect(await pasted.evaluate(() => document.fullscreenElement)).toBeNull();
  } finally {
    await fresh.close();
  }
});

test("invalid explicit resources, tails and document traversal never render another project's workspace", async ({
  request,
}) => {
  for (const href of [
    "/portfolio/not-a-registered-project/summary",
    "/projects/not-a-registered-project/summary",
    "/board/not-a-registered-idea/spec",
    "/portfolio/mission-control/bogus",
    "/portfolio/mission-control/work-orders/WO-99-999/full",
    "/portfolio/mission-control/documents/..%2F..%2Ffactory%2Fprofile.md",
    "/portfolio/mission-control/summary/unexpected",
    "/achievements/ranks/extra",
    "/proposals/memory/not-a-stream/LESSON-0001",
  ]) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(404);
  }
  for (const family of [
    "/",
    "/board",
    "/portfolio",
    "/projects/mission-control",
    "/proposals",
    "/achievements",
    "/manual",
    "/configuration",
  ]) {
    expect((await request.get(`${family}?q=first&q=second`)).status(), family).toBe(400);
    expect((await request.get(`${family}?q=${"x".repeat(2049)}`)).status(), family).toBe(400);
  }
});

test("legacy queries normalize nested WO and document selections while preserving context and heading", async ({
  page,
}) => {
  for (const [legacy, canonical] of [
    [
      "/portfolio?project=Mission%20Control&tab=work-orders&wo=WO-01-001&wotab=full#goal",
      "/portfolio/mission-control/work-orders/WO-01-001/full#goal",
    ],
    [
      "/projects/mission-control?tab=work-orders&wo=WO-01-001&wotab=full#goal",
      "/projects/mission-control/work-orders/WO-01-001/full#goal",
    ],
  ] as const) {
    await page.goto(legacy);
    await expect
      .poll(() => new URL(page.url()).pathname + new URL(page.url()).hash)
      .toBe(canonical);
    await expect(page.getByTestId("wo-detail-full")).toContainText("Reader module");
    await page.reload();
    await expect(page.getByTestId("wo-detail-full")).toContainText("Reader module");
  }
  await page.goto(
    "/portfolio?project=Mission%20Control&tab=documents&doc=docs%2Fproduct%2Fprd#vision",
  );
  await expect(page).toHaveURL(
    /\/portfolio\/mission-control\/documents\/docs%2Fproduct%2Fprd#vision$/,
  );
  await expect(page.getByTestId("documents-body")).toContainText("factory dashboard");
  await expect(page.locator("#vision")).toBeVisible();
});

test("read-only details restore in Manual, Configuration and Proposals without reopening transient confirmations", async ({
  page,
}) => {
  for (const target of [
    { href: "/manual/reference/agents/reviewer", id: "agent-detail", text: "reviewer" },
    {
      href: "/configuration/standards/quality.md?standardView=detail",
      id: "standard-markdown-body",
      text: "Quality",
    },
    {
      href: "/proposals/backlog/BL-0001?backlogGroups=done",
      id: "backlog-detail-modal",
      text: "BL-0001",
    },
  ]) {
    await page.goto(target.href);
    await expect(page.getByTestId(target.id)).toContainText(target.text);
    await page.reload();
    await expect(page.getByTestId(target.id)).toContainText(target.text);
  }
});

test("Board document reader and campaign phase restore through direct URLs and refresh", async ({
  page,
}) => {
  await page.goto("/board/idea-in-pipeline/documents/docs%2Fproduct%2Fprd.md#vision");
  await expect(page.getByTestId("card-detail-doc-reader")).toContainText("factory dashboard");
  await page.reload();
  await expect(page.getByTestId("card-detail-doc-reader")).toContainText("factory dashboard");
  await gotoHydrated(page, "/board/idea-in-pipeline/campaign?phase=design", {
    selector: '[data-testid="card-detail-tab-campana"]',
  });
  await expect(page.getByTestId("campaign-phase-ficha")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("campaign-phase-ficha")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("phase")).toBe("design");
});

test("nested destinations retain global highlights and configuration retains its integrated shell", async ({
  page,
}) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/spec", {
    selector: '[data-testid="card-detail-tab-spec"]',
  });
  await expect(page.getByTestId("app-nav-tablero")).toHaveAttribute("aria-current", "page");
  const toggle = page.locator("[data-nav-toggle]");
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.getByTestId("app-nav-tablero")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
  await page.goto("/manual/reference/rules/DR-009");
  await expect(page.getByTestId("app-nav-documentacion")).toHaveAttribute("aria-current", "page");
  await page.goto("/configuration/rules/DR-009");
  await expect(page.getByTestId("rule-detail")).toBeVisible();
  await expect(page.getByTestId("app-nav")).toHaveCount(0);
});

function snapshotFiles(root: string): Map<string, Buffer> {
  return new Map(
    fs
      .readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const file = path.join(entry.parentPath, entry.name);
        return [file, fs.readFileSync(file)];
      }),
  );
}

// GuildBar already materializes its derived ledger while rendering. Navigation must
// leave identity, card, project state and authored source files byte-for-byte inert.
function sourceFiles(root: string, files: Map<string, Buffer>): Map<string, Buffer> {
  const ledger = path.join(root, "factory/gamification-ledger.json");
  return new Map(
    [...files].filter(
      ([file]) =>
        file !== ledger &&
        !file.startsWith(`${ledger}.lock${path.sep}`) &&
        !file.startsWith(`${ledger}.tmp-`),
    ),
  );
}

// This test changes only deterministic fixture files, AFTER the production build. Teardown
// restores original bytes and unlinks only explicitly observed new files, never directories.
test("post-build registration: a non-first project retains identity through WO Summary/Full/return in both workspaces", async ({
  page,
}) => {
  const root = path.resolve("e2e/fixtures/factory-root");
  const before = snapshotFiles(root);
  const project = path.join(root, "navigation-review-second");
  const write = (relative: string, content: string) => {
    const file = path.join(project, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  try {
    write(
      ".pandacorp/status.yaml",
      fs
        .readFileSync(path.join(root, "mission-control/.pandacorp/status.yaml"), "utf8")
        .replace('project: "Mission Control"', 'project: "Navigation Review Second"'),
    );
    for (const relative of [
      "docs/product/prd.md",
      "docs/product/research.md",
      "docs/frds/frd-01-x/frd.md",
      "docs/frds/frd-01-x/work-orders/wo-01-001-reader.md",
    ]) {
      write(
        relative,
        fs
          .readFileSync(path.join(root, "mission-control", relative), "utf8")
          .replaceAll("Reader module", "Second project reader")
          .replace("# PRD — proj-a", "# PRD — Second Project"),
      );
    }
    fs.appendFileSync(
      path.join(root, "factory/portfolio.md"),
      "| Navigation Review Second | navigation-review-second | — | — | implementation | — | personal | active | 2026-10-17 |\n",
    );
    const cliArgs = [
      "--loader",
      "./scripts/read-model/ts-loader.mjs",
      "./scripts/navigation/identities.mjs",
      "--factory-root",
      root,
      "--apply",
    ];
    execFileSync(process.execPath, cliArgs, { encoding: "utf8" });
    const repeat = JSON.parse(execFileSync(process.execPath, cliArgs, { encoding: "utf8" })) as {
      added: number;
      changedFiles: string[];
    };
    expect(repeat.added).toBe(0);
    expect(repeat.changedFiles).toEqual([]);
    const registered = sourceFiles(root, snapshotFiles(root));
    for (const family of ["portfolio", "projects"]) {
      const href = `/${family}/navigation-review-second/work-orders`;
      await gotoHydrated(page, href, { selector: '[data-testid="tab-work-orders"]' });
      await expect(page.getByTestId("wo-board")).toContainText("Second project reader");
      if (family === "portfolio") {
        const rows = page.getByTestId("selectable-project-row");
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(1)).toHaveAttribute("data-selected", "true");
        await expect(rows.nth(0)).toHaveAttribute("data-selected", "false");
      }
      await page.getByTestId("wo-card-link").click();
      await expect(page).toHaveURL(new RegExp(`${href}/WO-01-001/summary$`));
      await expect(page.getByTestId("wo-detail-summary")).toContainText("Second project reader");
      await page.getByTestId("wo-detail-tab-full").click();
      await expect(page).toHaveURL(new RegExp(`${href}/WO-01-001/full$`));
      await expect(page.getByTestId("wo-detail-full")).toContainText("Second project reader");
      await page.reload();
      await expect(page.getByTestId("wo-detail-full")).toContainText("Second project reader");
      await page.goBack();
      await expect(page.getByTestId("wo-detail-summary")).toContainText("Second project reader");
      await page.goForward();
      await expect(page.getByTestId("wo-detail-full")).toContainText("Second project reader");
      await page.getByTestId("wo-detail-back").click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      for (const tab of ["party", "changes", "documents"]) {
        await page.getByTestId("tabbar").getByTestId(`tab-${tab}`).click();
        await expect(page).toHaveURL(
          new RegExp(
            `/${family}/navigation-review-second/${tab}${tab === "documents" ? "/docs%2Fproduct%2Fprd" : ""}$`,
          ),
        );
        await expect(page.getByTestId("tabbar").getByTestId(`tab-${tab}`)).toHaveAttribute(
          "aria-selected",
          "true",
        );
      }
      await page.getByTestId("doc-nav-item").filter({ hasText: "prd.md" }).click();
      await expect(page).toHaveURL(
        new RegExp(`/${family}/navigation-review-second/documents/docs%2Fproduct%2Fprd$`),
      );
      await expect(page.getByTestId("documents-body")).toContainText("Second Project");
    }
    const afterNavigation = sourceFiles(root, snapshotFiles(root));
    expect([...afterNavigation.keys()].sort()).toEqual([...registered.keys()].sort());
    for (const [file, bytes] of registered)
      expect(afterNavigation.get(file)?.equals(bytes), file).toBe(true);
  } finally {
    await page.close();
    await expect
      .poll(() => fs.existsSync(path.join(root, "factory/gamification-ledger.json.lock")), {
        timeout: 10_000,
      })
      .toBe(false);
    for (const file of snapshotFiles(root).keys()) if (!before.has(file)) fs.unlinkSync(file);
    for (const [file, content] of before) fs.writeFileSync(file, content);
  }
});
