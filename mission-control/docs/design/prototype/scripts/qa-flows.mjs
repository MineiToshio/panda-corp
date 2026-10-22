// Interaction flows for the Órbita round-5 mockup. Each check prints PASS/FAIL with evidence.
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');
const BASE = `${process.env.QA_BASE ?? 'http://127.0.0.1:1988'}/index.html?demo=off`;
const browser = await chromium.launch();
const results = [];
const errors = [];
async function check(name, fn) {
  try { const info = await fn(); results.push([name, true, info]); console.log('PASS', name, info ?? ''); }
  catch (e) { results.push([name, false, e.message]); console.log('FAIL', name, e.message.split('\n').slice(0,6).join(' | ')); if (process.env.QA_DEBUG) console.log('  anims:', await page.evaluate(() => document.getAnimations().map(x => String(x.effect?.target?.className || x.effect?.target?.tagName) + ':' + (x.animationName || x.transitionProperty)).slice(0, 6)).catch(() => '?'), await page.evaluate(() => [location.hash, scrollY, document.querySelector('#tok-tip')?.hidden]).catch(() => '?')); }
  finally { await page.evaluate(() => { const d = document.getElementById('dlg'); if (d.open) d.close(); }).catch(() => {}); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
let page = await ctx.newPage(); page.setDefaultTimeout(5000);
page.on('pageerror', e => errors.push(e.message));
const hash = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(200); };
await page.goto(BASE + '#inicio');

await check('idea Documentos: curated rail opens the PRD and back to Resumen', async () => {
  await hash('#idea?idea=funko-tracker&tab=Documentos');
  const items = await page.locator('.idocs-item').count();
  await page.locator('.idocs-item', { hasText: 'PRD' }).click(); await page.waitForTimeout(150);
  const h = await page.locator('.idocs-paper h2').first().innerText();
  assert(items > 5 && /PRD/i.test(h), `${items} ${h}`); return `${items} entradas · ${h}`;
});
await check('idea Campaña: picking a room shows that phase sheet', async () => {
  await hash('#idea?idea=funko-tracker&tab=Campa%C3%B1a');
  await page.locator('.room[data-phase="3"]').click(); await page.waitForTimeout(150);
  const t = await page.locator('.phase-sheet h3').innerText();
  assert(/Arquitectura/.test(t), t); return t.replace(/\s+/g, ' ');
});
await check('propuesta digest: same bands as the app (glance, deep dive, decision board)', async () => {
  await hash('#idea?idea=funko-tracker&tab=Propuesta');
  const bands = await page.locator('.band .band-head h2').allInnerTexts();
  const rows = await page.locator('.band .brow').count();
  assert(bands.length === 3 && rows > 8, bands.join('|') + ' rows=' + rows); return bands.map(b => b.trim()).join(' / ') + ` · ${rows} filas`;
});
await check('Inicio: plugin banner first, owner items carry a copyable command', async () => {
  await hash('#inicio');
  const first = await page.evaluate(() => document.querySelector('main .pagehead').nextElementSibling?.className);
  const cmds = await page.locator('.ask-row .ask-cmd code').allInnerTexts();
  assert(/alert-banner/.test(first) && cmds.length >= 1, `${first} cmds=${cmds.length}`); return `${cmds.length} comandos · ${cmds[0]}`;
});
await check('Inicio: Detalles opens the full decision story in a modal', async () => {
  await page.locator('[data-turn="0"]').click();
  const t = await page.locator('#dlg-title').innerText();
  const c = await page.locator('#dlg .cmd code').innerText();
  await page.keyboard.press('Escape');
  assert(/decide \d{4}-\d{2}-\d{2}-\d+/.test(c), c); return `${t.slice(0, 40)} → ${c}`;
});
await check('Inicio: worktree table rows open their branch list', async () => {
  const btn = page.locator('[data-wt-repo]:not([disabled])').first();
  const name = (await btn.innerText()).trim();
  await btn.click();
  const t = await page.locator('#dlg-title').innerText();
  await page.keyboard.press('Escape');
  assert(t.includes(name.split(' ')[0]), t); return t;
});
await check('Inicio: ring explains itself on focus', async () => {
  await page.locator('.proj-card .ring[data-tip]').first().focus();
  const tip = await page.locator('.proj-card .ring[data-tip]').first().getAttribute('data-tip');
  const shown = await page.evaluate(() => getComputedStyle(document.activeElement, '::after').display);
  assert(/work orders verificadas/.test(tip) && shown === 'block', tip + ' ' + shown); return tip;
});
await check('sidebar: projects ordered by last change and collapsible (remembered)', async () => {
  const names = await page.locator('#projlist .navitem .meta span').allInnerTexts();
  await page.locator('[data-action="toggle-projects"]').click();
  const hidden = await page.locator('#projlist').isHidden();
  await page.reload(); await page.waitForTimeout(300);
  const still = await page.locator('#projlist').isHidden();
  await page.locator('[data-action="toggle-projects"]').click();
  assert(hidden && still, `${hidden} ${still}`); return names.join(' > ') + ' · plegado recordado';
});
await check('sidebar navigates to Tablero and marks it current', async () => {
  await page.getByRole('link', { name: /^Tablero/ }).first().click();
  await page.waitForTimeout(150);
  const cur = await page.locator('.sidebar [aria-current="page"]').first().innerText();
  assert(/Tablero/.test(cur), 'current=' + cur); return cur.split('\n')[0];
});
await check('board: hide-empty switch removes empty phases, is remembered, and columns share one width', async () => {
  await hash('#tablero');
  const before = await page.locator('.kanban .kcol').count();
  await page.locator('[data-action="toggle-empty"]').click(); await page.waitForTimeout(150);
  const after = await page.locator('.kanban .kcol').count();
  await page.reload(); await page.waitForTimeout(300);
  const kept = await page.locator('.kanban .kcol').count();
  const widths = await page.$$eval('.kanban .kcol', els => [...new Set(els.map(e => Math.round(e.getBoundingClientRect().width)))]);
  await page.locator('[data-action="toggle-empty"]').click(); await page.waitForTimeout(150);
  assert(after < before && kept === after && widths.length === 1, `${before}→${after}→${kept} widths=${widths}`); return `${before} → ${after} columnas, ancho ${widths[0]} px`;
});
await check('board search filters cards and shows count', async () => {
  await page.getByRole('searchbox', { name: 'Buscar ideas' }).fill('panda');
  const visible = await page.locator('.kanban [data-idea-text]:visible').count();
  const label = await page.locator('#board-count').innerText();
  assert(visible > 0 && visible < 10, 'visible=' + visible); return `${visible} visibles · "${label}"`;
});
await check('board category chip + clear resets', async () => {
  await page.getByRole('button', { name: /^web/ }).click();
  const v1 = await page.locator('.kanban [data-idea-text]:visible').count();
  await page.getByRole('button', { name: 'Limpiar' }).click();
  const v2 = await page.locator('.kanban [data-idea-text]:visible').count();
  assert(v2 === 10 && v1 < v2, `v1=${v1} v2=${v2}`); return `${v1} → ${v2}`;
});
await check('favorite toggles aria-pressed', async () => {
  const star = page.locator('[data-star]').first();
  const before = await star.getAttribute('aria-pressed');
  await star.click(); await page.waitForTimeout(100);
  const after = await page.locator('[data-star]').first().getAttribute('aria-pressed');
  assert(before !== after, `${before}→${after}`); return `${before}→${after}`;
});
await check('capture dialog opens with four commands and Escape returns focus', async () => {
  const btn = page.getByRole('button', { name: /Capturar ideas/ });
  await btn.click();
  const n = await page.locator('#dlg[open] .cmd').count();
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  assert(n === 4 && /Capturar/.test(focused), `n=${n} focus=${focused}`); return `${n} comandos, foco vuelve a "${focused}"`;
});
await check('idea card opens detail with five tabs', async () => {
  await page.getByRole('link', { name: /PandaSaga — recuerda/ }).first().click(); await page.waitForTimeout(200);
  const tabs = await page.getByRole('tab').allInnerTexts();
  assert(tabs.length === 5, tabs.join('|')); return tabs.map(t => t.replace(/\d+/, '').trim()).join(' · ');
});
await check('discard idea asks for confirmation and writes nothing', async () => {
  await page.getByRole('button', { name: /Descartar/ }).first().click();
  const title = await page.locator('#dlg-title').innerText();
  await page.locator('#dlg [data-action="confirm"]').click(); await page.waitForTimeout(100);
  const toast = await page.locator('#toast').innerText();
  assert(/Descartar idea/.test(title) && /Simulado/.test(toast), title + ' / ' + toast); return toast;
});
await check('arrow keys move between tabs', async () => {
  await page.getByRole('tab', { name: /Propuesta/ }).focus();
  await page.keyboard.press('ArrowRight');
  const f = await page.evaluate(() => document.activeElement?.textContent?.trim());
  assert(/Spec/.test(f), f); return f;
});
await check('architecture digest: Funko shows stack, integrations, env names with purpose, and ADR modals', async () => {
  await hash('#idea?idea=funko-tracker&tab=Arquitectura');
  const stack = await page.locator('#g-stack tbody tr').count();
  const integ = await page.locator('#g-services .sbul li').count();
  const env = await page.locator('#g-env .envrow').count();
  await page.locator('#g-adrs [data-modal]').first().click();
  const t = await page.locator('#dlg-title').innerText();
  await page.keyboard.press('Escape');
  assert(stack > 0 && integ > 0 && env > 0, `${stack} ${integ} ${env}`); return `${stack} capas · ${integ} integraciones · ${env} variables · ADR «${t.slice(0, 30)}…»`;
});
await check('project Cuentas tab lists the project services', async () => {
  await hash('#portfolio?project=funko-tracker&tab=Cuentas');
  const n = await page.locator('tbody tr').count();
  assert(n > 0, 'n=' + n); return `${n} servicios`;
});
await check('spec digest: FRD card modal shows the contract and jumps to its work orders', async () => {
  await hash('#idea?idea=funko-tracker&tab=Spec');
  await page.locator('.frd-cards [data-modal]').first().click();
  await page.locator('#dlg [data-frd-jump]').click(); await page.waitForTimeout(200);
  const url = await page.evaluate(() => location.hash);
  assert(/tab=Observabilidad/.test(url) && /frd=frd-01/.test(url), url); return url;
});
await check('FRD card: clicking the card body opens a toned modal', async () => {
  await hash('#idea?idea=funko-tracker&tab=Arquitectura');
  await page.locator('#g-plan .frd-cards').waitFor();
  const btns = await page.locator('.frd-cards .frdc').first().locator('button:not(.frdc-open)').count();
  await page.locator('.frd-cards .frdc').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => { document.getElementById('dlg-kicker').textContent = ''; });
  const box = await page.locator('.frd-cards .frdc').first().boundingBox();
  await page.mouse.click(box.x + box.width - 12, box.y + box.height - 10);
  const tone = await page.locator('#dlg').getAttribute('data-tone');
  const kicker = await page.locator('#dlg-kicker').innerText();
  const rows = await page.locator('#dlg .dsheet .brow').count();
  assert(btns === 0 && tone === 'violet' && /FRD-01 · Plan/i.test(kicker) && rows > 0, `${btns} ${tone} ${kicker} ${rows}`); return `${kicker} · ${rows} filas`;
});
await check('document indexes sit to the right of the reader at 1440', async () => {
  const sides = [];
  for (const [h, idx, paper] of [['#portfolio?project=funko-tracker&tab=Documentos', '#doc-index', '#paper'], ['#documentacion?page=el-pipeline', '#doc-index', '#paper'], ['#idea?idea=funko-tracker&tab=Documentos', '.idocs-rail', '.idocs-paper']]) {
    await hash(h);
    const a = await page.locator(idx).boundingBox(); const b = await page.locator(paper).boundingBox();
    sides.push(a.x > b.x + b.width - 1);
  }
  assert(sides.every(Boolean), sides.join(',')); return 'proyecto · manual · idea';
});
await check('Campaña: next/previous phase buttons move the sheet', async () => {
  await hash('#idea?idea=book-memory-without-spoilers&tab=Campaña');
  const t0 = await page.locator('#ps-title').innerText();
  await page.locator('.ps-step').last().click(); await page.waitForTimeout(150);
  const t1 = await page.locator('#ps-title').innerText();
  const sel = await page.locator('.room.is-sel').getAttribute('data-phase');
  assert(t0 !== t1 && sel === '4', `${t0} → ${t1} sel=${sel}`); return `${t0} → ${t1}`;
});
await check('FRD cards: kind tag coloured, WO bar hidden before the build starts', async () => {
  await hash('#idea?idea=book-memory-without-spoilers&tab=Spec');
  await page.locator('.frd-cards').waitFor();
  const tags = await page.locator('.frd-cards .frdc .kind-tag[data-tone]').count();
  const cards = await page.locator('.frd-cards .frdc').count();
  const bars = await page.locator('.frd-cards .stackbar').count();
  await hash('#portfolio?project=funko-tracker&tab=Arquitectura');
  await page.locator('#g-plan .frd-cards').waitFor();
  const funkoBars = await page.locator('#g-plan .frd-cards .stackbar').count();
  assert(tags === cards && bars === 0 && funkoBars > 0, `${tags}/${cards} ${bars} ${funkoBars}`); return `${cards} etiquetas · PandaSaga sin barras · Funko ${funkoBars} barras`;
});
await check('implementation plan: mosaic and "Por FRD" only once the build starts', async () => {
  await hash('#idea?idea=book-memory-without-spoilers&tab=Arquitectura');
  await page.locator('#g-plan .frd-cards').waitFor();
  const sagaMosaic = await page.locator('#g-plan .mosaic').count();
  const sagaSub = await page.locator('#g-plan .band-sub', { hasText: 'Por FRD' }).count();
  await hash('#portfolio?project=funko-tracker&tab=Arquitectura');
  await page.locator('#g-plan .mosaic').waitFor();
  const funkoSub = await page.locator('#g-plan .band-sub', { hasText: 'Por FRD' }).count();
  assert(sagaMosaic === 0 && sagaSub === 0 && funkoSub === 1, `${sagaMosaic} ${sagaSub} ${funkoSub}`); return 'PandaSaga oculto · Funko visible';
});
await check('environment variables: name | purpose rows, missing ones flagged', async () => {
  await hash('#idea?idea=funko-tracker&tab=Arquitectura');
  const rows = await page.locator('#g-env .envrow').count();
  const missing = await page.locator('#g-env .env-missing').count();
  const badge = await page.locator('#g-env .band-note .chip').innerText();
  const expected = await page.evaluate(() => window.MC_SNAPSHOT.projects.find(p => p.id === 'funko-tracker').envVars.length);
  assert(rows === expected && (missing ? badge.includes(String(missing)) : /Todas descritas/.test(badge)), `${rows}/${expected} ${missing} ${badge}`); return `${rows} filas · ${badge}`;
});
await check('project picker search + switch keeps tab', async () => {
  await hash('#portfolio?project=pandasaga&tab=Arquitectura');
  await page.getByRole('button', { name: /Cambiar proyecto/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar proyecto' }).fill('funko');
  const visible = await page.locator('[data-project-match]:visible').count();
  await page.locator('[data-project-match]:visible').first().click(); await page.waitForTimeout(200);
  const url = await page.evaluate(() => location.hash);
  assert(visible === 1 && /funko-tracker/.test(url) && /Arquitectura/.test(url), `v=${visible} ${url}`); return url;
});
await check('model: select entity highlights relations, second click clears', async () => {
  await hash('#portfolio?project=pandasaga&tab=Arquitectura&model=Diagrama');
  await page.waitForTimeout(300);
  const btn = page.locator('[data-select-entity="user"], [data-select-entity]').first();
  await btn.click(); await page.waitForTimeout(100);
  const on = await page.locator('.links path.on').count(); const dim = await page.locator('.entity.dim').count();
  await page.locator('[data-select-entity]').first().click(); await page.waitForTimeout(100);
  const after = await page.locator('.links path.on').count();
  assert(on > 0 && dim > 0 && after === 0, `on=${on} dim=${dim} after=${after}`); return `${on} relaciones resaltadas, ${dim} atenuadas, limpieza ok`;
});
await check('model zoom out + fit change label', async () => {
  await page.getByRole('button', { name: 'Alejar' }).click();
  const l1 = await page.locator('#zoom-label').innerText();
  await page.getByRole('button', { name: 'Ajustar a la vista' }).click();
  const l2 = await page.locator('#zoom-label').innerText();
  assert(l1 === '85%' && l2 !== '85%', l1 + ' ' + l2); return `${l1} → ${l2}`;
});
await check('schema view: one entity open at a time', async () => {
  await hash('#portfolio?project=pandasaga&tab=Arquitectura&model=Esquema');
  const det = page.locator('details[data-schema]');
  await det.nth(2).locator('summary').click(); await page.waitForTimeout(100);
  const open = await page.locator('details[data-schema][open]').count();
  assert(open === 1, 'open=' + open); return `${await det.count()} entidades, 1 abierta`;
});
await check('work orders: state tile filters, FRD view lists only that state', async () => {
  await hash('#portfolio?project=mission-control&tab=Work+orders');
  await page.locator('[data-state-filter="review"]').click(); await page.waitForTimeout(150);
  const rows = await page.locator('.worow').count();
  assert(rows === 1, 'rows=' + rows); return `En revisión → ${rows} fila`;
});
await check('work orders: kanban shows 8 and expands verified', async () => {
  await hash('#portfolio?project=mission-control&tab=Work+orders&view=tablero');
  const before = await page.locator('.wocard').count();
  await page.getByRole('button', { name: /Mostrar 101 más/ }).click(); await page.waitForTimeout(100);
  const after = await page.locator('.wocard').count();
  assert(after > before, `${before}→${after}`); return `${before} → ${after}`;
});
await check('work order detail: dependencies navigate', async () => {
  await hash('#portfolio?project=mission-control&tab=Work+orders&wo=WO-02-014');
  const dep = page.locator('.wo-detail-grid [data-wo]').first();
  const id = (await dep.innerText()).trim();
  await dep.click(); await page.waitForTimeout(150);
  const url = await page.evaluate(() => location.hash);
  assert(url.includes('wo=' + id), url); return `→ ${id}`;
});
await check('documents: search narrows index and opening a doc updates URL', async () => {
  await hash('#portfolio?project=pandasaga&tab=Documentos');
  await page.getByRole('searchbox', { name: 'Buscar documento' }).fill('blueprint');
  const n = await page.locator('.ditem:visible').count();
  await page.locator('.ditem:visible').first().click(); await page.waitForTimeout(150);
  const url = await page.evaluate(() => location.hash);
  const path = await page.locator('.paper-head .path').innerText();
  assert(n > 0 && /doc=/.test(url) && /blueprint/.test(path), `n=${n} ${path}`); return `${n} coincidencias → ${path}`;
});
await check('relative link inside a document opens the target document', async () => {
  await hash('#portfolio?project=pandasaga&tab=Documentos');
  const link = page.locator('.md a[data-doc-rel-path]').first();
  const cnt = await page.locator('.md a[data-doc-rel-path]').count();
  if (!cnt) return 'sin enlaces relativos en el PRD (omitido)';
  const target = await link.getAttribute('data-doc-rel-path');
  await link.click(); await page.waitForTimeout(200);
  const path = await page.locator('.paper-head .path').innerText();
  return `${target} → ${path}`;
});
await check('changes: open detail dialog with targeted command', async () => {
  await hash('#portfolio?project=personal-page-v2&tab=Cambios');
  await page.locator('[data-change]').first().click();
  const cmdText = await page.locator('#dlg[open] .cmd code').first().innerText().catch(() => '');
  await page.keyboard.press('Escape');
  assert(/implement change:/.test(cmdText), cmdText); return cmdText;
});
await check('observability: the work-order section is now Observabilidad (old links still land there)', async () => {
  await hash('#portfolio?project=mission-control&tab=Observabilidad');
  const rows = await page.locator('.worow').count();
  const label = await page.locator('[role="tab"][aria-selected="true"]').innerText();
  const tabs = await page.locator('[role="tab"]').allInnerTexts();
  await hash('#portfolio?project=mission-control&tab=Work+orders');
  const legacy = await page.locator('[role="tab"][aria-selected="true"]').innerText();
  const order = tabs.map(t => t.replace(/\s*\d+$/, '').trim());
  assert(rows > 0 && /Observabilidad/.test(label) && /Observabilidad/.test(legacy) && order.indexOf('Cuentas') === order.indexOf('Arquitectura') + 1 && !order.includes('Work orders'), `${rows} ${label} ${legacy} ${order.join(',')}`);
  return order.join(' · ');
});
await check('observability: dependency trace refocuses', async () => {
  await hash('#portfolio?project=mission-control&tab=Observabilidad&view=deps&dag=wo');
  const node = page.locator('.dag-node').nth(3);
  const id = (await node.locator('.dag-id').innerText()).trim();
  await node.click(); await page.waitForTimeout(150);
  const focus = await page.locator('.dag-side .dag-focus b.mono').innerText();
  assert(focus === id, focus + ' vs ' + id); return `foco → ${focus}`;
});
await check('commands: build mode persists and changes the command', async () => {
  await hash('#portfolio?project=mission-control&tab=Comandos');
  await page.locator('[data-mode="powerful"]').click();
  const c = await page.locator('#mode-cmd code').innerText();
  await page.reload(); await page.waitForTimeout(300);
  const pressed = await page.locator('[data-mode="powerful"]').getAttribute('aria-pressed');
  assert(c === '/pandacorp:implement powerful' && pressed === 'true', c + ' ' + pressed); return c + ' (recordado)';
});
await check('commands: target select builds scoped command', async () => {
  await page.locator('#cmd-target').selectOption({ index: 1 }); await page.waitForTimeout(150);
  const c = await page.locator('.card:has(#cmd-target) code').innerText();
  assert(/implement FRD-/.test(c), c); return c;
});
await check('copy button writes to clipboard', async () => {
  await page.locator('[data-copy]').first().click(); await page.waitForTimeout(100);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert(clip.startsWith('/pandacorp:'), clip); return clip;
});
await check('proposals: backlog priority filter', async () => {
  await hash('#propuestas?tab=Backlog');
  await page.locator('[data-bfilter="pri"][data-val="p0"]').click(); await page.waitForTimeout(100);
  const chips = await page.locator('.card:nth-of-type(2) .lrow .chip').allInnerTexts();
  const rows = await page.locator('[data-backlog]').count();
  assert(rows > 0, 'rows=' + rows); return `${rows} filas con P0`;
});
await check('proposals: backlog item dialog has targeted command', async () => {
  await page.locator('[data-backlog]').first().click();
  const c = await page.locator('#dlg[open] .cmd code').first().innerText().catch(() => '');
  await page.keyboard.press('Escape');
  assert(/implement-backlog BL-/.test(c) || c === '', c); return c || 'ítem cerrado (sin comando)';
});
await check('proposals: lesson dialog opens', async () => {
  await hash('#propuestas?tab=Memoria');
  await page.locator('[data-lesson]').first().click();
  const t = await page.locator('#dlg-title').innerText();
  await page.keyboard.press('Escape');
  assert(/LESSON-/.test(t), t); return t;
});
await check('proposals: Resumen lists what needs the owner, each with one command', async () => {
  await hash('#propuestas');
  const rows = await page.locator('.pa-row').count();
  const cmds = await page.locator('.pa-row .cmd code').allInnerTexts();
  const badge = await page.locator('.navitem[href="#propuestas"] .count').innerText().catch(() => '');
  assert(rows > 0 && cmds.length === rows && badge === String(rows) && cmds.every(c => c.startsWith('/pandacorp:')), `${rows} ${cmds.length} ${badge}`); return `${rows} acciones · ${cmds.join(' | ')}`;
});
await check('proposals: backlog area filter narrows the list and merges same-name areas', async () => {
  await hash('#propuestas?tab=Backlog');
  const names = await page.locator('.area-bar .area-name').allInnerTexts();
  const all = await page.locator('[data-backlog]').count();
  await page.locator('.area-bar').first().click(); await page.waitForTimeout(100);
  const some = await page.locator('[data-backlog]').count();
  await page.locator('[data-action="backlog-clear"]').click(); await page.waitForTimeout(100);
  assert(new Set(names).size === names.length && some > 0 && some < all, `${names.length} ${all} ${some}`); return `${names[0]}: ${all} → ${some}`;
});
await check('achievements: category filter reduces trophies', async () => {
  await hash('#logros?tab=Trofeos');
  const all = await page.locator('[data-trophy]').count();
  await page.locator('[data-trophy-cat="Speed"]').click(); await page.waitForTimeout(100);
  const sec = await page.locator('[data-trophy]').count();
  await page.locator('[data-trophy-cat=""]').click(); await page.waitForTimeout(100);
  assert(sec < all && sec > 0, `${all}→${sec}`); return `${all} → ${sec} de velocidad`;
});
await check('achievements: missions by saga with a spotlight; stats charts; ranks by era', async () => {
  await hash('#logros?tab=Misiones');
  const spot = await page.locator('.mcard.spot').count();
  const sagas = await page.locator('.saga').count();
  const cards = await page.locator('.mgrid .mcard').count();
  await hash('#logros?tab=Estad%C3%ADsticas');
  const radar = await page.locator('svg.radar polygon.r-data').count();
  const cols = await page.locator('.cols .col').count();
  const line = await page.locator('.linechart circle').count();
  await hash('#logros?tab=Rangos');
  const eras = await page.locator('.era').count();
  const current = await page.locator('.rank.current').count();
  const ranks = await page.locator('.rank').count();
  const far = await page.locator('details.era.far:not([open])').count();
  await hash('#logros');
  const sumCards = await page.locator('[role=tabpanel] .grid-2 > .stack').nth(1).locator(':scope > .card').count();
  assert(spot === 1 && sagas === 5 && cards === 19 && radar === 1 && cols > 0 && line > 0 && eras === 6 && current === 1 && ranks === 40 && far === 3 && sumCards === 3, `${spot} ${sagas} ${cards} ${radar} ${cols} ${line} ${eras} ${current} ${ranks} ${far} ${sumCards}`);
  return `${cards} misiones en ${sagas} sagas · radar + ${cols} columnas + línea · ${ranks} rangos en ${eras} eras`;
});
await check('achievements: reachable trophies, honest no-data stats, last achievement and its notice', async () => {
  await hash('#logros?tab=Trofeos');
  const near = await page.locator('.tcard.near').count();
  const nearCats = new Set(await page.locator('.tcard.near .trar').allInnerTexts()).size;
  await hash('#logros?tab=Misiones');
  const firstIdle = await page.evaluate(() => [...document.querySelectorAll('.mgrid')].every(g => { const c = [...g.querySelectorAll('.mcard')]; const i = c.findIndex(x => x.classList.contains('idle')); return i < 0 || c.slice(i).every(x => x.classList.contains('idle')); }));
  await hash('#logros?tab=Estad%C3%ADsticas');
  const nodata = await page.locator('.ledger li.nodata').count();
  await hash('#inicio');
  const last = await page.locator('.last-ach b').innerText();
  await page.goto(BASE + '&achievement=preview#inicio'); await page.waitForTimeout(400);
  const toast = await page.locator('.ach-toast b').innerText();
  await page.locator('.ach-toast [aria-label="Cerrar aviso"]').click();
  const gone = await page.locator('.ach-toast').count();
  await page.goto(BASE + '#inicio'); await page.waitForTimeout(300);
  assert(near === 6 && nearCats === 6 && firstIdle && nodata > 0 && last && toast === last && gone === 0, `${near} ${nearCats} ${firstIdle} ${nodata} ${last} ${toast} ${gone}`);
  return `${near} alcanzables · ${nodata} «sin datos aún» · último: ${last}`;
});
await check('Documentación: home routes in, full-text search finds page content, reader shows crumbs and tutorial steps', async () => {
  await hash('#documentacion');
  const steps = await page.locator('.docs-steps li').count();
  const groups = await page.locator('.docs-group').count();
  await page.locator('#manual-search').fill('worktree'); await page.waitForTimeout(250);
  const hits = await page.locator('main .lrow').count();
  await page.locator('#manual-search').fill(''); await page.waitForTimeout(200);
  await page.locator('.docs-steps a').first().click(); await page.waitForTimeout(200);
  const crumbs = await page.locator('.docs-crumbs').innerText();
  const step = await page.locator('.paper-head .path').innerText();
  const progress = await page.locator('.docs-progress span').count();
  assert(steps >= 2 && groups >= 4 && hits > 0 && /Documentación/.test(crumbs) && /Paso 1 de/.test(step) && progress === steps, `${steps} ${groups} ${hits} ${crumbs} ${step} ${progress}`);
  return `${steps} pasos · ${groups} grupos · «worktree» → ${hits} páginas · ${step}`;
});
await check('Configuración: hub with one search across catalogs, facet filters on standards, copy on skill rows', async () => {
  await hash('#configuracion');
  const tiles = await page.locator('.cfg-tile').count();
  await page.locator('#cfg-search').fill('review'); await page.waitForTimeout(250);
  const kinds = new Set(await page.locator('main .lrow .chip').allInnerTexts());
  await page.locator('#cfg-search').fill(''); await page.waitForTimeout(200);
  await hash('#configuracion?tab=Est%C3%A1ndares');
  const all = await page.locator('main [data-standard]').count();
  await page.locator('[data-cfg-sev="MUST"]').click(); await page.waitForTimeout(150);
  const must = await page.locator('main [data-standard]').count();
  await hash('#configuracion?tab=Habilidades');
  const copies = await page.locator('main .cfg-row .copy-text[data-copy]').count();
  assert(tiles === 4 && kinds.size >= 2 && must > 0 && must < all && copies > 0, `${tiles} ${[...kinds]} ${all} ${must} ${copies}`);
  return `4 catálogos · «review» en ${[...kinds].join(', ')} · ${all} → ${must} obligatorios · ${copies} comandos copiables`;
});
await check('manual: next link advances page', async () => {
  await hash('#documentacion?page=el-pipeline');
  const first = await page.locator('.ditem[aria-current="page"]').innerText();
  await page.getByRole('link', { name: /Siguiente/ }).click(); await page.waitForTimeout(150);
  const second = await page.locator('.ditem[aria-current="page"]').innerText();
  assert(first !== second, first + ' = ' + second); return `${first.trim()} → ${second.trim()}`;
});
await check('configuration: rule search filters', async () => {
  await hash('#configuracion?tab=Reglas+de+decisi%C3%B3n');
  await page.getByRole('searchbox', { name: 'Buscar regla' }).fill('dependency');
  await page.waitForTimeout(150);
  const n = await page.locator('#rule-list details').count();
  assert(n > 0 && n < 134, 'n=' + n); return `${n} reglas`;
});
await check('configuration: agent dialog links its skills', async () => {
  await hash('#configuracion?tab=Agentes');
  await page.locator('[data-agent="architect"]').first().click();
  const t = await page.locator('#dlg-title').innerText();
  const skills = await page.locator('#dlg [data-skill]').count();
  await page.keyboard.press('Escape');
  return `${t}: ${skills} skills enlazadas`;
});
await check('project Resumen: verdict, tiles, upgrade notice only when behind, engine logs hidden', async () => {
  await hash('#portfolio?project=pandasaga');
  const upSaga = await page.locator('.notice.upgrade').count();
  const cmdSaga = await page.locator('.notice.upgrade .cmd code').innerText();
  await hash('#portfolio?project=funko-tracker');
  const upFunko = await page.locator('.notice.upgrade').count();
  const tiles = (await page.locator('.hero-stats .st small').allInnerTexts()).filter(t => /último movimiento/.test(t)).length * 4;
  const verdict = await page.locator('#fr-h').innerText();
  const decisions = await page.locator('.lrow[data-decision]').allInnerTexts();
  const noisy = decisions.some(d => /^T?\d{1,2}:\d{2}/.test(d.trim()));
  const ctx = await page.getByText('Contexto completo del producto').count();
  assert(upSaga === 1 && cmdSaga === '/pandacorp:upgrade' && upFunko === 0 && tiles === 4 && /work orders verificadas/.test(verdict) && !noisy && ctx === 0, `${upSaga} ${upFunko} ${tiles} ${noisy} ${ctx}`);
  return verdict.slice(0, 70) + '…';
});
await check('Cuentas: login user, service link opens a new tab, separated environment chips', async () => {
  await hash('#portfolio?project=funko-tracker&tab=Cuentas');
  const link = page.locator('a.acc-name').first();
  const target = await link.getAttribute('target');
  const hrefv = await link.getAttribute('href');
  const users = await page.locator('button.copy-text[data-copy]').count();
  const icons = await page.locator('.acc-table td:first-child svg.i').count() + await page.locator('.acc-table td:nth-child(3) .iconbtn').count();
  const states = await page.locator('.acc-table tbody tr .state-dot').allInnerTexts();
  const rank = t => /Configurado|Activo/.test(t) ? 0 : /Inactivo/.test(t) ? 2 : 1;
  const sorted = states.every((t, i) => i === 0 || rank(states[i - 1]) <= rank(t));
  const gap = await page.locator('.env-chips').first().evaluate(e => getComputedStyle(e).gap);
  assert(target === '_blank' && /^https:/.test(hrefv) && users > 0 && gap !== 'normal' && gap !== '0px' && sorted && icons === (await page.locator('.acc-table td:first-child .acc-name svg.i').count()), `${target} ${hrefv} ${users} ${gap} ${sorted} ${icons}`);
  return `${users} usuarios · ${hrefv}`;
});
await check('Resumen + La Fragua: real counts, scene modes, simulation moves tokens, Panel switch', async () => {
  await hash('#portfolio?project=funko-tracker');
  const counts = (await page.locator('.fr-count').allInnerTexts()).map(Number);
  const total = await page.evaluate(() => window.MC_SNAPSHOT.projects.find(p => p.id === 'funko-tracker').orders.length);
  const noParty = await page.locator('[role="tab"]', { hasText: 'Party' }).count();
  // The scene-mode picker is demo-only (DR-061): hidden with ?demo=off, exercised here with the demo layer on.
  const hiddenOff = await page.locator('.demo-inline').isHidden();
  await page.evaluate(() => { delete document.documentElement.dataset.demo; });
  await page.locator('[data-scene-mode="off"]').click(); await page.waitForTimeout(150);
  const idle = await page.locator('.fragua.is-idle').count();
  await page.locator('[data-scene-mode="sim"]').click(); await page.waitForTimeout(3200);
  const after = (await page.locator('.fr-count').allInnerTexts()).map(Number);
  const panel = 1 - await page.locator('.seg button', { hasText: 'Panel' }).count();
  const scene = 0;
  await page.evaluate(() => { document.documentElement.dataset.demo = 'off'; });
  await hash('#portfolio?project=funko-tracker');
  await page.locator('.token[data-wo]').first().click(); await page.waitForTimeout(150);
  const url = await page.evaluate(() => location.hash);
  assert(hiddenOff && counts.reduce((a, b) => a + b, 0) === total && noParty === 0 && idle === 1 && after.join() !== counts.join() && panel === 1 && scene === 0 && /wo=WO-/.test(url), `${counts} ${total} ${noParty} ${idle} ${after} ${panel} ${scene} ${url}`);
  return `${counts.join('/')} → simulación ${after.join('/')}`;
});
await check('Observabilidad: dependency graph lays out every order and focusing lights its chain', async () => {
  await hash('#portfolio?project=funko-tracker&tab=Observabilidad&view=deps');
  const boxes = await page.locator('.fdag-box').count();
  const links = await page.locator('.fdag-link').count();
  const timeline = await page.locator('.seg button', { hasText: 'Línea de tiempo' }).count();
  await page.locator('.seg button', { hasText: 'Por work order' }).click(); await page.waitForTimeout(150);
  const nodes = await page.locator('.dag-node').count();
  const total = await page.evaluate(() => window.MC_SNAPSHOT.projects.find(p => p.id === 'funko-tracker').orders.length);
  await page.locator('.dag-node[data-focus="WO-05-001"]').click(); await page.waitForTimeout(150);
  const lit = await page.locator('.dag-edge.on').count();
  const dim = await page.locator('.dag-node.dim').count();
  const side = await page.locator('.dag-side').count();
  assert(boxes === 8 && links > 0 && timeline === 0 && nodes === total && lit > 0 && dim > 0 && side === 1, `${boxes} ${links} ${timeline} ${nodes}/${total} ${lit} ${dim} ${side}`);
  return `${boxes} FRDs · ${links} enlaces entre FRDs · ${nodes} nodos · ${lit} aristas encendidas`;
});
await check('Portfolio overview: cards by default, list on toggle, never both', async () => {
  await hash('#portfolio');
  const cards1 = await page.locator('main .proj-cards').count();
  const table1 = await page.locator('main table.t').count();
  await page.locator('main .seg button', { hasText: 'Lista' }).click(); await page.waitForTimeout(150);
  const cards2 = await page.locator('main .proj-cards').count();
  const table2 = await page.locator('main table.t').count();
  const url = await page.evaluate(() => location.hash);
  assert(cards1 === 1 && table1 === 0 && cards2 === 0 && table2 === 1 && /view=lista/.test(url), `${cards1} ${table1} ${cards2} ${table2} ${url}`);
  return 'tarjetas → lista';
});
await check('sidebar: collapses to icons, hover floats it open without pushing, choice survives reload', async () => {
  await hash('#inicio');
  const mainX0 = await page.locator('.main').evaluate(e => e.getBoundingClientRect().left);
  await page.locator('[data-action="toggle-sidebar"]').click(); await page.mouse.move(900, 450); await page.waitForTimeout(400);
  const w1 = await page.locator('#sidebar').evaluate(e => e.getBoundingClientRect().width);
  const mainX1 = await page.locator('.main').evaluate(e => e.getBoundingClientRect().left);
  const lblHidden = await page.locator('#sidebar .navitem .lbl').first().isHidden();
  await page.mouse.move(30, 300); await page.waitForTimeout(400);
  const w2 = await page.locator('#sidebar').evaluate(e => e.getBoundingClientRect().width);
  const mainX2 = await page.locator('.main').evaluate(e => e.getBoundingClientRect().left);
  await page.reload(); await page.mouse.move(900, 450); await page.waitForTimeout(500);
  const persisted = await page.locator('#app').getAttribute('data-sidebar');
  const font = await page.locator('h1').evaluate(e => getComputedStyle(e).fontFamily);
  await page.locator('[data-action="toggle-sidebar"]').click({ force: true }); await page.mouse.move(900, 450); await page.waitForTimeout(300);
  const back = await page.locator('#app').getAttribute('data-sidebar');
  assert(w1 <= 64 && lblHidden && mainX1 < mainX0 && w2 > 200 && mainX2 === mainX1 && persisted === 'collapsed' && back === 'expanded' && /Space Grotesk/.test(font), `${w1} ${lblHidden} ${mainX0}/${mainX1}/${mainX2} ${w2} ${persisted} ${back} ${font}`);
  return `${Math.round(w1)} px → ${Math.round(w2)} px al pasar el mouse · contenido fijo en ${mainX1}px`;
});
await check('La Fragua tokens: two-line codes, a hover card, equal plates, empty states, courier only over busy stations', async () => {
  await hash('#portfolio?project=funko-tracker');
  const tok = page.locator('.token[data-wo]').first();
  const id = await tok.getAttribute('data-wo');
  const txt = (await tok.innerText()).replace(/\s+/g, ' ').trim();
  await page.mouse.move(5, 5); await tok.scrollIntoViewIfNeeded(); await tok.hover(); await page.waitForTimeout(150);
  const tip = await page.locator('#tok-tip:not([hidden]) b').innerText();
  const plates = new Set(await page.locator('.fr-plate').evaluateAll(e => e.map(x => Math.round(x.getBoundingClientRect().height))));
  const empties = await page.locator('.tokens.is-empty .fr-empty-msg').count();
  const counts = (await page.locator('.fr-count').allInnerTexts()).map(Number);
  // The courier's track spans the busy stretch (it walks by transform across 100 % of it).
  const route = await page.locator('.fr-courier').evaluate(e => [e.style.left, e.style.right]).catch(() => null);
  const busy = counts.map((n, i) => (n ? i : -1)).filter(i => i >= 0);
  const want = busy.length > 1 ? [`${(busy[0] + 0.5) * 25}%`, `${(3 - busy.at(-1) + 0.5) * 25}%`] : null;
  assert(txt === id.replace(/^WO-(\d+)-(\d+)$/, '$1 $2') && tip === id && plates.size === 1 && empties === counts.filter(n => !n).length && JSON.stringify(route) === JSON.stringify(want), `${txt} ${tip} ${[...plates]} ${empties} ${route} ${want}`);
  return `«${txt}» → ${tip} · placas ${[...plates][0]}px · mensajero ${busy[0] + 1}→${busy.at(-1) + 1}`;
});
await check('Observabilidad Por FRD: collapsed by default, one toggle expands and collapses all, state chips aligned', async () => {
  await hash('#portfolio?project=funko-tracker&tab=Observabilidad');
  if (await page.locator('details.frd-row[open]').count()) await page.locator('[data-action="frd-toggle-all"]').click();
  const closed = await page.locator('details.frd-row[open]').count();
  await page.locator('[data-action="frd-toggle-all"]').click(); await page.waitForTimeout(150);
  const opened = await page.locator('details.frd-row[open]').count();
  const total = await page.locator('details.frd-row').count();
  const edges = new Set(await page.locator('.worow > .chip').evaluateAll(e => e.map(x => Math.round(x.getBoundingClientRect().right))));
  await page.locator('[data-action="frd-toggle-all"]').click(); await page.waitForTimeout(150);
  const again = await page.locator('details.frd-row[open]').count();
  assert(closed === 0 && opened === total && edges.size === 1 && again === 0, `${closed} ${opened}/${total} ${[...edges]} ${again}`);
  return `0 → ${total} → 0 abiertos · chips alineados a ${[...edges][0]}px`;
});
await check('screen change scrolls to top', async () => {
  await hash('#portfolio?project=mission-control&tab=Work+orders');
  if (!(await page.locator('details.frd-row[open]').count())) await page.locator('[data-action="frd-toggle-all"]').click();
  await page.evaluate(() => scrollTo(0, 1500));
  await page.locator('.worow:visible').nth(5).click(); await page.waitForTimeout(200);
  const y = await page.evaluate(() => scrollY);
  assert(y === 0, 'y=' + y); return 'scrollY=0';
});
await check('unknown idea shows a not-found state, not another idea', async () => {
  await hash('#idea?idea=does-not-exist');
  const h = await page.locator('main .empty strong').innerText();
  assert(/no existe/.test(h), h); return h;
});
await check('work-order summary reads in order with its current step', async () => {
  await page.evaluate(() => { location.hash = '#portfolio?project=mission-control&tab=Observabilidad&wo=WO-02-014'; }); await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    now: document.querySelector('.wo-steps [aria-current="step"]')?.textContent.trim(),
    titles: [...document.querySelectorAll('.wo-story .card-head h2')].map(h => h.textContent.trim()),
    crit: document.querySelectorAll('.crit li').length,
    files: document.querySelectorAll('.wo-files li').length,
  }));
  const order = ['De qué trata', 'Qué cambia', 'Cómo se comprueba', 'Qué se construyó'];
  assert(r.now === 'En revisión' && order.every((t, i) => r.titles[i] === t) && r.crit === 3 && r.files === 1, JSON.stringify(r));
  return `paso ${r.now} · ${r.titles.length} secciones · ${r.crit} criterios`;
});
await check('unknown work order shows a not-found state', async () => {
  await hash('#portfolio?project=mission-control&tab=Work+orders&wo=WO-99-999');
  const h = await page.locator('main .empty strong').innerText();
  assert(/no está publicada/.test(h), h); return h;
});
await check('shipped idea offers no discard', async () => {
  await hash('#idea?idea=personal-page-v2');
  const n = await page.locator('[data-action="discard-idea"]').count();
  assert(n === 0, 'n=' + n); return 'sin botón Descartar';
});
await check('cancelling a discard returns to the change detail', async () => {
  await hash('#portfolio?project=personal-page-v2&tab=Cambios');
  await page.locator('.lrow[data-change]').filter({ hasText: 'Borrador' }).first().click();
  const t1 = await page.locator('#dlg-title').innerText();
  await page.locator('#dlg [data-action="discard-change"]').click();
  await page.locator('#dlg [data-action="close-dialog"]').click();
  const t2 = await page.locator('#dlg-title').innerText();
  assert(t1 === t2, t1 + ' / ' + t2); return 'vuelve a «' + t2.slice(0, 40) + '»';
});
await check('tab overflow arrow reveals hidden tabs at 1280', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await hash('#portfolio?project=mission-control&tab=Resumen');
  const arrow = page.locator('.tabs-arrow.right');
  const vis = await arrow.isVisible();
  if (!vis) return 'todas las pestañas caben';
  await arrow.click(); await page.waitForTimeout(400);
  const ok = await page.evaluate(() => { const t = [...document.querySelectorAll('[role=tab]')].pop().getBoundingClientRect(); const s = document.querySelector('.tabs').getBoundingClientRect(); return t.right <= s.right + 1; });
  await page.setViewportSize({ width: 1440, height: 900 });
  assert(ok, 'last tab still hidden'); return 'Comandos visible tras la flecha';
});
await ctx.close();

ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
page = await ctx.newPage(); page.setDefaultTimeout(5000);
page.on('pageerror', e => errors.push(e.message));
await page.goto(BASE + '#inicio');
await check('phone: drawer opens, Escape closes and returns focus', async () => {
  const inertBefore = await page.locator('#sidebar').getAttribute('inert');
  await page.getByRole('button', { name: 'Abrir menú' }).click(); await page.waitForTimeout(250);
  const open = await page.locator('#sidebar').getAttribute('data-open');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  const focus = await page.evaluate(() => document.activeElement?.id);
  assert(inertBefore !== null && open === 'true' && focus === 'menu', `${inertBefore} ${open} ${focus}`); return 'inert cerrado · abre · Esc devuelve foco';
});
await check('phone: bottom nav reaches Portfolio', async () => {
  await page.locator('.bottomnav a[href="#portfolio"]').click(); await page.waitForTimeout(150);
  return await page.evaluate(() => location.hash);
});
await check('phone: document index toggles', async () => {
  await page.evaluate(() => { location.hash = '#portfolio?project=pandasaga&tab=Documentos'; }); await page.waitForTimeout(200);
  const hidden = await page.locator('#doc-index').isVisible();
  await page.getByRole('button', { name: /Elegir documento/ }).click();
  const shown = await page.locator('#doc-index').isVisible();
  assert(!hidden && shown, `${hidden} ${shown}`); return 'índice oculto → visible';
});
await check('phone: selected tab is visible in its strip', async () => {
  await page.evaluate(() => { location.hash = '#portfolio?project=mission-control&tab=Comandos'; }); await page.waitForTimeout(250);
  const r = await page.evaluate(() => { const t = document.querySelector('[role=tab][aria-selected=true]').getBoundingClientRect(); const s = document.querySelector('.tabs').getBoundingClientRect(); return t.left >= s.left - 1 && t.right <= s.right + 1; });
  assert(r, 'not visible'); return 'Comandos visible';
});
await check('phone: drawer traps Tab focus', async () => {
  await page.evaluate(() => { location.hash = '#inicio'; }); await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Abrir menú' }).click(); await page.waitForTimeout(250);
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => document.getElementById('sidebar').contains(document.activeElement));
  await page.keyboard.press('Escape');
  assert(inside, 'focus escaped'); return '25 Tab dentro del menú';
});
await check('phone: phase selector jumps to a column and follows the swipe', async () => {
  await page.evaluate(() => { location.hash = '#tablero'; }); await page.waitForTimeout(250);
  await page.locator('[data-phase-jump="architecture"]').click(); await page.waitForTimeout(700);
  const cur = await page.locator('[data-phase-jump][aria-current="true"]').getAttribute('data-phase-jump');
  const page_sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert(cur === 'architecture' && page_sw, `${cur} ${page_sw}`); return 'Arquitectura activa, sin scroll de página';
});
await check('phone: dependency map becomes a list and a work order opens from it', async () => {
  await page.evaluate(() => { location.hash = '#portfolio?project=mission-control&tab=Observabilidad&view=deps'; }); await page.waitForTimeout(300);
  const canvasHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.dag')).display === 'none');
  const first = page.locator('.dl-frd > summary').first();
  await first.click(); await page.waitForTimeout(150);
  const rel = await page.locator('.dl-frd[open] .dl-rel').count();
  await page.locator('.dl-frd[open] [data-wo]').first().click(); await page.waitForTimeout(300);
  const opened = await page.evaluate(() => /[?&]wo=/.test(location.hash) || !!document.querySelector('dialog[open]'));
  assert(canvasHidden && rel === 2 && opened, `canvas oculto ${canvasHidden} · relaciones ${rel} · abre ${opened}`); return 'lista · depende de / desbloquea · abre la orden';
});
await check('phone: La Fragua shows one station per row and tables become cards', async () => {
  await page.evaluate(() => { location.hash = '#portfolio?project=mission-control'; }); await page.waitForTimeout(300);
  const tops = await page.evaluate(() => [...document.querySelectorAll('.fr-station')].map(e => Math.round(e.getBoundingClientRect().top)));
  await page.evaluate(() => { location.hash = '#portfolio?project=funko-tracker&tab=Cuentas'; }); await page.waitForTimeout(300);
  const cards = await page.evaluate(() => { const t = document.querySelector('.acc-table'); return getComputedStyle(t.querySelector('thead')).display === 'none' && document.documentElement.scrollWidth <= innerWidth; });
  const rows = new Set(tops).size === tops.length && tops.length === 4;
  assert(rows && cards, `filas ${tops.join(',')} · tarjetas ${cards}`); return '4 estaciones en 4 filas · Cuentas en tarjetas';
});
await ctx.close();
await browser.close();
console.log(`\n${results.filter(r => r[1]).length}/${results.length} pass · page errors: ${errors.length ? errors.join(' | ') : 0}`);
