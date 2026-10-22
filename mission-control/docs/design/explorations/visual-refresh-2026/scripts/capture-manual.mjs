// Captures the rendered Manual pages from the locally served Mission Control (read-only)
// so the Órbita study can show the real guide bodies, which are composed in React and
// therefore absent from the markdown snapshot. Output stays in the ignored data folder.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium} = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.MC_URL ?? 'http://127.0.0.1:1987';
global.window = {};
eval(fs.readFileSync(path.join(root, 'data/snapshot.js'), 'utf8'));
const pages = window.MC_SNAPSHOT.manual;

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
const out = {capturedAt: new Date().toISOString(), source: base, pages: {}, vars: []};
const vars = new Set();
for (const p of pages) {
  await page.goto(`${base}/manual/${p.group}/${p.slug}`, {waitUntil: 'domcontentloaded', timeout: 30000});
  const reader = page.locator('[data-testid=doc-reader-authored]');
  await reader.waitFor({timeout: 15000});
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
  out.pages[p.slug] = res.html;
  console.log(p.group + '/' + p.slug, res.html.length, 'chars,', res.text, 'text');
}
out.vars = [...vars].sort();
await browser.close();
fs.writeFileSync(path.join(root, 'data/manual-live.js'), 'window.MC_MANUAL_LIVE = ' + JSON.stringify(out) + ';\n');
console.log('vars:', out.vars.join(' '));
