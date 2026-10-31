import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect as baseExpect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import {
  expectHydrated,
  historyCheckpoint,
  observeHistory,
  reloadCommitted,
} from "./persistent-navigation/_history";

// Legacy WO links settle in two server round trips (alias, then NavigationCanonical's replace) and
// each one can stall for seconds on the shared dev server; these assertions pin the destination, not
// its latency. The default 5 s budget is what made this spec fail at a different step on each run.
const NAVIGATION_TIMEOUT = 60_000;
const expect = baseExpect.configure({ timeout: NAVIGATION_TIMEOUT });

async function expectWorkOrderLocation(page: Page, pathname: string, view?: string, hash = "") {
  await expect
    .poll(
      () => {
        const url = new URL(page.url());
        const wo = url.searchParams.get("wo");
        return {
          pathname: url.pathname,
          wo,
          woview: url.searchParams.get("woview") ?? (wo ? "summary" : null),
          legacy: ["project", "tab", "wotab"].filter((key) => url.searchParams.has(key)),
          hash: url.hash,
        };
      },
      { timeout: NAVIGATION_TIMEOUT },
    )
    .toEqual({
      pathname,
      wo: view ? "WO-01-001" : null,
      woview: view ?? null,
      legacy: [],
      hash,
    });
}

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
// It lives in afterEach because a timed-out test body is abandoned: its finally may never run,
// and the leftover project would then break every later test sharing this fixture.
let restoreFixture: (() => Promise<void>) | undefined;
test.afterEach(async () => {
  const restore = restoreFixture;
  restoreFixture = undefined;
  await restore?.();
});

test("home and root default resolution retain one meaningful history entry", async ({ page }) => {
  // Six full navigations take 22-28 s on the dev server, too close to the 30 s default under gate load.
  test.slow();
  await gotoHydrated(page, "/achievements/ranks", {
    selector: '[data-testid="logros-tab-rangos"]',
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
  await page.goto("/portfolio");
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByRole("heading", { level: 1, name: "Portafolio" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByRole("heading", { level: 1, name: "Portafolio" })).toBeVisible();
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
      "/portfolio/mission-control/observability",
    ],
    [
      "/projects/mission-control?tab=work-orders&wo=WO-01-001&wotab=full#goal",
      "/projects/mission-control/observability",
    ],
  ] as const) {
    await page.goto(legacy);
    await expectWorkOrderLocation(page, canonical, "full", "#goal");
    await expect(page.getByTestId("wo-detail-full")).toContainText("Reader module");
    await page.reload();
    await expectWorkOrderLocation(page, canonical, "full", "#goal");
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

test("post-build registration: a non-first project retains identity through WO Summary/Full/return in both workspaces", async ({
  page,
}) => {
  // About 25 server navigations: 15-22 s when quiet, over 130 s when parallel gates share the machine.
  test.setTimeout(300_000);
  const info = test.info();
  await observeHistory(page);
  const root = path.resolve("e2e/fixtures/factory-root");
  const before = snapshotFiles(root);
  expect(fs.readFileSync(path.join(root, "factory/portfolio.md"), "utf8")).not.toContain(
    "Navigation Review Second",
  );
  restoreFixture = async () => {
    try {
      await page.close();
      await expect
        .poll(() => fs.existsSync(path.join(root, "factory/gamification-ledger.json.lock")), {
          timeout: 10_000,
        })
        .toBe(false);
    } finally {
      for (const file of snapshotFiles(root).keys()) if (!before.has(file)) fs.unlinkSync(file);
      for (const [file, content] of before) fs.writeFileSync(file, content);
    }
  };
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
      const href = `/${family}/navigation-review-second/observability`;
      await gotoHydrated(page, href, {
        selector: '[data-testid="tabbar"]',
        timeout: NAVIGATION_TIMEOUT,
      });
      await expect(page.getByTestId("wo-board")).toContainText("Second project reader");
      if (family === "portfolio") {
        await expect(page.getByTestId("portfolio-page-workspace")).toBeVisible();
        await expect(page.getByTestId("portfolio-overview")).toHaveCount(0);
      }
      await historyCheckpoint(page, `${family}-card`, '[data-testid="wo-card-link"]', info);
      await page.getByTestId("wo-card-link").click();
      await expectWorkOrderLocation(page, href, "summary");
      await expect(page.getByTestId("wo-detail-summary")).toContainText("Second project reader");
      await historyCheckpoint(page, `${family}-full`, '[data-testid="wo-detail-tab-full"]', info);
      await expectHydrated(page, '[data-testid="wo-detail-tab-full"]');
      await page.getByTestId("wo-detail-tab-full").click();
      await expectWorkOrderLocation(page, href, "full");
      await expect(page.getByTestId("wo-detail-full")).toContainText("Second project reader");
      await reloadCommitted(page);
      await expectWorkOrderLocation(page, href, "full");
      await expect(page.getByTestId("wo-detail-full")).toContainText("Second project reader");
      await historyCheckpoint(page, `${family}-back`, '[data-testid="wo-detail-tab-full"]', info);
      await page.goBack();
      await expectWorkOrderLocation(page, href, "summary");
      await expect(page.getByTestId("wo-detail-summary")).toContainText("Second project reader");
      await historyCheckpoint(
        page,
        `${family}-forward`,
        '[data-testid="wo-detail-tab-summary"]',
        info,
      );
      await page.goForward();
      await expectWorkOrderLocation(page, href, "full");
      await expect(page.getByTestId("wo-detail-full")).toContainText("Second project reader");
      await historyCheckpoint(page, `${family}-return`, '[data-testid="wo-detail-back"]', info);
      await page.getByTestId("wo-detail-back").click();
      await expectWorkOrderLocation(page, href);
      for (const tab of ["summary", "changes", "documents"]) {
        await historyCheckpoint(
          page,
          `${family}-tab`,
          `[data-testid="tabbar"] [data-testid="tab-${tab}"]`,
          info,
        );
        await expectHydrated(page, `[data-testid="tabbar"] [data-testid="tab-${tab}"]`);
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
    if (!page.isClosed()) await historyCheckpoint(page, "final", '[data-testid="tabbar"]', info);
  }
});
