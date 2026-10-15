#!/usr/bin/env node
/**
 * Shards the approved whole-app prototype into one self-contained mock per UI FRD (DR-056 §1).
 *
 * Usage: node shard-prototype.mjs <config.json>
 * Config:
 * {
 *   "prototype": "docs/design/prototype/app.html",           // the frozen whole-app prototype
 *   "widths": [1280, 375],                                     // screenshot widths (both are required at the gate)
 *   "frds": {
 *     "frd-01-slug": [
 *       { "id": "library", "title": "Library", "route": "#/library" },
 *       { "id": "library-loading", "title": "Library loading", "route": "#/library", "setup": "state.preview = 'loading'; render();" },
 *       { "id": "delete-confirm", "title": "Delete account", "route": "#/account", "click": "[data-action=\"account-delete\"]" }
 *     ]
 *   }
 * }
 * List EVERY state the FRD's acceptance criteria name (loading, empty, error, partial, dialogs), not only
 * the happy path: a state with no mock becomes an open question in the FDD and a blind spot for the build.
 * Output per FRD: docs/frds/<frd>/mocks/<slug>.html (one <section id="<id>"> per screen, the prototype's
 * own CSS inlined, open dialogs kept, asset paths rewritten) + mocks/screenshots/<id>-<width>.jpg.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, applySetup, settle } from "./lib-browser.mjs";

const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const proto = path.resolve(cfg.prototype);
const protoDir = path.dirname(proto);
const html = fs.readFileSync(proto, "utf8");
const head = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>")).replace(/<script[\s\S]*?<\/script>/g, "");
const widths = cfg.widths || [1280, 375];
const browser = await launchBrowser();
for (const [frd, screens] of Object.entries(cfg.frds)) {
  const dir = path.resolve("docs/frds", frd, "mocks");
  fs.mkdirSync(path.join(dir, "screenshots"), { recursive: true });
  const prefix = path.relative(dir, protoDir).split(path.sep).join("/") + "/";
  const sections = [];
  for (const s of screens) {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, isMobile: w < 500, hasTouch: w < 500 });
      await page.goto(pathToFileURL(proto).href + s.route);
      await page.waitForTimeout(300);
      await applySetup(page, s);
      await settle(page);
      await page.screenshot({ path: path.join(dir, "screenshots", `${s.id}-${w}.jpg`), fullPage: true, type: "jpeg", quality: 80 });
      if (w === widths[0]) {
        const snap = await page.evaluate(() => {
          const main = document.querySelector("main") || document.body;
          return main.outerHTML + [...document.querySelectorAll("dialog[open]")].map(d => d.outerHTML).join("");
        });
        const fixed = snap.replace(/(src="|url\(&quot;|url\(')(?!https?:|data:|\/)([^"')&]+)/g, `$1${prefix}$2`).replace(/<dialog([^>]*) open/g, '<dialog$1 open style="position:static;margin:24px auto"');
        sections.push(`<section class="mock-screen" id="${s.id}"><h2 class="mock-title">${s.title} <code>${s.route}</code></h2>${fixed}</section>`);
      }
      await page.close();
    }
  }
  const slug = frd.replace(/^frd-\d+-/, "");
  fs.writeFileSync(path.join(dir, `${slug}.html`), `<!doctype html><html lang="${cfg.lang || "es"}"><head>${head}<style>.mock-screen{border-top:4px solid currentColor;margin:0 0 64px}.mock-title{font:600 18px/1.3 system-ui,sans-serif;padding:16px;opacity:.85}</style></head><body><p class="mock-title">${frd}: static slice of ${path.relative(path.resolve("."), proto)}. The interactive prototype stays the reference for behaviour and motion.</p>${sections.join("\n")}</body></html>\n`);
  console.log(frd, screens.length, "screens");
}
await browser.close();
