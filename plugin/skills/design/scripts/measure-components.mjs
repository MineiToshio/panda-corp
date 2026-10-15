#!/usr/bin/env node
/**
 * Fidelity references for the build (DR-056): measures one real instance of every frozen component,
 * builds a component catalogue page, and exports exact SVG assets.
 *
 * Usage: node measure-components.mjs <config.json>
 * Config:
 * {
 *   "prototype": "docs/design/prototype/app.html",
 *   "components": [ { "name": "ResumeCard", "route": "#/library", "selector": ".resume-card", "setup": "...", "click": "..." } ],
 *   "exports": "Object.fromEntries(Object.entries(ICON_PATHS).map(([k, d]) => ['icons/' + k + '.svg', `<svg ...><path d=\"${d}\"/></svg>`]))"
 * }
 * Outputs next to the prototype: reference/computed-styles.json (light/dark × 1280/375), components.html
 * (each component at its measured width, theme toggle), reference/components-{light,dark}.jpg, and every
 * file the optional `exports` expression returns ({ relativePath: content }, evaluated in the page; resolve
 * CSS variables to literal colours so the files stand alone).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, applySetup, settle } from "./lib-browser.mjs";

const PROPS = ["font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "color", "background-color", "background-image", "border-top", "border-radius", "padding", "gap", "box-shadow", "min-height", "display", "grid-template-columns"];
const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const proto = path.resolve(cfg.prototype);
const out = path.dirname(proto);
const url = pathToFileURL(proto).href;
const browser = await launchBrowser();
const measures = {};
const snippets = {};
for (const scheme of ["light", "dark"]) for (const w of [1280, 375]) for (const c of cfg.components) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme, isMobile: w < 500, hasTouch: w < 500 });
  await page.goto(url + c.route); await page.waitForTimeout(300);
  await applySetup(page, c); await settle(page);
  const r = await page.evaluate(([sel, props]) => {
    const el = document.querySelector(sel); if (!el) return null;
    const cs = getComputedStyle(el); const box = el.getBoundingClientRect();
    return { style: { ...Object.fromEntries(props.map(k => [k, cs.getPropertyValue(k).slice(0, 160)])), size: `${Math.round(box.width)}x${Math.round(box.height)}` }, html: el.outerHTML };
  }, [c.selector, PROPS]);
  await page.close();
  if (!r) { console.error(`MISSING ${c.name} (${c.selector} on ${c.route}, ${scheme} ${w})`); continue; }
  (measures[c.name] ||= { route: c.route, selector: c.selector })[`${scheme}-${w}`] = r.style;
  if (scheme === "light" && w === 1280) snippets[c.name] = r.html;
}
fs.mkdirSync(path.join(out, "reference"), { recursive: true });
fs.writeFileSync(path.join(out, "reference/computed-styles.json"), JSON.stringify({ source: path.basename(proto), components: measures }, null, 1) + "\n");
const html = fs.readFileSync(proto, "utf8");
const head = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>")).replace(/<script[\s\S]*?<\/script>/g, "");
const stage = name => { const [w, h] = measures[name]["light-1280"].size.split("x").map(Number); return `width:min(100%, ${w + 2}px)` + (h && w < 400 && h > w ? `;min-height:${h}px` : ""); };
const items = Object.entries(snippets).map(([name, snip]) => `<section class="cat-item"><h2 class="cat-name">${name} <code>${measures[name].selector}</code> <a href="${path.basename(proto)}${measures[name].route}">${measures[name].route}</a></h2><div style="${stage(name)}">${snip.replace(/<dialog([^>]*) open/g, '<dialog$1 open style="position:static;margin:0"')}</div></section>`).join("\n");
fs.writeFileSync(path.join(out, "components.html"), `<!doctype html><html><head>${head}<style>body{padding:24px}.cat-item{margin:0 0 40px;border-top:3px solid currentColor;padding-top:12px}.cat-name{font:600 16px/1.3 system-ui,sans-serif;margin-bottom:12px}.cat-name code{opacity:.6;font-size:12px;margin:0 8px}</style></head><body><p><button onclick="const r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark'">Toggle theme</button> One real instance of every frozen component. Measurements: reference/computed-styles.json.</p>${items}</body></html>\n`);
for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
  await page.goto(pathToFileURL(path.join(out, "components.html")).href); await settle(page);
  await page.screenshot({ path: path.join(out, `reference/components-${scheme}.jpg`), fullPage: true, type: "jpeg", quality: 80 });
  await page.close();
}
if (cfg.exports) {
  const page = await browser.newPage(); await page.goto(url); await page.waitForTimeout(300);
  const files = await page.evaluate(new Function(`return (${cfg.exports});`));
  for (const [rel, content] of Object.entries(files)) { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content.endsWith("\n") ? content : content + "\n"); }
  console.log("exported", Object.keys(files).length, "files");
  await page.close();
}
console.log("measured", Object.keys(measures).length, "components");
await browser.close();
