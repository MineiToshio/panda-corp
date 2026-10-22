import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');
const src = fs.readFileSync(new URL('./qa-matrix.mjs', import.meta.url), 'utf8');
const ROUTES = Object.fromEntries([...src.matchAll(/^\s+(\w+): '(#[^']+)',$/gm)].map(m => [m[1], m[2]]));
const b = await chromium.launch();
let bad = 0;
for (const w of [1440, 375]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.setDefaultTimeout(5000);
  await p.goto('http://127.0.0.1:1988/index.html?demo=off#inicio');
  for (const [n, h] of Object.entries(ROUTES)) {
    await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(200);
    const small = await p.evaluate(() => { const out = new Set(); const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t; while ((t = walker.nextNode())) { if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || el.closest('[hidden],.sr-only,svg')) continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11.99) out.add(`${el.tagName.toLowerCase()}.${el.className}|${fs.toFixed(1)}px|${t.textContent.trim().slice(0, 24)}`); } return [...out].slice(0, 5); });
    if (small.length) { bad++; console.log(n, w, small.join(' ; ')); }
  }
}
await b.close();
console.log('routes with small text:', bad);
