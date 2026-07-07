#!/usr/bin/env node
/**
 * Prototype screenshot harness (DR-091 fallback-#2, F5).
 *
 * The reviewer's fidelity oracle chain (reviewer.md §6) falls back — when an FRD has no per-route
 * `mocks/` but declares a global `visual_source` prototype — to rendering the prototype's shard and
 * A/B-comparing it against the live route screenshot. This makes that step CANONICAL instead of
 * improvised: render a prototype HTML file (optionally one shard/selector) to a PNG with the same
 * Playwright/Chromium the visual gate uses, so both sides are captured identically.
 *
 * Usage:
 *   node e2e/screenshot-prototype.mjs --file docs/design/prototype/party.html \
 *        [--selector "#party-shard"] [--out docs/reviews/smoke/party-proto.png] \
 *        [--width 1280] [--height 900]
 *
 * --file      REQUIRED. Path to the prototype HTML (resolved against cwd).
 * --selector  Optional CSS selector = the shard to shoot (default: full page).
 * --out       Optional output PNG path (default: <file-basename>.proto.png next to cwd).
 * --width/--height  Optional viewport (default 1280x900, the visual gate's desktop project).
 */
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const file = args.file;
if (!file) {
  console.error("screenshot-prototype: --file <prototype.html> is required.");
  process.exit(2);
}
const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error(`screenshot-prototype: prototype not found: ${abs}`);
  process.exit(2);
}
const selector = args.selector && args.selector !== "true" ? args.selector : null;
const out = args.out && args.out !== "true"
  ? path.resolve(args.out)
  : path.resolve(`${path.basename(abs).replace(/\.html?$/i, "")}.proto.png`);
const width = Number(args.width) || 1280;
const height = Number(args.height) || 900;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(pathToFileURL(abs).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (selector) {
    await page.locator(selector).first().screenshot({ path: out });
  } else {
    await page.screenshot({ path: out, fullPage: true });
  }
  console.log(`screenshot-prototype: wrote ${out}${selector ? ` (shard ${selector})` : " (full page)"}`);
} finally {
  await browser.close();
}
