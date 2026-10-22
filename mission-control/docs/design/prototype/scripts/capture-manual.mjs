// Captures the rendered Manual pages from a locally served Mission Control (read-only) so the
// Órbita study can show the real guide bodies, which are composed in React and therefore absent
// from the markdown snapshot.
//
// Default: the app must be served pointed at the fixture factory (PANDACORP_FACTORY_ROOT=
// docs/design/prototype/fixtures/factory-root) at MC_URL; output goes to data/manual-live.js with the
// fixture's frozen capture time. MC_REAL=1 captures the real app (default http://127.0.0.1:1987) into
// the ignored data-live/ instead. The Manual is the app's own public documentation; absolute machine
// paths it mentions as examples become placeholders so no local path ships in the data.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {exporterMode} from './make-fixtures.mjs';
const {chromium} = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test');

const MODE = exporterMode();
const CAPTURED_AT = MODE.real ? new Date().toISOString() : (process.env.MC_CLOCK ?? '2026-10-21T00:20:00.000Z');
const base = process.env.MC_URL ?? (MODE.real ? 'http://127.0.0.1:1987' : 'http://127.0.0.1:1991');
global.window = {};
eval(fs.readFileSync(path.join(MODE.outputDir, 'snapshot.js'), 'utf8'));
const pages = window.MC_SNAPSHOT.manual;
/** Machine paths in the guide's examples become placeholders: the shared folder, or a home directory. */
const localPaths = html => html.replace(/\/Users\/Shared\//g, '&lt;Shared&gt;/').replace(/\/Users\/[^/\s<"']+\//g, '~/');

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
const out = {capturedAt: CAPTURED_AT, source: MODE.real ? base : 'Mission Control served from the fixture factory', pages: {}, vars: []};
const vars = new Set();
for (const p of pages) {
  await page.goto(`${base}/manual/${p.group}/${p.slug}`, {waitUntil: 'domcontentloaded', timeout: 60000});
  const reader = page.locator('[data-testid=doc-reader-authored]');
  await reader.waitFor({timeout: 60000});
  const res = await reader.evaluate(el => {
    const c = el.cloneNode(true);
    c.querySelectorAll('script,style,button,[data-testid=copy-button]').forEach(n => n.remove());
    c.querySelectorAll('i.ti').forEach(n => n.remove());
    const found = [];
    c.querySelectorAll('*').forEach(n => {
      for (const a of [...n.attributes]) {
        const keep = ['style', 'href', 'colspan', 'rowspan', 'open', 'aria-label', 'role', 'viewBox', 'd', 'fill', 'stroke', 'x', 'y', 'width', 'height', 'points', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'transform', 'stroke-width', 'text-anchor', 'xmlns'];
        if (!keep.includes(a.name)) n.removeAttribute(a.name);
      }
      if (n.tagName === 'A') { n.setAttribute('data-ext', n.getAttribute('href') || ''); n.removeAttribute('href'); }
      const s = n.getAttribute('style');
      if (s) for (const m of s.matchAll(/var\((--[\w-]+)/g)) found.push(m[1]);
    });
    return {html: c.innerHTML, vars: found, text: c.textContent.length};
  });
  res.vars.forEach(v => vars.add(v));
  out.pages[p.slug] = localPaths(res.html);
  console.log(p.group + '/' + p.slug, res.html.length, 'chars,', res.text, 'text');
}
out.vars = [...vars].sort();
await browser.close();
fs.mkdirSync(MODE.outputDir, {recursive: true});
fs.writeFileSync(path.join(MODE.outputDir, 'manual-live.js'), 'window.MC_MANUAL_LIVE = ' + JSON.stringify(out) + ';\n');
console.log('vars:', out.vars.join(' '));
