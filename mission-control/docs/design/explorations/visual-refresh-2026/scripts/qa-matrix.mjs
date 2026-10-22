// QA sweep for the Órbita round-5 mockup: screenshots + console errors + overflow + axe per state.
// Usage (from mission-control): node <this> [filter] [--shots] [--axe]
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'evidence', 'round5-shots');
const BASE = 'http://127.0.0.1:1988/index.html?demo=off';
const ROUTES = {
  inicio: '#inicio',
  tablero: '#tablero',
  idea: '#idea?idea=book-memory-without-spoilers&tab=Propuesta',
  ideaspec: '#idea?idea=book-memory-without-spoilers&tab=Spec',
  campana: '#idea?idea=book-memory-without-spoilers&tab=Campaña',
  portfolio: '#portfolio',
  resumen: '#portfolio?project=mission-control',
  spec: '#portfolio?project=pandasaga&tab=Spec',
  wo: '#portfolio?project=mission-control&tab=Work+orders',
  wokanban: '#portfolio?project=personal-page-v2&tab=Work+orders&view=tablero',
  wodetail: '#portfolio?project=mission-control&tab=Work+orders&wo=WO-02-014',
  arch: '#portfolio?project=pandasaga&tab=Arquitectura',
  archfunko: '#idea?idea=funko-tracker&tab=Arquitectura',
  specfunko: '#idea?idea=funko-tracker&tab=Spec',
  ideafunko: '#idea?idea=funko-tracker&tab=Propuesta',
  campfunko: '#idea?idea=funko-tracker&tab=Campa%C3%B1a',
  docsfunko: '#idea?idea=funko-tracker&tab=Documentos',
  cuentas: '#portfolio?project=funko-tracker&tab=Cuentas',
  schema: '#portfolio?project=pandasaga&tab=Arquitectura&model=Esquema',
  cambios: '#portfolio?project=personal-page-v2&tab=Cambios',
  scenesim: '#portfolio?project=mission-control&scene=on',
  obs: '#portfolio?project=mission-control&tab=Observabilidad&view=tablero',
  deps: '#portfolio?project=mission-control&tab=Observabilidad&view=deps',
  depswo: '#portfolio?project=mission-control&tab=Observabilidad&view=deps&dag=wo',
  resumensaga: '#portfolio?project=pandasaga',
  portfoliolist: '#portfolio?view=lista',
  scenesim: '#portfolio?project=funko-tracker&scene=sim',
  docs: '#portfolio?project=pandasaga&tab=Documentos',
  comandos: '#portfolio?project=mission-control&tab=Comandos',
  propuestas: '#propuestas',
  memoria: '#propuestas?tab=Memoria',
  backlog: '#propuestas?tab=Backlog',
  logros: '#logros',
  misiones: '#logros?tab=Misiones',
  trofeos: '#logros?tab=Trofeos',
  stats: '#logros?tab=Estad%C3%ADsticas',
  rangos: '#logros?tab=Rangos',
  manual: '#documentacion',
  manualpage: '#documentacion?page=el-pipeline',
  cfghub: '#configuracion',
  skills: '#configuracion?tab=Habilidades',
  agents: '#configuracion?tab=Agentes',
  rules: '#configuracion?tab=Reglas+de+decisi%C3%B3n',
  standards: '#configuracion?tab=Est%C3%A1ndares',
};
const args = process.argv.slice(2);
const filter = args.find(a => !a.startsWith('--'));
const shots = args.includes('--shots');
const axe = args.includes('--axe');
const widths = (args.find(a => a.startsWith('--w='))?.slice(4) || '1440,768,375').split(',').map(Number);
const themes = (args.find(a => a.startsWith('--t='))?.slice(4) || 'dark').split(',');
const full = args.includes('--full');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const theme of themes) for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 760 ? 812 : 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`${BASE}&theme=${theme}#inicio`, { waitUntil: 'load' });
  for (const [name, hash] of Object.entries(ROUTES)) {
    if (filter && !filter.split(',').includes(name)) continue;
    errors.length = 0;
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, h1: document.querySelectorAll('h1').length, title: document.title }));
    let violations = [];
    if (axe) {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      violations = r.violations.map(v => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`);
    }
    if (shots) await page.screenshot({ path: path.join(OUT, `${name}-${width}-${theme}.png`), fullPage: full });
    const row = { name, width, theme, overflow: m.sw > m.iw ? m.sw : 0, h1: m.h1, errors: [...errors], violations };
    results.push(row);
    const bad = row.overflow || row.h1 !== 1 || row.errors.length || row.violations.length;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${name.padEnd(11)} ${width} ${theme}${row.overflow ? ' overflow=' + row.overflow : ''}${row.h1 !== 1 ? ' h1=' + row.h1 : ''}${row.errors.length ? ' errors=' + row.errors.join(' ; ') : ''}${violations.length ? ' axe=' + violations.join(' ; ') : ''}`);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
const fails = results.filter(r => r.overflow || r.h1 !== 1 || r.errors.length || r.violations.length).length;
console.log(`\n${results.length} states, ${fails} with issues`);
