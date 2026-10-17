#!/usr/bin/env node
/**
 * The component catalogue: <prototype dir>/components.html (the live primary-width markup of every measured state on
 * the reference CSS, with a generated state shim so forced pseudo-classes show statically, ids prefixed per cell, the
 * icon sprite inlined, a theme toggle, and the touch-width images), the catalogue sheets reference/components-<theme>.png
 * (cut at component boundaries into components-<theme>-N.png parts under catalog.sheetMax px), and the config's
 * `exports` (exact SVG assets evaluated in the prototype). Reads the measure stage's cache and the split report.
 * Usage: node catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.mjs';
import { units } from './cssparse.mjs';
import { launch, navigate, reassert, relPosix, settle, slug, urlFor } from './lib.mjs';
import { readMeasured } from './measure.mjs';
import { makeStage, runPool, writeIfChanged } from './pool.mjs';
import { readSplitReport } from './split-css.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const PSEUDO = [['focus-visible', /(?<!:):focus-visible/g], ['focus-within', /(?<!:):focus-within/g], ['focus', /(?<!:):focus(?![-\w])/g], ['hover', /(?<!:):hover/g], ['active', /(?<!:):active/g]];
const REF_ATTRS = new Set(['for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns', 'aria-activedescendant', 'list', 'form', 'headers']);

/** Per CSS file: its pseudo-class rules re-keyed to [data-st~="..."], placed right after the file (keeps the cascade). */
function stateShim(cfg, order) {
  const out = {};
  const walk = (us, wrap, acc) => {
    for (const u of us) {
      if (u.kind === 'comment') continue;
      if (u.children) { walk(u.children, [...wrap, u.prelude.trim()], acc); continue; }
      if (u.kind !== 'rule') continue;
      const sel = u.prelude.trim();
      let next = sel;
      for (const [st, re] of PSEUDO) next = next.replace(re, `[data-st~="${st}"]`);
      if (next !== sel) acc.push(wrap.reduceRight((r, w) => `${w}{${r}}`, `${next}{${u.body.trim()}}`));
    }
  };
  for (const f of order) { const acc = []; walk(units(fs.readFileSync(path.join(cfg.paths.css, `${f}.css`), 'utf8')), [], acc); out[f] = acc; }
  return out;
}

function prefixIds(fragment, pre) {
  const ids = new Set([...fragment.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  if (!ids.size) return { html: fragment, ids };
  let html = fragment.replace(/\s([\w:-]+)="([^"]*)"/g, (m, name, val) => {
    if (name === 'id') return ` id="${pre}${val}"`;
    if (name === 'name') return ` name="${pre}${val}"`;
    if (REF_ATTRS.has(name)) return ` ${name}="${val.split(/\s+/).map((v) => (ids.has(v) ? pre + v : v)).join(' ')}"`;
    if ((name === 'href' || name === 'xlink:href') && val.startsWith('#') && ids.has(val.slice(1))) return ` ${name}="#${pre}${val.slice(1)}"`;
    return m;
  });
  html = html.replace(/url\(#([^)]+)\)/g, (m, id) => (ids.has(id) ? `url(#${pre}${id})` : m));
  return { html, ids };
}

function idShim(idRules, ids, pre) {
  const rules = [];
  for (const r of idRules) {
    const hit = r.ids.filter((i) => ids.has(i));
    if (!hit.length) continue;
    let p = r.prelude;
    for (const i of hit) p = p.replace(new RegExp(`#${i.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}(?![-\\w])`, 'g'), `#${pre}${i}`);
    rules.push(r.wrap.reduceRight((acc, w) => `${w}{${acc}}`, `${p}{${r.body}}`));
  }
  return rules;
}

const attrsStr = (a) => Object.entries(a).map(([k, v]) => (v !== '' ? ` ${k}="${esc(v)}"` : ` ${k}`)).join('');

function marginBox(rootm, w, h, snap) {
  if (!rootm?.size) return { w, bleed: false };
  const [rw, rh] = rootm.size.split('x').map(Number);
  const pinned = ['fixed', 'absolute'].includes(snap.position) || snap.html.startsWith('<dialog');
  if (Math.abs(rw - w) > 1 || Math.abs(rh - h) > 1 || pinned) return { w, bleed: false };
  let mg = (rootm.margin || '0px').split(/\s+/).map((x) => (x.endsWith('px') ? Number(x.slice(0, -2)) : 0));
  mg = mg.length === 1 ? [mg[0], mg[0], mg[0], mg[0]] : mg.length === 2 ? [...mg, ...mg] : mg.length === 3 ? [...mg, mg[1]] : mg.slice(0, 4);
  return { w: Math.ceil(rw + mg[1] + mg[3]), bleed: mg[1] < 0 || mg[3] < 0 };
}

/**
 * Builds components.html.
 * @param {object} cfg normalised config
 * @returns {{html: string, components: number, stateRules: number}}
 */
export function buildCatalog(cfg) {
  const split = readSplitReport(cfg);
  const measured = readMeasured(cfg);
  const html = fs.readFileSync(cfg.paths.prototype, 'utf8');
  const sprite = cfg.sprite ? (html.match(new RegExp(cfg.sprite)) || [''])[0] : '';
  const shim = stateShim(cfg, split.order);
  const cssRel = relPosix(cfg.paths.protoDir, cfg.paths.css);
  const cropRel = relPosix(cfg.paths.protoDir, cfg.paths.crops);
  const protoName = path.basename(cfg.paths.prototype);
  const touch = cfg.scope.touchWidth;
  const cellsCss = [];
  const nav = [];
  const sections = [];
  Object.entries(measured).forEach(([name, rec], ci) => {
    const comp = cfg.components.find((c) => c.name === name);
    const sid = `c-${slug(name)}`;
    nav.push(`<a href="#${sid}">${esc(name)}</a>`);
    const sess = cfg.shard.sectionAttributes.filter((a) => comp.route.includes(a.routeMatch)).map((a) => ` ${a.attribute}="${a.value}"`).join('');
    const cells = Object.entries(rec.snapshots || {}).map(([sn, snap], si) => {
      const pre = `c${ci}s${si}--`;
      const frag = snap.html.replace(/^<([\w-]+)/, (m, t) => `<${t} data-cat-root="${esc(name)}|${esc(sn)}|${snap.size[0]}x${snap.size[1]}"`);
      const open = snap.chain.map((c) => { const a = { ...c.attrs }; a.style = `display:contents${a.style ? `;${a.style}` : ''}`; return `<${c.tag}${attrsStr(a)}>`; }).join('');
      const close = [...snap.chain].reverse().map((c) => `</${c.tag}>`).join('');
      let { html: full, ids } = prefixIds(open + frag + close, pre);
      cellsCss.push(...idShim(split.idRules, ids, pre));
      const ctxRec = rec.states[sn]?.[snap.ctx] || {};
      const [w0, h] = snap.size;
      const { w, bleed } = marginBox(ctxRec.root, w0, h, snap);
      if (['fixed', 'absolute'].includes(snap.position) || frag.startsWith('<dialog')) full = full.replace(' data-cat-root=', ' data-cat-pinned data-cat-root=');
      let stage;
      if (w && h) {
        const clipped = h > 720;
        stage = `<div class="cat-stage${clipped ? ' cat-clip' : ''}"${sess} style="width:${w}px;min-height:${Math.min(h, 720)}px">${full}</div>${clipped ? `<p class="cat-note">${w}x${h}: clipped to 720 px here (open the prototype for the whole element)</p>` : ''}`;
      } else stage = `<div class="cat-stage cat-none"${sess}><p>Not rendered at ${snap.ctx} in this state: see the ${touch} image.</p><div hidden>${full}</div></div>`;
      const hang = Math.max(0, ...Object.entries(ctxRec.children || {}).filter(([k, v]) => /pop|menu|-lb|drop/.test(k) && v && ['absolute', 'fixed'].includes(v.position) && v.display !== 'none' && !v.size.startsWith('0x')).map(([, v]) => Number(v.size.split('x')[1])));
      const pad = hang > 40 ? ` style="padding-bottom:${Math.trunc(hang) + 12}px"` : '';
      return `<figure class="cat-cell${w > 1200 && !bleed ? ' cat-wide' : ''}"${pad}><figcaption>${snap.ctx} · ${esc(sn)}</figcaption>${stage}</figure>`;
    });
    const crops = [];
    for (const [sn, byCtx] of Object.entries(rec.crops || {})) for (const width of cfg.widths.filter((x) => x !== cfg.scope.primaryWidth)) {
      const imgs = cfg.themes.map((t) => [t, byCtx[`${t}-${width}`]]).filter(([, f]) => f).map(([t, f]) => `<a class="th-${t}" href="${cropRel}/${f}"><img class="cat-crop" src="${cropRel}/${f}" alt="${esc(name)}, ${esc(sn)}, ${width}, ${t}"></a>`).join('');
      if (imgs) crops.push(`<figure class="cat-cell"><figcaption>${width}${width < cfg.touchBelow ? ' touch' : ''} · ${esc(sn)}</figcaption><div class="cat-cropbox">${imgs}</div></figure>`);
    }
    const q = cfg.params.demoOff ? `?${cfg.params.demoOff}` : '';
    const href = comp.route.startsWith('?') ? `${protoName}${q ? `${q}&${comp.route.slice(1)}` : comp.route}` : `${protoName}${q}${comp.route}`;
    sections.push(`<section class="cat-item" id="${sid}"><h2 class="cat-name">${esc(name)} <code>${esc(rec.selector)}</code> <a href="${esc(href)}">${esc(comp.route)}</a></h2>`
      + `<p class="cat-meta">States: ${Object.keys(rec.states).map(esc).join(', ')}. Measured children: ${rec.children.map((c) => `<code>${esc(c)}</code>`).join(', ')}.</p>`
      + `<div class="cat-row">${cells.join('')}</div>${crops.length ? `<div class="cat-row">${crops.join('')}</div>` : ''}</section>`);
  });
  const links = split.order.map((f) => `<link rel="stylesheet" href="${cssRel}/${f}.css">${shim[f].length ? `\n<style data-state-shim="${f}">${shim[f].join('\n')}</style>` : ''}`).join('\n');
  const ta = cfg.themeAttribute;
  const [t0, t1 = t0] = cfg.themes;
  const attrs = Object.entries(cfg.shard.htmlAttributes).map(([k, v]) => ` ${k}="${v}"`).join('');
  const page = `<!doctype html>
<html lang="${cfg.lang}"${attrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(cfg.catalog.title)}</title>
<!-- the portable prototype CSS in its load order; after each file, a generated state shim: that file's :hover / :focus /
     :focus-visible / :focus-within / :active rules re-keyed to [data-st~="..."], so a static snippet shows a forced state -->
${links}
<!-- generated id shim: ids are prefixed per cell, so the id-selector rules are repeated for the prefixed ids -->
<style id="id-shim">
${[...new Set(cellsCss)].join('\n')}
</style>
<style>
body{padding:24px 16px}
.cat-bar{position:sticky;top:0;z-index:200;display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:8px 0;margin-bottom:24px;background:var(--bg,Canvas);border-bottom:1px solid var(--border,GrayText)}
.cat-nav{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;margin:0 0 32px}
.cat-item{margin:0 0 40px;border-top:3px solid currentColor;padding-top:12px}
.cat-name{font:600 16px/1.3 system-ui,sans-serif;margin-bottom:4px}
.cat-name code,.cat-meta code{opacity:.65;font-size:12px;margin:0 4px}
.cat-meta{font-size:12px;opacity:.75;margin-bottom:12px}
.cat-row{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;margin-bottom:16px}
.cat-cell{margin:0}
.cat-wide{margin-inline:-16px}
.cat-wide>figcaption{padding-inline:16px}
.cat-cell>figcaption{font:500 11px/1.4 ui-monospace,monospace;opacity:.75;margin-bottom:4px}
.cat-stage{position:relative;transform:translateZ(0);display:flex;flex-direction:column;container-type:inline-size}
.cat-stage [data-cat-root]{flex-grow:1!important;flex-shrink:0!important}
.cat-stage [data-cat-pinned]{position:relative!important;inset:auto!important;margin:0!important;max-width:100%}
.cat-stage dialog[data-cat-pinned]{display:block}
.cat-none{width:240px;padding:12px;border:1px dashed GrayText;font-size:12px;opacity:.8}
.cat-cropbox{border:1px dashed GrayText;display:inline-block;line-height:0}
.cat-crop{display:block;max-width:240px;max-height:360px;width:auto;height:auto}
.cat-clip{max-height:720px;overflow:hidden}
.cat-note{font:500 11px/1.4 ui-monospace,monospace;opacity:.75;margin-top:4px}
${cfg.themes.slice(1).map((t) => `.th-${t}{display:none}`).join('\n')}
${cfg.themes.slice(1).map((t) => `[${ta}="${t}"] .th-${t}{display:inline-block}\n[${ta}="${t}"] .th-${t0}{display:none}`).join('\n')}
</style>
<script>(function(){var t=new URLSearchParams(location.search).get('theme');if(t)document.documentElement.setAttribute('${ta}',t);})();</script>
</head>
<body>
${sprite}
<div class="cat-bar"><button type="button" onclick="var r=document.documentElement;r.setAttribute('${ta}',r.getAttribute('${ta}')==='${t1}'?'${t0}':'${t1}')">Toggle theme</button><span>Every frozen component in its states. Cells are live ${cfg.scope.primaryWidth} markup on the portable CSS; images are captures at the other widths. Values: reference/computed-styles.json.</span></div>
<nav class="cat-nav" aria-label="Components">${nav.join('')}</nav>
${sections.join('\n')}
</body>
</html>
`;
  return { html: page, components: Object.keys(measured).length, stateRules: Object.values(shim).reduce((n, v) => n + v.length, 0) };
}

/** Captures the catalogue sheets for every theme, cut at section boundaries under sheetMax. */
async function sheets(cfg, browser, stage) {
  const width = cfg.scope.primaryWidth;
  const units = cfg.themes.map((theme) => ({ key: { width, theme }, label: `sheet ${theme}` }));
  const reports = await runPool({
    browser, cfg, units, label: 'catalog sheets',
    run: async (u, h) => {
      const { page } = h;
      await navigate(h, `${pathToFileURL(cfg.paths.catalog).href}?theme=${u.key.theme}`);
      h.dirty = true;
      await page.waitForTimeout(400);
      await settle(h);
      await page.addStyleTag({ content: '.cat-bar{position:static!important}' });
      const hgt = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
      const tops = await page.evaluate(() => [...document.querySelectorAll('.cat-item')].map((s) => Math.floor(s.getBoundingClientRect().top + scrollY)));
      const max = cfg.catalog.sheetMax;
      const cuts = [0];
      let start = 0;
      let last = 0;
      for (const t of [...tops.filter((x) => x > 0), hgt]) {
        while (t - start > max) { start = last > start ? last : start + max; cuts.push(start); last = start; }
        last = t;
      }
      if (cuts[cuts.length - 1] !== hgt) cuts.push(hgt);
      const parts = cuts.length - 1;
      const vh = parts === 1 ? hgt : Math.max(...cuts.slice(1).map((c, i) => c - cuts[i]));
      await page.setViewportSize({ width, height: vh });
      await page.waitForTimeout(400);
      const files = [];
      for (let i = 0; i < parts; i++) {
        const top = cuts[i];
        const bottom = cuts[i + 1];
        const sy = Math.min(top, Math.max(0, hgt - vh));
        await page.evaluate((y) => window.scrollTo(0, y), sy);
        await page.waitForTimeout(300);
        const name = parts === 1 ? `components-${u.key.theme}.png` : `components-${u.key.theme}-${i + 1}.png`;
        await page.screenshot({ path: path.join(stage, name), clip: { x: 0, y: top - sy, width, height: bottom - top }, animations: 'disabled', caret: 'hide' });
        files.push({ file: name, from: top, to: bottom });
        await reassert(h, name, { product: false });
      }
      await page.setViewportSize({ width, height: cfg.baseHeight });
      return { theme: u.key.theme, height: hgt, viewport: vh, parts: files };
    },
  });
  for (const r of reports) {
    const keep = new Set(r.parts.map((x) => x.file));
    for (const f of r.parts) fs.copyFileSync(path.join(stage, f.file), path.join(cfg.paths.reference, f.file));
    for (const f of fs.readdirSync(cfg.paths.reference)) if (new RegExp(`^components-${r.theme}(-\\d+)?\\.(png|jpg)$`).test(f) && !keep.has(f)) fs.rmSync(path.join(cfg.paths.reference, f));
  }
  return reports;
}

const PRESENTATION = ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'color', 'style'];
const PAINT_INITIAL = { fill: 'rgb(0, 0, 0)', stroke: 'none', 'stroke-width': '1px' };

/**
 * Runs in the page: for each exported SVG built from a <symbol> (its content contains the symbol's markup), the
 * presentation the icon renders with that the file does not carry: an attribute of the symbol, or a fill/stroke the
 * page's CSS gives the <svg> that uses it.
 */
function lossyExports({ files, attrs, initial }) {
  const out = [];
  const symbols = [...document.querySelectorAll('symbol[id]')].filter((s) => s.innerHTML.trim()).sort((a, b) => b.innerHTML.length - a.innerHTML.length);
  for (const [rel, content] of Object.entries(files)) {
    const sym = symbols.find((s) => content.includes(s.innerHTML));
    if (!sym) continue;
    const root = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement;
    if (root.localName !== 'svg') continue;
    const missing = attrs.filter((a) => sym.hasAttribute(a) && !root.hasAttribute(a));
    const host = [...document.querySelectorAll('use')].find((u) => (u.getAttribute('href') || u.getAttribute('xlink:href')) === `#${sym.id}`)?.closest('svg');
    if (host && !root.hasAttribute('style')) {
      const cs = getComputedStyle(host);
      for (const [p, v] of Object.entries(initial)) if (cs.getPropertyValue(p) !== v && !root.hasAttribute(p) && !missing.includes(p)) missing.push(`${p} (CSS: ${cs.getPropertyValue(p)})`);
    }
    if (missing.length) out.push(`${rel} (from #${sym.id}) lacks ${missing.join(', ')}`);
  }
  return out;
}

/**
 * Evaluates cfg.exports in the prototype and writes the returned files under the prototype folder, inside
 * `exportPaths` only (the prototype hash excludes those paths). Files a previous run exported that the list no longer
 * returns are removed, and an SVG that drops presentation its source symbol renders with is reported.
 */
async function writeExports(cfg, browser) {
  if (!cfg.exports) return { count: 0, removed: [], warnings: [] };
  const [{ files, warnings }] = await runPool({
    browser, cfg, units: [{ key: { width: cfg.scope.primaryWidth, theme: cfg.themes[0] }, label: 'exports' }],
    run: async (u, h) => {
      await navigate(h, urlFor(cfg, '', { theme: u.key.theme }));
      await settle(h);
      const out = await h.page.evaluate(new Function(`return (${cfg.exports});`));
      return { files: out, warnings: await h.page.evaluate(lossyExports, { files: out, attrs: PRESENTATION, initial: PAINT_INITIAL }) };
    },
  });
  const inside = (f) => cfg.paths.exports.some((e) => f === e || f.startsWith(e + path.sep));
  for (const rel of Object.keys(files)) {
    if (!inside(path.resolve(cfg.paths.protoDir, rel))) throw new Error(`exports: ${rel} is outside exportPaths [${cfg.exportPaths.join(', ')}]: add its folder to exportPaths (the prototype hash skips only those paths)`);
  }
  const listFile = path.join(cfg.paths.freeze, 'exports.json');
  const previous = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : [];
  for (const [rel, content] of Object.entries(files)) writeIfChanged(path.resolve(cfg.paths.protoDir, rel), content.endsWith('\n') ? content : `${content}\n`);
  const removed = previous.filter((rel) => !(rel in files) && inside(path.resolve(cfg.paths.protoDir, rel)) && fs.existsSync(path.resolve(cfg.paths.protoDir, rel)));
  for (const rel of removed) fs.rmSync(path.resolve(cfg.paths.protoDir, rel));
  writeIfChanged(listFile, `${JSON.stringify(Object.keys(files).sort(), null, 1)}\n`);
  for (const w of warnings) console.log(`WARN exports: ${w}`);
  return { count: Object.keys(files).length, removed, warnings };
}

/**
 * The catalog stage.
 * @param {{cfg: object, browser?: object}} ctx
 * @returns {Promise<object>} summary
 */
export async function run({ cfg, browser }) {
  const built = buildCatalog(cfg);
  writeIfChanged(cfg.paths.catalog, built.html);
  const own = !browser;
  const b = browser || (await launch());
  const stage = makeStage('catalog');
  try {
    const report = await sheets(cfg, b, stage);
    writeIfChanged(path.join(cfg.paths.freeze, 'components-sheet.json'), `${JSON.stringify(report, null, 1)}\n`);
    const exp = await writeExports(cfg, b);
    return { units: report.length + (cfg.exports ? 1 : 0), components: built.components, stateRules: built.stateRules, sheets: report.map((r) => `${r.theme}:${r.parts.length}`).join(' '), exported: exp.count, staleRemoved: exp.removed, exportWarnings: exp.warnings };
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
    if (own) await b.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(JSON.stringify(await run({ cfg: loadConfig() })));
}
