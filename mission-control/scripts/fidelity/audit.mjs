/** Advisory live-oracle audit. Does not bless baselines or claim missing doubles passed. */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { summarize } from "./calibration.mjs";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.split(/=(.*)/s).slice(0, 2)),
);
if (!args.out) throw new Error("Required: out=<absolute evidence directory>");
const out = path.resolve(args.out);
fs.mkdirSync(out, { recursive: true });
const factory = process.env.PANDACORP_FACTORY_ROOT;
if (!factory) throw new Error("PANDACORP_FACTORY_ROOT is required for the fidelity toolkit");
const toolkit = path.join(factory, "plugin/skills/design/scripts/fidelity");
const { compareRGBA, openDecoder } = await import(pathToFileURL(path.join(toolkit, "pixels.mjs")));
const { valuesMatch, ruleFor } = await import(pathToFileURL(path.join(toolkit, "diff.mjs")));
const { freezeAnimations, loadImages, assertImagesLoaded } = await import(
  pathToFileURL(path.join(toolkit, "lib.mjs"))
);
const states = JSON.parse(
  fs.readFileSync("docs/design/prototype/reference/oracle-states.json", "utf8"),
).states;
const units = states.flatMap((s) =>
  s.prototype.widths.flatMap((w) =>
    s.prototype.themes.map((t) => ({ s, w, t, id: `${s.key.replaceAll("/", "__")}__${w}__${t}` })),
  ),
);
const selected = args.only
  ? units.filter((u) => args.only.split(",").includes(u.s.state_id))
  : units;
const browser = await chromium.connect(
  process.env.PW_TEST_CONNECT_WS_ENDPOINT ?? "ws://127.0.0.1:4950/pw",
);
const results = [];
const PROPS = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "color",
  "background-color",
  "border-radius",
  "padding",
  "gap",
  "width",
  "height",
];
const HOOKS = [
  "h1",
  "#sidebar",
  ".card-head",
  ".card-title",
  ".chip",
  ".btn",
  ".hero",
  ".fragua",
  ".tabs",
];

function oracleUrl(route, theme) {
  const i = route.indexOf("#");
  const url = new URL(args.oracle ?? "http://127.0.0.1:3990/index.html");
  if (i > 0)
    new URLSearchParams(route.slice(0, i)).forEach((v, k) => {
      url.searchParams.set(k, v);
    });
  url.searchParams.set("demo", "off");
  url.searchParams.set("host", "page");
  url.searchParams.set("theme", theme);
  url.hash = i >= 0 ? route.slice(i) : route;
  return url.href;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the frozen oracle defines a closed action language.
async function replay(page, actions, side) {
  for (const a of actions) {
    if (a.js) {
      if (side === "app" && a.js.includes("applyScenario("))
        throw new Error(`Missing data double: ${a.js}`);
      await page.evaluate(a.js);
    } else if (a.click) await page.locator(a.click).first().click({ timeout: 1200 });
    else if (a.fill) await page.locator(a.fill[0]).first().fill(a.fill[1], { timeout: 1200 });
    else if (a.waitFor) await page.locator(a.waitFor).first().waitFor({ timeout: 1200 });
    else if (a.scroll)
      await page.locator(a.scroll).first().scrollIntoViewIfNeeded({ timeout: 1200 });
    else if (a.wait !== undefined) await page.waitForTimeout(a.wait);
    else throw new Error(`Unsupported action: ${JSON.stringify(a)}`);
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each capture keeps navigation, replay and evidence failures in one record.
async function capture(u, side, run) {
  const { s, w, t, id } = u;
  const context = await browser.newContext({
    viewport: { width: w, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: t,
    isMobile: w < 768,
    hasTouch: w < 768,
  });
  context.setDefaultTimeout(10000);
  const rec = {
    side,
    errors: [],
    blockedMutations: [],
    actionError: null,
    doubleMissing: side === "app" && s.build.doubles.length > 0,
  };
  try {
    await context.clock.setFixedTime(new Date("2026-10-21T00:20:00.000Z"));
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => rec.errors.push(e.message));
    // Capture actions must never change the owner's real data, even if a recipe regresses.
    await page.route("**/*", (route) => {
      const method = route.request().method();
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        rec.blockedMutations.push({ method, url: route.request().url() });
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    const response = await page.goto(
      side === "oracle"
        ? oracleUrl(s.prototype.route, t)
        : `${args.app ?? "http://127.0.0.1:4913"}${s.build.route.replace("/portfolio/mission-control", "/portfolio/pandacorp-mission-control").replace("/portfolio/personal-page-v2", "/portfolio/personalpage-v2")}`,
      {
        waitUntil: args.legacy === "1" && side === "app" ? "commit" : "domcontentloaded",
        timeout: 45000,
      },
    );
    rec.status = response?.status();
    await page.evaluate(() => document.fonts.ready);
    if (side === "app") {
      if (args.legacy === "1") {
        await page.locator("h1").waitFor({ timeout: 15000 });
        await page.waitForFunction(
          () => {
            const element = document.querySelector("button");
            return element && Object.keys(element).some((key) => key.startsWith("__reactProps$"));
          },
          undefined,
          { timeout: 15000 },
        );
      } else await page.locator('#app[data-hydrated="true"]').waitFor({ timeout: 15000 });
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      if (s.build.route === "/") {
        const state = await page.evaluate(async () => {
          const response = await fetch("/api/plugin-sync", { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error(`plugin-sync HTTP ${response.status}`);
          return response.json();
        });
        const verdicts = state.runtimes ? Object.values(state.runtimes) : [state];
        if (verdicts.some((v) => v.drift && v.reason === "behind"))
          await page.locator(".alert-banner").waitFor();
      }
    } else await page.addStyleTag({ content: ".foot{display:none!important}" });
    try {
      await replay(
        page,
        Array.isArray(s.build.actions) && side === "app" ? s.build.actions : s.prototype.actions,
        side,
      );
    } catch (e) {
      rec.actionError = e.message.split("\n")[0];
    }
    await loadImages(page, 8000);
    await assertImagesLoaded(page);
    await freezeAnimations(page);
    rec.styles = await page.evaluate(
      ({ hooks, props }) =>
        Object.fromEntries(
          hooks.map((selector) => {
            const el = document.querySelector(selector);
            return [
              selector,
              el
                ? Object.fromEntries(
                    props.map((p) => [p, getComputedStyle(el).getPropertyValue(p)]),
                  )
                : null,
            ];
          }),
        ),
      { hooks: HOOKS, props: PROPS },
    );
    rec.probe = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      touch: matchMedia("(pointer:coarse)").matches,
      hover: matchMedia("(hover:hover)").matches,
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
    }));
    if (w < 768 && (!rec.probe.touch || rec.probe.hover)) throw new Error("Touch emulation lost");
    const masks = (s.comparison.mask ?? []).map((m) =>
      page.locator(side === "oracle" ? m.selector : '[data-oracle-mask="model-canvas"]'),
    );
    const file = path.join(out, `run-${run}`, `${id}__${side}`);
    // Viewport diagnostic has equal dimensions. Full-height evidence remains separate and unscaled.
    rec.viewportFile = `${file}.png`;
    await page.screenshot({
      path: rec.viewportFile,
      animations: "disabled",
      caret: "hide",
      mask: masks,
    });
    let height = 900;
    if (s.prototype.capture !== "viewport") {
      for (let i = 0; i < 4; i++) {
        const next = await page.evaluate(() =>
          Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        );
        if (height === next) break;
        height = next;
        await page.setViewportSize({ width: w, height: Math.min(next, 20000) });
      }
    }
    rec.fullHeight = height;
    rec.fullFile = `${file}__full.png`;
    await page.screenshot({
      path: rec.fullFile,
      animations: "disabled",
      caret: "hide",
      mask: masks,
    });
    rec.postProbe = await page.evaluate(() => ({
      touch: matchMedia("(pointer:coarse)").matches,
      hover: matchMedia("(hover:hover)").matches,
    }));
    if (w < 768 && (!rec.postProbe.touch || rec.postProbe.hover))
      throw new Error("Touch emulation lost after viewport growth");
  } catch (e) {
    rec.fatal = e.message.split("\n")[0];
  } finally {
    await context.close();
  }
  return rec;
}

function isValidState(state, oracle, app) {
  return (
    !oracle.fatal &&
    !app.fatal &&
    !oracle.actionError &&
    !app.actionError &&
    !app.doubleMissing &&
    !state.prototype.actions.some((a) =>
      /data-star|discard-idea|restore-idea/.test(a.click ?? ""),
    ) &&
    !oracle.errors.length &&
    !app.errors.length &&
    oracle.status === 200 &&
    app.status === 200
  );
}

function styleMismatches(oracle, app) {
  const mismatches = [];
  for (const hook of HOOKS)
    for (const property of PROPS) {
      const ref = oracle.styles?.[hook]?.[property];
      const cand = app.styles?.[hook]?.[property];
      if (ref != null && !valuesMatch(ref, cand, ruleFor(property).tol))
        mismatches.push({ hook, property, ref, cand });
    }
  return mismatches;
}

try {
  // Record the exact comparator used; no new baseline is produced.
  fs.writeFileSync(path.join(out, "comparator.txt"), compareRGBA.toString());
  for (let run = 1; run <= Number(args.runs ?? 3); run++) {
    fs.mkdirSync(path.join(out, `run-${run}`), { recursive: true });
    const workers = Math.min(2, Math.max(1, Number(args.workers ?? 1)));
    await Promise.all(
      Array.from({ length: workers }, async (_, worker) => {
        const decoder = await openDecoder(browser);
        try {
          for (const [index, u] of selected.entries()) {
            if (index % workers !== worker) continue;
            const recordFile = path.join(out, `run-${run}`, `${u.id}.json`);
            if (args.resume === "1" && fs.existsSync(recordFile)) {
              results.push(JSON.parse(fs.readFileSync(recordFile, "utf8")));
              continue;
            }
            const [oracle, app] = await Promise.all([
              capture(u, "oracle", run),
              capture(u, "app", run),
            ]);
            const rec = {
              run,
              id: u.id,
              key: u.s.key,
              width: u.w,
              theme: u.t,
              doubles: u.s.build.doubles,
              oracle,
              app,
            };
            rec.validState = isValidState(u.s, oracle, app);
            if (
              oracle.viewportFile &&
              app.viewportFile &&
              fs.existsSync(oracle.viewportFile) &&
              fs.existsSync(app.viewportFile)
            ) {
              rec.viewport = await decoder.diff(
                fs.readFileSync(oracle.viewportFile),
                fs.readFileSync(app.viewportFile),
                { sliceHeight: 900, threshold: 0.1, maxRatio: 0.005 },
              );
            }
            if (!oracle.fatal && !app.fatal) {
              rec.full = await decoder.diff(
                fs.readFileSync(oracle.fullFile),
                fs.readFileSync(app.fullFile),
                { sliceHeight: 900, threshold: 0.1, maxRatio: 0.005 },
              );
            }
            rec.styleMismatches = styleMismatches(oracle, app);
            fs.writeFileSync(path.join(out, `run-${run}`, `${u.id}.json`), JSON.stringify(rec));
            results.push(rec);
            if ((index + 1) % 10 === 0)
              console.log(
                JSON.stringify({
                  run,
                  completed: index + 1,
                  total: selected.length,
                  valid: results.filter((r) => r.run === run && r.validState).length,
                }),
              );
          }
        } finally {
          await decoder.close();
        }
      }),
    );
    const rows = results.filter((r) => r.run === run);
    const summary = {
      run,
      attempted: rows.length,
      valid: rows.filter((r) => r.validState).length,
      viewport: summarize(
        rows
          .filter((r) => r.validState)
          .flatMap((r) => r.viewport?.slices.map((s) => s.ratio) ?? []),
      ),
      fullPass: rows.filter((r) => r.validState && r.full?.ok).length,
      fullSizeMismatch: rows.filter((r) => r.full?.sizeMismatch).length,
    };
    fs.writeFileSync(path.join(out, `summary-${run}.json`), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
  }
} finally {
  await browser.close();
}
