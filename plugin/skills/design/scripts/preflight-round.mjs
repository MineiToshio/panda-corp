#!/usr/bin/env node
/**
 * Design preflight, run after EVERY review round on the whole-app prototype (not only at the freeze), so a fidelity
 * problem is caught the round it appears.
 *
 * Usage: node preflight-round.mjs <prototype.html> [--json] [--static] [--save | --out FILE] [--screens a,b]
 *        [--config FILE] [--min-font N] [--max-colors N] [--max-lengths N] [--demo-selectors "a,b"] [--demo-text REGEX]
 * Exit:  0 clean (no findings), 1 findings (any fail or warn), 2 could not run the browser checks and nothing else was found.
 *
 * Static checks (CSS and markup): literals outside tokens, unguarded :hover, fonts, token blocks.
 * Browser checks (Chromium through lib-browser.mjs; the prototype is served over loopback HTTP at ?demo=off&host=page):
 *   small text, demo leaks and horizontal overflow on every [data-screen], plus which keyframed opacity fades hit text.
 * `--static` skips the browser; the result is then `complete: false` and the design gate refuses it.
 *
 * Config (optional): `--config FILE` (a bare preflight object) or the project's `docs/design/freeze/fidelity.config.json`
 * -> its `preflight` object (the fidelity toolkit's one config; schema: fidelity/config.schema.json `preflight`) with
 * minFontPx, textWidths, overflowWidth, demoSelectors, demoText, maxLiteralColors, maxLiteralLengths, screens, skipScreens,
 * smallTextIgnore (selectors exempt from the size floor; the poster block's own classes are exempt automatically).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { launchBrowser, settle } from "./lib-browser.mjs";

const DEFAULTS = {
  minFontPx: 12,
  textWidths: [375, 1280],
  overflowWidth: 375,
  demoSelectors: ["[data-demo-only]", ".demo-badge", ".demo-controls", ".demo-strip"],
  demoText: "\\b(solo demo|demo only|demo mode|modo demo)\\b",
  maxLiteralColors: 0,
  maxLiteralLengths: 150,
  screens: null,
  skipScreens: [],
  smallTextIgnore: [],
};
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".gif": "image/gif", ".ico": "image/x-icon" };
const GENERIC_FAMILY = /^(ui-[\w-]+|system-ui|-apple-system|blinkmacsystemfont|sans-serif|serif|monospace|cursive|fantasy|emoji|math|fangsong|inherit|initial|unset)$/i;
const MAX_REPORTED = 8;

// ---------------------------------------------------------------- arguments and config

function parseArgs(argv) {
  const args = { flags: {}, positional: [] };
  const valued = new Set(["out", "screens", "config", "min-font", "max-colors", "max-lengths", "demo-selectors", "demo-text"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { args.positional.push(a); continue; }
    const key = a.slice(2);
    if (valued.has(key)) args.flags[key] = argv[++i];
    else args.flags[key] = true;
  }
  return args;
}

function projectRootOf(file) {
  const marker = `${path.sep}docs${path.sep}design${path.sep}`;
  const at = file.indexOf(marker);
  return at >= 0 ? file.slice(0, at) : null;
}

function loadConfig(flags, root) {
  const cfg = { ...DEFAULTS };
  const files = [root && path.join(root, "docs/design/freeze/fidelity.config.json"), flags.config].filter(Boolean);
  for (const f of files) {
    if (!fs.existsSync(f)) { if (f === flags.config) throw new Error(`config not found: ${f}`); continue; }
    const parsed = JSON.parse(fs.readFileSync(f, "utf8"));
    Object.assign(cfg, f === flags.config ? parsed : parsed.preflight || {});
  }
  if (flags["min-font"]) cfg.minFontPx = Number(flags["min-font"]);
  if (flags["max-colors"]) cfg.maxLiteralColors = Number(flags["max-colors"]);
  if (flags["max-lengths"]) cfg.maxLiteralLengths = Number(flags["max-lengths"]);
  if (flags["demo-selectors"]) cfg.demoSelectors = flags["demo-selectors"].split(",").map(s => s.trim()).filter(Boolean);
  if (flags["demo-text"]) cfg.demoText = flags["demo-text"];
  if (flags.screens) cfg.screens = flags.screens.split(",").map(s => s.trim()).filter(Boolean);
  return cfg;
}

// ---------------------------------------------------------------- CSS extraction and parsing

/** Collects the app CSS: inline <style> blocks plus local linked stylesheets; remote ones are only recorded. */
function collectCss(html, htmlPath) {
  const chunks = [];
  const remoteSheets = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) chunks.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const href = /href\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (!href) continue;
    if (/^(https?:)?\/\//i.test(href)) { remoteSheets.push(href); continue; }
    const local = path.resolve(path.dirname(htmlPath), href.split(/[?#]/)[0]);
    if (fs.existsSync(local)) chunks.push(fs.readFileSync(local, "utf8"));
  }
  for (const m of html.matchAll(/@import\s+(?:url\()?["']?(https?:[^"')\s;]+)/gi)) remoteSheets.push(m[1]);
  return { css: chunks.join("\n"), remoteSheets };
}

const POSTER_REGION = /\/\*\s*poster:css:begin[\s\S]*?\*\/[\s\S]*?\/\*\s*poster:css:end\s*\*\//g;

/** Removes comments and masks strings and url() bodies so braces and semicolons inside them cannot confuse the parser. */
function sanitizeCss(text) {
  const table = [];
  const stash = s => { table.push(s); return `§${table.length - 1}§`; };
  let out = "";
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "*") { const end = text.indexOf("*/", i + 2); i = end < 0 ? text.length : end + 2; out += " "; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      out += `"${stash(text.slice(i + 1, j))}"`; i = j + 1; continue;
    }
    if ((c === "u" || c === "U") && /^url\(\s*[^"')\s]/i.test(text.slice(i, i + 8))) {
      const end = text.indexOf(")", i);
      const stop = end < 0 ? text.length : end;
      out += `url(${stash(text.slice(i + 4, stop).trim())})`; i = stop + 1; continue;
    }
    out += c; i++;
  }
  return { css: out, table };
}

const unmask = (s, table) => s.replace(/§(\d+)§/g, (_, n) => table[Number(n)] ?? "");

function matchingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return text.length;
}

function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < text.length; i++) {
    if ("([".includes(text[i])) depth++;
    else if (")]".includes(text[i])) depth--;
    else if (text[i] === sep && depth === 0) { parts.push(text.slice(last, i)); last = i + 1; }
  }
  parts.push(text.slice(last));
  return parts.map(s => s.trim()).filter(Boolean);
}

const GROUPING_AT = /^@(media|supports|layer|container|scope|document)\b/i;
const KEYFRAMES_AT = /^@(-\w+-)?keyframes\b/i;

/** Flat list of rules: { selector, ctx: [at-rule preludes], decls: [{prop, value}], kf?, fontFace? }. Handles nesting. */
function parseRules(css, table) {
  const rules = [];
  const walk = (text, ctx, parent, extra) => {
    let i = 0;
    while (i < text.length) {
      let j = i;
      while (j < text.length && !"{;}".includes(text[j])) j++;
      const head = text.slice(i, j).trim();
      if (text[j] === "{") {
        const close = matchingBrace(text, j);
        const inner = text.slice(j + 1, close);
        openBlock(head, inner, ctx, parent, extra);
        i = close + 1;
        continue;
      }
      const colon = head.indexOf(":");
      if (parent && colon > 0 && !head.startsWith("@")) parent.decls.push({ prop: head.slice(0, colon).trim().toLowerCase(), value: head.slice(colon + 1).trim() });
      i = j + 1;
    }
  };
  const openBlock = (head, inner, ctx, parent, extra) => {
    if (head.startsWith("@")) {
      if (KEYFRAMES_AT.test(head)) { walk(inner, ctx, null, { kf: head.replace(KEYFRAMES_AT, "").trim() }); return; }
      if (/^@font-face/i.test(head)) { const r = { selector: "@font-face", ctx, decls: [], fontFace: true }; rules.push(r); walk(inner, ctx, r, {}); return; }
      if (GROUPING_AT.test(head)) { walk(inner, [...ctx, head], null, extra); return; }
      return;
    }
    const selector = parent ? splitTopLevel(head, ",").map(s => (s.includes("&") ? s.replace(/&/g, parent.selector) : `${parent.selector} ${s}`)).join(", ") : head;
    const r = { selector, ctx, decls: [], ...extra };
    rules.push(r);
    walk(inner, ctx, r, {});
  };
  walk(css, [], null, {});
  return rules.map(r => ({ ...r, selector: unmask(r.selector, table), ctx: r.ctx.map(c => unmask(c, table)) }));
}

/** Classes that only the poster block styles: the export poster scales its text with --u, so its glyphs are exempt from the size floor. */
function posterOnlyClasses(posterCss, appRules) {
  const { css, table } = sanitizeCss(posterCss);
  const classesOf = rules => new Set(rules.flatMap(r => [...r.selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(m => m[1])));
  const app = classesOf(appRules);
  return [...classesOf(parseRules(css, table))].filter(c => !app.has(c));
}

// ---------------------------------------------------------------- static analyses

const TOKEN_SELECTOR = /^(html|:root)?((\[data-theme[^\]]*\])|(\.(dark|light|theme-[\w-]+))|(:not\(\[data-theme[^\]]*\]\)))*$/i;
const isTokenBlock = r => !r.kf && !r.fontFace && r.decls.some(d => d.prop.startsWith("--")) && splitTopLevel(r.selector, ",").every(s => s && TOKEN_SELECTOR.test(s.replace(/\s+/g, "")));
const isDemoRule = r => /\.demo-|\[data-demo/i.test(r.selector);
const COLOR_LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const PX_LITERAL = /(?<![\w.#§-])-?(?:\d+\.\d+|\d+|\.\d+)px\b/g;

function top(counter, n = 5) {
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Literal colours and px lengths in the app CSS outside the :root/[data-theme] token blocks, the poster block and demo rules. */
function analyzeLiterals(rules, inlineStyles) {
  const colors = { total: 0, bySelector: new Map(), values: new Map() };
  const lengths = { total: 0, bySelector: new Map(), values: new Map() };
  const bump = (bucket, regex, value, selector) => {
    for (const m of value.matchAll(regex)) {
      bucket.total++;
      bucket.bySelector.set(selector, (bucket.bySelector.get(selector) || 0) + 1);
      bucket.values.set(m[0].toLowerCase(), (bucket.values.get(m[0].toLowerCase()) || 0) + 1);
    }
  };
  for (const r of rules) {
    if (r.fontFace || isDemoRule(r)) continue;
    const tokenBlock = isTokenBlock(r);
    const selector = r.kf ? `@keyframes ${r.kf}` : r.selector.replace(/\s+/g, " ").slice(0, 90);
    for (const d of r.decls) {
      if (tokenBlock && d.prop.startsWith("--")) continue;
      bump(colors, COLOR_LITERAL, d.value, selector);
      bump(lengths, PX_LITERAL, d.value, selector);
    }
  }
  const inline = { total: 0, bySelector: new Map(), values: new Map() };
  for (const v of inlineStyles) bump(inline, COLOR_LITERAL, v, "style attribute");
  return { colors, lengths, inlineColors: inline.total };
}

const HOVER_GUARD = /\((any-)?hover\s*:\s*hover\)/i;

function analyzeHover(rules) {
  const unguarded = new Map();
  for (const r of rules) {
    if (r.kf || r.fontFace || isDemoRule(r) || !/:hover\b/.test(r.selector)) continue;
    if (r.ctx.some(c => HOVER_GUARD.test(c))) continue;
    const sel = splitTopLevel(r.selector, ",").find(s => /:hover\b/.test(s)).replace(/\s+/g, " ").slice(0, 90);
    unguarded.set(sel, (unguarded.get(sel) || 0) + 1);
  }
  return [...unguarded.keys()];
}

/** Keyframes that animate opacity, with the selectors of the rules that run them (reduced-motion overrides excluded). */
function analyzeFadeKeyframes(rules) {
  const fading = new Set(rules.filter(r => r.kf && r.decls.some(d => d.prop === "opacity")).map(r => r.kf));
  const uses = [];
  for (const r of rules) {
    if (r.kf || r.fontFace || isDemoRule(r) || r.ctx.some(c => /prefers-reduced-motion\s*:\s*reduce/i.test(c))) continue;
    for (const d of r.decls) {
      if (d.prop !== "animation" && d.prop !== "animation-name") continue;
      for (const name of d.value.split(/[\s,]+/)) if (fading.has(name)) uses.push({ keyframes: name, selector: r.selector });
    }
  }
  return uses;
}

const firstFamily = (value, table) => unmask(splitTopLevel(value, ",")[0] || "", table).replace(/^["']|["']$/g, "").trim();

function declaredFaces(rules, table) {
  const faces = new Map();
  for (const r of rules.filter(x => x.fontFace)) {
    const family = firstFamily(r.decls.find(d => d.prop === "font-family")?.value || "", table).toLowerCase();
    const src = unmask(r.decls.find(d => d.prop === "src")?.value || "", table);
    const urls = [...src.matchAll(/url\(([^)]*)\)/gi)].map(m => m[1].replace(/^["']|["']$/g, ""));
    const entry = faces.get(family) || { urls: [] };
    entry.urls.push(...urls);
    faces.set(family, entry);
  }
  return faces;
}

const isRemote = u => /^(https?:)?\/\//i.test(u);

/** Web-font verdicts: the first family of every --font-* token and of body/html must be a declared web font. */
function analyzeFonts(rules, table, html, remoteSheets) {
  const faces = declaredFaces(rules, table);
  const googleFamilies = new Set();
  for (const link of [...remoteSheets, ...[...html.matchAll(/<link\b[^>]*href\s*=\s*["']([^"']+)/gi)].map(m => m[1])]) {
    for (const m of link.matchAll(/[?&]family=([^:&@]+)/g)) googleFamilies.add(decodeURIComponent(m[1]).replace(/\+/g, " ").toLowerCase());
  }
  const roles = [];
  for (const r of rules) {
    if (r.kf || r.fontFace) continue;
    for (const d of r.decls) {
      const token = isTokenBlock(r) && /^--(font|ff|typeface)[\w-]*$/.test(d.prop);
      const base = /^(html|body|:root)$/.test(r.selector.trim()) && d.prop === "font-family";
      if (token || base) roles.push({ role: token ? d.prop : `${r.selector.trim()} font-family`, family: firstFamily(d.value, table), value: unmask(d.value, table) });
    }
  }
  const remote = new Set(remoteSheets.filter(u => /font|typekit/i.test(u)));
  for (const face of faces.values()) for (const u of face.urls.filter(isRemote)) remote.add(u);
  const verdicts = roles.filter(x => x.family && !x.family.startsWith("var(")).map(x => {
    const key = x.family.toLowerCase();
    const webFont = faces.has(key) || googleFamilies.has(key);
    const generic = GENERIC_FAMILY.test(x.family);
    const mono = /mono|code/.test(x.role);
    return { ...x, webFont, generic, mono, remote: faces.get(key)?.urls.some(isRemote) || googleFamilies.has(key) };
  });
  const remoteFamilies = [...faces].filter(([, f]) => f.urls.some(isRemote)).map(([k]) => k);
  return { verdicts, faces: [...faces.keys()], remote: [...remote], remoteFamilies };
}

function analyzeTokens(rules) {
  const blocks = rules.filter(isTokenBlock);
  const darkSel = r => /dark/i.test(r.selector) || r.ctx.some(c => /prefers-color-scheme\s*:\s*dark/i.test(c));
  const root = blocks.filter(r => !darkSel(r) && /^(html|:root)$/.test(r.selector.trim()));
  const dark = blocks.filter(darkSel);
  const count = list => list.reduce((n, r) => n + r.decls.filter(d => d.prop.startsWith("--")).length, 0);
  return { rootTokens: count(root), darkTokens: count(dark), rootBlocks: root.length, darkBlocks: dark.length };
}

// ---------------------------------------------------------------- findings from static analyses

const finding = (check, severity, message, extra = {}) => ({ check, severity, message, ...extra });

function staticFindings(model, cfg) {
  const out = [];
  const { colors, lengths, inlineColors } = model.literals;
  if (colors.total > cfg.maxLiteralColors) {
    out.push(finding("literalColors", "fail", `${colors.total} literal colour(s) outside the token blocks (limit ${cfg.maxLiteralColors}); top: ${top(colors.bySelector, 3).map(([s, n]) => `${s} (${n})`).join("; ")}`, { total: colors.total, topSelectors: top(colors.bySelector), topValues: top(colors.values) }));
  }
  if (lengths.total > cfg.maxLiteralLengths) {
    out.push(finding("literalLengths", "warn", `${lengths.total} literal px length(s) outside the token blocks (warn above ${cfg.maxLiteralLengths}); top: ${top(lengths.bySelector, 3).map(([s, n]) => `${s} (${n})`).join("; ")}`, { total: lengths.total, topSelectors: top(lengths.bySelector), topValues: top(lengths.values) }));
  }
  if (inlineColors > 0) out.push(finding("literalColors", "warn", `${inlineColors} literal colour(s) in inline style attributes`, { total: inlineColors }));
  if (model.hover.length) out.push(finding("unguardedHover", "warn", `${model.hover.length} :hover rule(s) outside @media (hover:hover); e.g. ${model.hover.slice(0, 3).join("; ")}`, { selectors: model.hover.slice(0, 50) }));
  out.push(...fontFindings(model.fonts));
  out.push(...tokenFindings(model.tokens));
  return out;
}

function fontFindings(fonts) {
  const out = [];
  if (!fonts.verdicts.length) return [finding("fonts", "fail", "no font-family tokens (--font-*) or body font-family found: typography is not declared")];
  for (const v of fonts.verdicts) {
    if (v.webFont) continue;
    const severity = v.mono ? "warn" : "fail";
    const why = v.generic ? "a system stack" : "a named font with no @font-face (it falls back to whatever the OS has)";
    out.push(finding("fonts", severity, `${v.role}: first family "${v.family}" is ${why}; fonts must be web fonts`, { role: v.role, family: v.family }));
  }
  if (fonts.remote.length) out.push(finding("fonts", "warn", `fonts loaded from the network, not self-hosted: ${fonts.remote.slice(0, 4).join(", ")}`, { remote: fonts.remote }));
  return out;
}

function tokenFindings(t) {
  const out = [];
  if (!t.rootBlocks) out.push(finding("tokens", "fail", "no :root token block (custom properties) found"));
  if (!t.darkBlocks) out.push(finding("tokens", "fail", 'no dark token block: expected [data-theme="dark"] or @media (prefers-color-scheme: dark) overriding the tokens'));
  return out;
}

// ---------------------------------------------------------------- browser pass

function serveRoot(root) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split(/[?#]/)[0]);
    const file = path.resolve(root, `.${rel}`);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** Runs inside the page: one pass over the visible DOM of the current route. Hidden subtrees (display:none) are pruned. */
function scanPage(opts) {
  const vw = document.documentElement.clientWidth;
  const out = { small: [], leaks: [], offenders: [], scrollWidth: document.documentElement.scrollWidth, clientWidth: vw };
  const posterClasses = new Set(opts.posterClasses);
  const textRe = opts.demoText ? new RegExp(opts.demoText, "i") : null;
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "svg", "SVG"]);
  const label = el => {
    const cls = [...el.classList].slice(0, 2).map(c => `.${c}`).join("");
    const tid = el.getAttribute("data-testid");
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls}${tid ? `[data-testid=${tid}]` : ""}`;
  };
  const walk = (el, demo, clipped, inLeak) => {
    if (SKIP.has(el.tagName)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    const rect = el.getBoundingClientRect();
    const visible = cs.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
    const classDemo = [...el.classList].some(c => c.startsWith("demo-"));
    const isLeak = opts.demoSelector && el.matches(opts.demoSelector) && cs.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    const nextDemo = demo || classDemo || el.hasAttribute("data-demo-only") || [...el.classList].some(c => posterClasses.has(c)) || Boolean(opts.ignoreSelector && el.matches(opts.ignoreSelector));
    const ownText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join(" ").trim();
    if (isLeak && !inLeak) out.leaks.push({ kind: "element", sel: label(el), text: el.textContent.trim().slice(0, 40) });
    if (ownText && visible) {
      if (textRe && !inLeak && !isLeak && (textRe.test(ownText) || /\bDEMO\b/.test(ownText))) out.leaks.push({ kind: "text", sel: label(el), text: ownText.slice(0, 40) });
      const size = parseFloat(cs.fontSize);
      if (!nextDemo && size < opts.minFont) out.small.push({ sel: label(el), size, text: ownText.slice(0, 40) });
    }
    const clippedNext = clipped || cs.overflowX !== "visible";
    if (opts.overflow && !clipped && rect.width > 0 && rect.right > vw + 1 && !nextDemo) out.offenders.push({ sel: label(el), right: Math.round(rect.right) });
    for (const child of el.children) walk(child, nextDemo, clippedNext, inLeak || isLeak);
  };
  walk(document.body, false, false, false);
  out.offenders = out.offenders.sort((a, b) => b.right - a.right).slice(0, 3);
  out.small = out.small.slice(0, 400);
  return out;
}

const isVisibleScreen = id => {
  const el = document.querySelector(`[data-screen="${id}"]`);
  return Boolean(el && el.checkVisibility());
};

async function openPage(browser, base, rel, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
  context.setDefaultTimeout(30000);
  const netHosts = new Set();
  await context.route(/^https?:/, route => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1") return route.continue();
    netHosts.add(u.host);
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(`${base}/${rel}?demo=off&host=page&theme=light`, { waitUntil: "domcontentloaded" });
  await Promise.race([page.evaluate(() => document.fonts.ready), page.waitForTimeout(8000)]);
  await settle(page);
  return { page, context, netHosts };
}

async function runWidth(page, width, screens, cfg, demoSelector, measureOverflow) {
  const results = [];
  const unreachable = [];
  for (const id of screens) {
    if (id !== "(page)") {
      await page.evaluate(s => { location.hash = `#${s}`; }, id);
      const ok = await page.waitForFunction(`(${isVisibleScreen.toString()})(${JSON.stringify(id)})`, null, { timeout: 2500 }).then(() => true, () => false);
      if (!ok) { unreachable.push(id); continue; }
      await page.waitForTimeout(40);
    }
    const scan = await page.evaluate(scanPage, { minFont: cfg.minFontPx, demoText: cfg.demoText, demoSelector, overflow: measureOverflow, posterClasses: cfg.posterClasses, ignoreSelector: cfg.smallTextIgnore.join(", ") });
    results.push({ screen: id, width, ...scan });
  }
  return { results, unreachable };
}

function groupSmallText(scans) {
  const groups = new Map();
  for (const s of scans) {
    for (const t of s.small) {
      const key = `${t.size}|${t.sel}`;
      const g = groups.get(key) || { sel: t.sel, size: t.size, text: t.text, widths: new Set(), screens: new Set() };
      g.widths.add(s.width);
      g.screens.add(s.screen);
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => a.size - b.size || b.screens.size - a.screens.size);
}

function browserFindings(scans, unreachable, cfg, extras) {
  const out = [];
  const small = groupSmallText(scans);
  if (small.length) {
    out.push(finding("smallText", "fail", `${small.length} element style(s) with text under ${cfg.minFontPx}px; worst: ${small.slice(0, 3).map(g => `${g.sel} ${g.size}px "${g.text}"`).join("; ")}`, {
      total: small.length,
      items: small.slice(0, 60).map(g => ({ selector: g.sel, sizePx: g.size, sample: g.text, widths: [...g.widths], screens: [...g.screens].slice(0, 6) })),
    }));
  }
  const leaks = new Map();
  for (const s of scans) for (const l of s.leaks) leaks.set(`${l.kind}|${l.sel}|${l.text}`, { ...l, screen: s.screen });
  if (leaks.size) out.push(finding("demoLeaks", "fail", `${leaks.size} demo-only element(s) or text still visible with demo=off; e.g. ${[...leaks.values()].slice(0, 3).map(l => `${l.sel} "${l.text}"`).join("; ")}`, { items: [...leaks.values()].slice(0, 60) }));
  const overflowing = scans.filter(s => s.width === cfg.overflowWidth && s.scrollWidth > s.clientWidth + 1);
  if (overflowing.length) {
    out.push(finding("overflow", "fail", `horizontal overflow at ${cfg.overflowWidth}px on ${overflowing.length} screen(s): ${overflowing.slice(0, 4).map(s => `${s.screen} (${s.scrollWidth}px; ${s.offenders.map(o => o.sel).join(", ") || "no unclipped offender"})`).join("; ")}`, {
      items: overflowing.map(s => ({ screen: s.screen, scrollWidth: s.scrollWidth, clientWidth: s.clientWidth, offenders: s.offenders })),
    }));
  }
  for (const id of unreachable) out.push(finding("screens", "warn", `screen "${id}" is not reachable through location.hash, so it was not measured`, { screen: id }));
  out.push(...extras);
  return out;
}

async function textFadeFindings(page, uses) {
  const hits = await page.evaluate(candidates => {
    const found = [];
    for (const u of candidates) {
      const sel = u.selector.replace(/:(hover|focus|focus-visible|focus-within|active|target|checked|disabled)\b/g, "");
      if (/::?(before|after|marker|placeholder|selection)/.test(sel)) continue;
      let nodes = [];
      try { nodes = [...document.querySelectorAll(sel)]; } catch { continue; }
      const withText = nodes.find(n => n.textContent.trim().length > 0);
      if (withText) found.push({ ...u, sample: withText.textContent.trim().slice(0, 40), matches: nodes.length });
    }
    return found;
  }, uses);
  return hits.map(h => finding("textFades", "warn", `@keyframes ${h.keyframes} animates opacity on "${h.selector}" which contains text ("${h.sample}")`, h));
}

async function fontLoadFindings(page, fonts, netHosts) {
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === "loaded").map(f => f.family.replace(/^["']|["']$/g, "").toLowerCase()));
  const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily.split(",")[0].replace(/^[\s"']+|[\s"']+$/g, "").toLowerCase());
  const out = [];
  const localFaces = new Set(fonts.faces);
  if (body && localFaces.has(body) && !fonts.remoteFamilies.includes(body) && !loaded.includes(body)) {
    out.push(finding("fonts", "fail", `body font "${body}" has @font-face rules but none loaded in the browser: check the src paths`, { family: body }));
  }
  if (netHosts.size) out.push(finding("fonts", "warn", `the page requested the network (blocked during the run): ${[...netHosts].slice(0, 4).join(", ")}`, { hosts: [...netHosts] }));
  return out;
}

async function runBrowser(protoPath, model, cfg) {
  const root = projectRootOf(protoPath) || path.dirname(protoPath);
  const server = await serveRoot(root);
  const base = `http://127.0.0.1:${server.address().port}`;
  const rel = path.relative(root, protoPath).split(path.sep).map(encodeURIComponent).join("/");
  const demoSelector = cfg.demoSelectors.join(", ");
  let browser;
  try {
    browser = await launchBrowser();
    const scans = [];
    const unreachable = new Set();
    let extras = [];
    let screens = null;
    for (const width of [...new Set([...cfg.textWidths, cfg.overflowWidth])]) {
      const { page, context, netHosts } = await openPage(browser, base, rel, width);
      if (!screens) {
        const all = await page.evaluate(() => [...document.querySelectorAll("[data-screen]")].map(e => ({ id: e.dataset.screen, demo: Boolean(e.closest("[data-demo-only]")) })));
        screens = cfg.screens || all.filter(s => !s.demo).map(s => s.id).filter(id => !cfg.skipScreens.includes(id));
        if (!screens.length) screens = ["(page)"];
        extras = [...(await textFadeFindings(page, model.fadeUses))];
      }
      const run = await runWidth(page, width, screens, cfg, demoSelector, width === cfg.overflowWidth);
      scans.push(...run.results);
      run.unreachable.forEach(id => unreachable.add(id));
      if (width === cfg.textWidths[0]) extras.push(...(await fontLoadFindings(page, model.fonts, netHosts)));
      await context.close();
    }
    return { findings: browserFindings(scans, [...unreachable], cfg, extras), screens, widths: [...new Set([...cfg.textWidths, cfg.overflowWidth])] };
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

async function playwrightAvailable() {
  try { await import(process.env.PLAYWRIGHT_MODULE || "playwright"); return true; } catch { return false; }
}

// ---------------------------------------------------------------- report

const CHECKS = ["smallText", "demoLeaks", "literalColors", "literalLengths", "unguardedHover", "textFades", "overflow", "fonts", "tokens", "screens"];
const BROWSER_CHECKS = new Set(["smallText", "demoLeaks", "textFades", "overflow", "screens"]);

function summarize(findings, browserRan) {
  const checks = {};
  for (const id of CHECKS) {
    const own = findings.filter(f => f.check === id);
    const skipped = !browserRan && BROWSER_CHECKS.has(id);
    checks[id] = { status: skipped ? "skipped" : own.some(f => f.severity === "fail") ? "fail" : own.length ? "warn" : "ok", findings: own.length };
  }
  return checks;
}

function renderTable(report) {
  const lines = [`preflight-round  ${report.prototype}  (browser ${report.browser}, ${(report.durationMs / 1000).toFixed(1)}s)`, ""];
  lines.push(`${"check".padEnd(16)}${"status".padEnd(9)}findings`);
  for (const [id, c] of Object.entries(report.checks)) lines.push(`${id.padEnd(16)}${c.status.toUpperCase().padEnd(9)}${c.findings || ""}`);
  lines.push("");
  const shown = new Map();
  for (const f of report.findings) {
    const n = shown.get(f.check) || 0;
    shown.set(f.check, n + 1);
    if (n < MAX_REPORTED) lines.push(`${f.severity === "fail" ? "FAIL" : "WARN"}  [${f.check}] ${f.message}`);
  }
  lines.push(report.status === "clean" ? "CLEAN" : report.status === "incomplete" ? "INCOMPLETE: the browser checks did not run" : `FINDINGS: ${report.counts.fail} fail, ${report.counts.warn} warn`);
  return lines.join("\n");
}

async function main() {
  const started = Date.now();
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const target = positional[0];
  if (!target || !fs.existsSync(target)) { console.error("usage: preflight-round.mjs <prototype.html> [--json] [--static] [--save | --out FILE]"); process.exit(64); }
  const protoPath = fs.realpathSync(target);
  const root = projectRootOf(protoPath);
  const cfg = loadConfig(flags, root);
  const html = fs.readFileSync(protoPath, "utf8");
  const { css: rawCss, remoteSheets } = collectCss(html, protoPath);
  const { css, table } = sanitizeCss(rawCss.replace(POSTER_REGION, " "));
  const rules = parseRules(css, table);
  const posterCss = [...rawCss.matchAll(POSTER_REGION)].map(m => m[0]).join("\n");
  cfg.posterClasses = posterCss ? posterOnlyClasses(posterCss, rules) : [];
  const inlineStyles = [...html.replace(/<style\b[\s\S]*?<\/style>/gi, "").matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map(m => m[1]);
  const model = {
    literals: analyzeLiterals(rules, inlineStyles),
    hover: analyzeHover(rules),
    fonts: analyzeFonts(rules, table, html, remoteSheets),
    tokens: analyzeTokens(rules),
    fadeUses: analyzeFadeKeyframes(rules),
  };
  let findings = staticFindings(model, cfg);
  let browser = "skipped";
  let meta = {};
  if (!flags.static) {
    if (await playwrightAvailable()) {
      try {
        const run = await runBrowser(protoPath, model, cfg);
        findings = findings.concat(run.findings);
        browser = "ran";
        meta = { screens: run.screens, widths: run.widths };
      } catch (err) {
        browser = "unavailable";
        findings.push(finding("screens", "warn", `browser checks could not run: ${String(err.message).split("\n")[0]}`));
      }
    } else {
      browser = "unavailable";
    }
  }
  const counts = { fail: findings.filter(f => f.severity === "fail").length, warn: findings.filter(f => f.severity === "warn").length };
  const complete = browser === "ran";
  const status = counts.fail ? "fail" : counts.warn ? "warnings" : complete ? "clean" : "incomplete";
  const report = {
    tool: "preflight-round",
    schema: 1,
    prototype: path.relative(process.cwd(), protoPath) || protoPath,
    prototypeSha256: crypto.createHash("sha256").update(html).digest("hex"),
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    browser,
    complete,
    status,
    counts,
    thresholds: { minFontPx: cfg.minFontPx, maxLiteralColors: cfg.maxLiteralColors, maxLiteralLengths: cfg.maxLiteralLengths },
    literals: { colors: model.literals.colors.total, lengths: model.literals.lengths.total },
    ...meta,
    checks: summarize(findings, complete),
    findings,
  };
  const outFile = flags.out || (flags.save && root && path.join(root, "docs/design/freeze/preflight.json"));
  if (outFile) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(flags.json ? JSON.stringify(report, null, 2) : renderTable(report));
  process.exit(findings.length ? 1 : complete ? 0 : 2);
}

main().catch(err => { console.error(`preflight-round: ${err.stack || err}`); process.exit(2); });
