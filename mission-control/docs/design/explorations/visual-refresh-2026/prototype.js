'use strict';
/* Órbita · ronda 5 — navigable study of Mission Control.
   Reads three private, read-only local captures (projects, factory extras, rendered Manual) and never
   writes anything: every action that would change a file only explains itself or copies a command. */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/* ================= Data ================= */
const SNAP = window.MC_SNAPSHOT;
if (!SNAP?.projects?.length) {
  document.getElementById('content').innerHTML = '<p>Falta la captura local <code>data/snapshot.js</code>. Ejecuta el exportador indicado en OPEN-MOCKUP.md.</p>';
  throw new Error('Missing data/snapshot.js');
}
const EXTRAS = window.MC_EXTRAS || null;
const LIVE = window.MC_MANUAL_LIVE || null;

/* ================= Primitives ================= */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a9 9 0 1 1 17.4 0"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  cube: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 12l2 2 4-4"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-11 7"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  sparkles: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  terminal: '<path d="m4 17 6-5-6-5M12 19h8"/>',
  flag: '<path d="M5 21V4M5 4h13l-2.5 4.5L18 13H5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  maximize: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.9-4-5.7"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  loader: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
  flame: '<path d="M12 22a6 6 0 0 0 6-6c0-4-3-6-4-9-1 2-2 3-3.5 3.5C9 8 9 5 10 3 6 5 6 10 6 12v4a6 6 0 0 0 6 6z"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 15l-3-3c1-5 5.5-9 13-9 0 7.5-4 12-9 13z"/><circle cx="15" cy="9" r="1.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2s-1-1.5-1-2.5 1-2 2-2h2a4 4 0 0 0 4-4c0-4.4-4-7.5-9-7.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  panelClose: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M16 10l-2 2 2 2"/>',
  panelOpen: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M14 10l2 2-2 2"/>',
  diamond: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16M15 4l-3 16"/>',
  stairs: '<path d="M4 20h4v-4h4v-4h4V8h4"/><path d="M15 4h5v5"/>',
  factory: '<path d="M3 21V10l5 3V10l5 3V6h4l1 15z"/><path d="M3 21h18"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
const ico = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.dot}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Inline markdown (code, bold, italics, links-as-text) rendered safely after escaping. */
function inl(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}
const plain = text => String(text ?? '').replace(/`/g, '').replace(/\*\*/g, '');
const tz = 'America/Lima';
// Date-only values (YYYY-MM-DD) are calendar days, not instants: format them in UTC so they never shift a day.
const fmtDate = value => { const d = new Date(value); if (!value || Number.isNaN(+d)) return String(value || 'Sin fecha'); return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? 'UTC' : tz }).format(d); };
const fmtStamp = value => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(value)).replace(/ (\d+:\d+)\s([ap])\.\s?m\./, ' $1\u00a0$2.\u00a0m.');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const chip = (text, tone = '', extra = '') => `<span class="chip ${extra}" ${tone ? `data-tone="${tone}"` : ''}>${text}</span>`;
const dotChip = (text, tone) => chip(`<span class="dot"></span>${text}`, tone);
const illus = (text = 'Ilustrativo') => `<span class="illus" title="Composición de ejemplo: esta captura no incluye esta fuente">${ico('palette', 'sm')}${esc(text)}</span>`;
const bar = (pct, tone = 'green') => `<div class="bar" data-tone="${tone}" role="presentation"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;
const ring = (pct, tone = 'green', cls = '', tip = '') => `<div class="ring ${cls}" data-tone="${tone}" style="--p:${pct}" role="img" aria-label="${esc(tip || pct + '% completado')}" ${tip ? `data-tip="${esc(tip)}" tabindex="0"` : ''}>${pct}%</div>`;
/** A command split only at its natural seams (after ":" and spaces), never inside an id or a word. */
const cmdWbr = text => esc(text).replace(/:/g, ':<wbr>').replace(/\b([A-Z]{2,}-\d[\w-]*)/g, '<span class="nowrap">$1</span>');
const cmd = text => `<div class="cmd">${ico('terminal', 'sm')}<code>${cmdWbr(text)}</code><button type="button" class="iconbtn" data-copy="${esc(text)}" aria-label="Copiar ${esc(text)}">${ico('copy', 'sm')}</button></div>`;
const empty = (text, icon = 'inbox') => `<div class="empty">${ico(icon, 'lg')}<span>${text}</span></div>`;
function card(title, body, opts = {}) {
  const { tone = '', icon = '', action = '', id = '', cls = '', level = 2 } = opts;
  const h = `h${level}`;
  return `<section class="card ${cls}" ${tone ? `data-tone="${tone}"` : ''} ${id ? `id="${id}"` : ''}>
    ${title ? `<div class="card-head"><${h}>${icon ? `<span class="badge-icon sm">${ico(icon, 'sm')}</span>` : ''}${title}</${h}>${action}</div>` : ''}${body}</section>`;
}

/* ================= Vocabulary ================= */
const PHASES = [
  { id: 'discovered', label: 'Investigación', tone: 'teal', icon: 'search', cmd: '/pandacorp:explore · :new-idea · :discover' },
  { id: 'product', label: 'Producto', tone: 'blue', icon: 'layers', cmd: '/pandacorp:spec <idea>' },
  { id: 'design', label: 'Diseño', tone: 'pink', icon: 'palette', cmd: '/pandacorp:design' },
  { id: 'architecture', label: 'Arquitectura', tone: 'amber', icon: 'cube', cmd: '/pandacorp:architecture' },
  { id: 'implementation', label: 'Construcción', tone: 'violet', icon: 'bolt', cmd: '/pandacorp:implement' },
  { id: 'release', label: 'Lanzamiento', tone: 'green', icon: 'rocket', cmd: '/pandacorp:release' },
];
const phaseOf = id => PHASES.find(p => p.id === id) || { id, label: id || 'Sin fase', tone: 'slate', icon: 'dot' };
const STATES = {
  todo: { label: 'Planificado', tone: 'slate', icon: 'circle' },
  in_progress: { label: 'En curso', tone: 'blue', icon: 'loader' },
  review: { label: 'En revisión', tone: 'amber', icon: 'eye' },
  done: { label: 'Verificado', tone: 'green', icon: 'check' },
  fail: { label: 'Bloqueado', tone: 'coral', icon: 'alert' },
};
const stateOf = s => STATES[s] || { label: s || 'Sin estado', tone: 'slate', icon: 'dot' };
const phaseChip = id => { const p = phaseOf(id); return dotChip(p.label, p.tone); };
const stateChip = s => { const st = stateOf(s); return chip(`${ico(st.icon, 'sm')}${st.label}`, st.tone); };
const RETURN = { monetary: ['Monetaria', 'teal'], personal: ['Personal', 'violet'], mixed: ['Mixta', 'pink'] };
const returnChip = r => { const [l, t] = RETURN[r] || [r || 'Sin retorno', 'slate']; return chip(esc(l), t); };
const NAV = [
  { id: 'inicio', label: 'Inicio', mini: 'Inicio', icon: 'home', tone: 'amber' },
  { id: 'tablero', label: 'Tablero', mini: 'Tablero', icon: 'kanban', tone: 'teal' },
  { id: 'portfolio', label: 'Portafolio', mini: 'Portafolio', icon: 'folder', tone: 'blue' },
  { id: 'propuestas', label: 'Propuestas', mini: 'Propuestas', icon: 'bulb', tone: 'pink' },
  { id: 'logros', label: 'Logros', mini: 'Logros', icon: 'trophy', tone: 'gold' },
  { id: 'documentacion', label: 'Documentación', mini: 'Manual', icon: 'book', tone: 'violet' },
  { id: 'configuracion', label: 'Configuración', mini: 'Ajustes', icon: 'settings', tone: 'slate' },
];
const WS_TABS = [
  { id: 'Resumen', icon: 'gauge', tone: 'slate' },
  { id: 'Spec', icon: 'layers', tone: 'blue' },
  { id: 'Observabilidad', icon: 'activity', tone: 'green' },
  { id: 'Arquitectura', icon: 'cube', tone: 'amber' },
  { id: 'Cuentas', icon: 'users', tone: 'teal' },
  { id: 'Cambios', icon: 'branch', tone: 'pink' },
  { id: 'Documentos', icon: 'file', tone: 'teal' },
  { id: 'Comandos', icon: 'terminal', tone: 'violet' },
];
/** Older links named the work-order section "Work orders"; it is now "Observabilidad". */
const wsTab = () => (P('tab') === 'Work orders' ? 'Observabilidad' : P('tab'));
const DOC_TYPES = {
  product: { tone: 'blue', icon: 'flag', label: 'Producto' },
  research: { tone: 'teal', icon: 'search', label: 'Investigación' },
  contract: { tone: 'violet', icon: 'book', label: 'Contrato funcional' },
  design: { tone: 'pink', icon: 'palette', label: 'Diseño' },
  architecture: { tone: 'amber', icon: 'cube', label: 'Arquitectura' },
  decision: { tone: 'amber', icon: 'shield', label: 'Decisión técnica' },
  order: { tone: 'violet', icon: 'clipboard', label: 'Work order' },
  review: { tone: 'slate', icon: 'eye', label: 'Revisión' },
  rule: { tone: 'slate', icon: 'shield', label: 'Regla' },
  reference: { tone: 'slate', icon: 'file', label: 'Referencia' },
};
function docType(d) {
  const p = (d?.relPath || '').toLowerCase();
  if (/work-orders/.test(p)) return 'order';
  if (/research/.test(p)) return 'research';
  if (/\/adr\//.test(p)) return 'decision';
  if (/^docs\/reviews|review|audit|verification/.test(p)) return 'review';
  if (/^docs\/rules/.test(p)) return 'rule';
  if (/blueprint|architecture|data-model/.test(p)) return 'architecture';
  if (/fdd\.md|design|\/mocks\//.test(p)) return 'design';
  if (/\/frd\.md/.test(p)) return 'contract';
  if (/prd\.md|\/product\//.test(p)) return 'product';
  return 'reference';
}
const docTypeChip = d => { const t = DOC_TYPES[docType(d)]; return chip(`${ico(t.icon, 'sm')}${t.label}`, t.tone); };

/* ================= Derived model ================= */
function frontmatter(body) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body || '');
  const out = {};
  if (!m) return out;
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) { key = kv[1]; out[key] = kv[2].trim(); continue; }
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (key && item) { if (!Array.isArray(out[key])) out[key] = []; out[key].push(item[1].trim().replace(/^["']|["']$/g, '')); }
  }
  return out;
}
const listOf = v => (Array.isArray(v) ? v : String(v || '').replace(/^\[|\]$/g, '').split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean));
const humanize = slug => slug.replace(/^frd-\d+-/, '').replaceAll('-', ' ').replace(/^./, c => c.toUpperCase());

const PROJECTS = SNAP.projects.map(raw => {
  const p = raw;
  p.short = p.name.split(' — ')[0].replace('Pandacorp (Mission Control)', 'Mission Control');
  p.subtitle = String(p.subtitle || '').replace(/^[^\n.]{1,24}\n+/, '').trim();
  // Single-word CamelCase names (PandaSaga, PandaCast) use both capitals so avatars stay distinct.
  const words = p.short.split(/\s+/);
  p.initials = (words.length > 1 ? words.map(w => w[0]).join('') : (p.short.match(/[A-Z]/g) || [p.short[0]]).join('')).slice(0, 2).toUpperCase();
  p.tone = phaseOf(p.phase).tone;
  p.pct = pctOf(p.counts.done, p.counts.orders);
  p.decisions = p.decisions || [];
  p.changesList = p.changes?.items || [];
  for (const w of p.orders) {
    const meta = frontmatter(w.body);
    w.deps = listOf(meta.dependsOn || meta.depends_on);
    w.difficulty = meta.difficulty || '';
    w.reopen = meta.reopen_count || '0';
    w.updated = meta.last_updated || '';
    w.reqs = listOf(meta.source_requirements);
    w.artifacts = listOf(meta.artifacts).length;
    w.blocked = meta.blocked_reason && !Array.isArray(meta.blocked_reason) ? meta.blocked_reason : '';
    w.short = w.title.replace(new RegExp('^' + w.id.replace(/[-]/g, '\\-') + '\\s*[—:–-]*\\s*'), '');
  }
  const frdIds = [...new Set([
    ...p.docs.filter(d => /^docs\/frds\/frd-\d+[^/]*\/frd\.md$/.test(d.relPath)).map(d => d.relPath.split('/')[2]),
    ...p.orders.map(w => w.frd),
  ])].filter(Boolean).sort();
  p.frds = frdIds.map(group => {
    const code = (group.match(/^frd-\d+/) || [group])[0].toUpperCase();
    const fromSpec = p.spec?.parsed?.frds?.find(f => f.id === code);
    const fromArch = p.architecture?.parsed?.frds?.find(f => f.id === code);
    const doc = p.docs.find(d => d.relPath === `docs/frds/${group}/frd.md`);
    const h1 = /^#\s+(.+)$/m.exec((doc?.body || '').replace(/^---[\s\S]*?---/, ''))?.[1];
    const fromDoc = h1 ? h1.replace(/^FRD-\d+\s*[—:–-]*\s*/i, '').trim() : '';
    const orders = p.orders.filter(w => w.frd === group);
    return {
      group, code, orders,
      title: fromSpec?.title || fromArch?.title || fromDoc || humanize(group),
      summary: fromSpec?.summary || '',
      blueprint: fromArch?.blueprint || '',
      doc, fdd: p.docs.find(d => d.relPath === `docs/frds/${group}/fdd.md`), blue: p.docs.find(d => d.relPath === `docs/frds/${group}/blueprint.md`),
      done: orders.filter(w => w.state === 'done').length,
    };
  });
  return p;
});
const HEALTH = EXTRAS?.health || null;
for (const p of PROJECTS) p.lastActivity = HEALTH?.lastActivity?.[p.id] || null;
/** Most recently changed first (last commit), so the project you just touched is always on top. */
const BY_RECENT = [...PROJECTS].sort((a, b) => (Date.parse(b.lastActivity || 0) || 0) - (Date.parse(a.lastActivity || 0) || 0) || a.short.localeCompare(b.short));
const SIDEBAR_PROJECTS = 5;
const sinceCapture = iso => { if (!iso || !EXTRAS) return ''; const h = Math.max(0, Math.round((Date.parse(EXTRAS.capturedAt) - Date.parse(iso)) / 3600000)); return h < 1 ? 'hace menos de 1\u00a0h' : h < 48 ? `hace ${h}\u00a0h` : `hace ${Math.round(h / 24)}\u00a0días`; };
const projectById = id => PROJECTS.find(p => p.id === id);
const IDEAS = SNAP.ideas;
const ideaPhase = i => {
  if (i.status === 'discarded') return 'discarded';
  const p = projectById(i.projectId);
  if (p) return p.phase;
  return i.status === 'shipped' ? 'release' : 'discovered';
};
const ideaProject = i => projectById(i.projectId) || null;
const getDoc = (p, relPath) => p?.docs.find(d => d.relPath === relPath) || null;
const projectOfIdea = slug => PROJECTS.find(p => p.idea?.slug === slug || p.id === IDEAS.find(i => i.slug === slug)?.projectId);

/** Owner-facing context of a decision block, captured from the project's decisions inbox. */
function decisionDetail(p, d) {
  const list = EXTRAS?.health?.decisionDetails?.[p.id] || [];
  const title = d.title.replace(/^·\s*/, '').slice(0, 40);
  return list.find(x => x.date === d.date && x.heading.includes(title)) || null;
}
const ageDays = date => Math.max(0, Math.round((Date.parse(SNAP.capturedAt) - Date.parse(date)) / 86400000));
/** Everything that waits on the owner, derived from the captured decisions, review orders and change queue. */
function attentionFor(p) {
  const items = [];
  for (const d of p.decisions.filter(d => !d.resolved)) items.push({ type: 'decision', d, detail: decisionDetail(p, d), tone: 'amber', icon: 'flag', kind: 'Decisión pendiente', title: d.title.replace(/^·\s*/, ''), sub: `${p.short} · ${fmtDate(d.date)}`, attr: `data-decision="${esc(p.id)}|${esc(d.id)}"`, verb: 'Ver decisión', cmd: `/pandacorp:decide ${d.id}`, cmdNote: `en la carpeta de ${p.short}`, p });
  for (const w of p.orders.filter(w => w.state === 'review')) items.push({ owner: false, tone: 'amber', icon: 'eye', group: 'review', kind: 'Work order en revisión', title: `${w.id} · ${plain(w.short)}`, sub: `${p.short} · se cierra cuando el build revise su FRD`, href: href('portfolio', { project: p.id, tab: 'Observabilidad', wo: w.id }), verb: 'Abrir orden', p });
  for (const c of p.changesList.filter(c => c.status === 'ready')) items.push({ type: 'change', c, tone: 'pink', icon: 'branch', kind: 'Cambio listo', title: c.title, sub: `${p.short} · listo para construir`, attr: `data-change="${esc(p.id)}|${esc(c.id)}"`, verb: 'Ver cambio', cmd: `/pandacorp:implement change:${c.id}`, cmdNote: `en la carpeta de ${p.short}`, p });
  for (const c of p.changesList.filter(c => c.status === 'building')) items.push({ owner: false, group: 'building', tone: 'violet', icon: 'bolt', kind: 'En construcción', title: c.title, sub: `${p.short} · cambio en curso`, attr: `data-change="${esc(p.id)}|${esc(c.id)}"`, verb: 'Ver cambio', p });
  const drafts = p.changesList.filter(c => c.status === 'draft');
  if (drafts.length) items.push({ owner: false, group: 'draft', tone: 'slate', icon: 'file', kind: 'Borradores', title: `${plural(drafts.length, 'cambio en borrador', 'cambios en borrador')}`, sub: `${p.short} · aún no entran al build hasta quedar listos`, href: href('portfolio', { project: p.id, tab: 'Cambios' }), verb: 'Revisar', p });
  return items;
}
const ATTENTION = PROJECTS.flatMap(attentionFor);
/** "Tu turno" holds only what the owner can act on (decisions, changes ready to build); the rest is "En marcha". */
const OWNER_TURN = ATTENTION.filter(a => a.owner !== false);
const IN_FLIGHT = ATTENTION.filter(a => a.owner === false);
const OWNER_ATTENTION = OWNER_TURN.length;

/* ================= Routing ================= */
const state = { screen: 'inicio', params: new URLSearchParams(), key: '' };
const UI = {
  boardQ: '', boardCat: '', woExpanded: new Set(), frdAllOpen: false, modelScale: 1, modelSel: '', modelQ: '', subtitleOpen: false,
  trophyCat: '', docType: '', backlogPri: '', backlogType: '', backlogArea: '', ruleQ: '', ruleApproval: '', cfgQ: '', more: {}, docQ: '', manualQ: '', skillQ: '',
};
const P = key => state.params.get(key) || '';
/** Builds a hash URL carrying only the parameters the destination screen reads. */
function href(screen, params = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) u.set(k, v);
  const s = u.toString();
  return '#' + screen + (s ? '?' + s : '');
}
function go(screen, params = {}) {
  const next = href(screen, params);
  if (location.hash === next) render(); else location.hash = next;
}
/** Merge parameters into the current screen's URL (empty value removes the key). */
function patch(params) {
  const cur = Object.fromEntries(state.params);
  for (const [k, v] of Object.entries(params)) { if (v === '' || v == null) delete cur[k]; else cur[k] = v; }
  go(state.screen, cur);
}
function route() {
  const [screen, query] = location.hash.slice(1).split('?');
  const prev = state.key;
  state.screen = SCREENS[screen] ? screen : 'inicio';
  state.params = new URLSearchParams(query || '');
  state.key = [state.screen, P('project'), P('idea'), P('tab'), P('wo'), P('page'), P('item')].join('|');
  closeDrawer();
  render();
  if (prev !== state.key) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (prev) $('#content').focus({ preventScroll: true });
  }
}

/* ================= Shell ================= */
function navCount(id) {
  if (id === 'inicio' && OWNER_ATTENTION) return `<span class="count alert" aria-label="${OWNER_ATTENTION} asuntos esperan tu decisión">${OWNER_ATTENTION}</span>`;
  if (id === 'tablero') return `<span class="count">${IDEAS.filter(i => i.status !== 'discarded').length}</span>`;
  if (id === 'propuestas' && EXTRAS) { const n = proposalActions().filter(a => a.needsYou).length; return n ? `<span class="count" aria-label="${plural(n, 'cosa espera', 'cosas esperan')} tu decisión">${n}</span>` : ''; }
  return '';
}
function currentNav() { return state.screen === 'idea' ? 'tablero' : state.screen; }
function renderSidebar() {
  const nav = currentNav();
  const g = EXTRAS?.guild;
  $('#sidebar').innerHTML = `
    <a class="brand" href="#inicio" aria-label="Pandacorp Mission Control: ir a Inicio"><img src="assets/pandacorp.png" alt=""><div><b>Pandacorp</b><small>MISSION CONTROL</small></div></a>
    ${HEALTH?.plugin?.behind ? `<a class="plugin-pill" href="#inicio" data-tone="coral" title="Instalado ${esc(HEALTH.plugin.installed)} · repositorio ${esc(HEALTH.plugin.source)}">${ico('alert', 'sm')}<span class="lbl">Plugin desactualizado</span></a>` : ''}
    <nav class="navgroup" aria-label="Secciones">
      ${NAV.map(n => `<a class="navitem" data-tone="${n.tone}" href="#${n.id}" ${nav === n.id ? 'aria-current="page"' : ''}>${ico(n.icon)}<span class="lbl">${n.label}</span><span class="mini">${n.mini}</span>${navCount(n.id)}${n.id === 'inicio' && OWNER_ATTENTION ? '<span class="raildot" aria-hidden="true"></span>' : ''}</a>`).join('')}
    </nav>
    <div class="navgroup projnav" data-open="${projectsOpen()}">
      <button type="button" class="navlabel navtoggle" data-action="toggle-projects" aria-expanded="${projectsOpen()}" aria-controls="projlist" title="Ordenados por último cambio"><span>Proyectos</span><span class="faint">${PROJECTS.length} ${ico('chevD', 'sm')}</span></button>
      <div id="projlist" class="navgroup" ${projectsOpen() ? '' : 'hidden'}>
      ${BY_RECENT.slice(0, SIDEBAR_PROJECTS).map(p => `<a class="navitem" data-tone="${p.tone}" href="${href('portfolio', { project: p.id })}" ${state.screen === 'portfolio' && P('project') === p.id ? 'aria-current="page"' : ''} aria-label="${esc(p.short)}: ${esc(phaseOf(p.phase).label)}, ${p.counts.orders ? p.pct + '% de work orders verificados' : 'sin work orders'}"><span class="pav" data-tone="${p.tone}">${esc(p.initials)}</span><span class="meta"><span>${esc(p.short)}</span><small>${esc(phaseOf(p.phase).label)}${p.counts.orders ? ' · ' + p.pct + '%' : ''}</small></span></a>`).join('')}
      ${PROJECTS.length > SIDEBAR_PROJECTS ? `<a class="navitem seeall" href="#portfolio">${ico('list', 'sm')}<span class="lbl">Ver los ${PROJECTS.length}</span></a>` : ''}
      </div>
    </div>
    ${g ? `<a class="guildcard" href="#logros" aria-label="Gremio: nivel ${g.level}, ${esc(g.rankName)}">
      <div class="row"><span class="crest">${g.level}</span><span class="gtext"><b>${esc(g.rankName)}</b><small>${g.xp - g.levelStartXp} / ${g.nextLevelXp - g.levelStartXp} XP al nivel ${g.level + 1}</small></span></div>
      ${bar(g.pctToNext, 'gold')}</a>` : ''}
    <button type="button" class="side-toggle" data-action="toggle-sidebar" aria-pressed="${sidebarCollapsed()}" aria-label="${sidebarCollapsed() ? 'Fijar la barra lateral abierta' : 'Colapsar la barra lateral'}">${ico(sidebarCollapsed() ? 'panelOpen' : 'panelClose', 'sm')}<span class="lbl">${sidebarCollapsed() ? 'Fijar abierta' : 'Colapsar'}</span></button>`;
  $('#app').dataset.sidebar = sidebarCollapsed() ? 'collapsed' : 'expanded';
}
/** Collapsed rail floats open over the page while the pointer is on it (it never pushes the content). */
$('#sidebar').addEventListener('mouseenter', () => { if (sidebarCollapsed()) $('#sidebar').dataset.float = 'true'; });
$('#sidebar').addEventListener('mouseleave', () => { delete $('#sidebar').dataset.float; });
/** Desktop sidebar preference, as in PandaTrack: pinned open (default) or collapsed to icons; remembered per browser. */
function sidebarCollapsed() { return store.get('orbita-sidebar') === 'collapsed'; }
function projectsOpen() { return store.get('orbita-projects-open') !== 'false'; }
function renderBottomNav() {
  const nav = currentNav();
  const items = NAV.filter(n => ['inicio', 'tablero', 'portfolio', 'documentacion'].includes(n.id));
  $('#bottomnav').innerHTML = items.map(n => `<a href="#${n.id}" data-tone="${n.tone}" ${nav === n.id ? 'aria-current="page"' : ''}>${ico(n.icon)}<span>${n.mini}</span></a>`).join('')
    + `<button type="button" data-action="drawer" aria-controls="sidebar">${ico('menu')}<span>Más</span></button>`;
}
const isPhone = () => matchMedia('(max-width: 759px)').matches;
function syncDrawerA11y() {
  const open = $('#sidebar').dataset.open === 'true';
  if (isPhone() && !open) $('#sidebar').setAttribute('inert', ''); else $('#sidebar').removeAttribute('inert');
}
function openDrawer() { $('#sidebar').dataset.open = 'true'; $('#scrim').dataset.open = 'true'; $('#menu').setAttribute('aria-expanded', 'true'); syncDrawerA11y(); $('#sidebar a')?.focus(); }
function closeDrawer() {
  const wasOpen = $('#sidebar').dataset.open === 'true';
  $('#sidebar').dataset.open = 'false'; $('#scrim').dataset.open = 'false'; $('#menu').setAttribute('aria-expanded', 'false'); syncDrawerA11y();
  return wasOpen;
}

function pageHead(title, sub, opts = {}) {
  const { eyebrow = '', actions = '', crumbs = '' } = opts;
  return `<header class="pagehead"><div class="titles">${crumbs}${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="row wrap">${actions}</div>` : ''}</header>`;
}
const crumbs = list => `<nav class="crumbs" aria-label="Ruta">${list.map(([label, link], i) => (i ? ico('chevR', 'sm') : '') + (link ? `<a href="${link}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`)).join('')}</nav>`;
const projectStamp = () => `<span class="stamp"><span class="dot"></span>Captura de proyectos · ${esc(fmtStamp(SNAP.capturedAt))}</span>`;
const factoryStamp = () => EXTRAS ? `<span class="stamp"><span class="dot"></span>Captura de la fábrica · ${esc(fmtStamp(EXTRAS.capturedAt))}</span>` : '';

/** Accessible tab row: buttons switch a URL parameter; arrows move between tabs. */
function tabs(items, active, key, label) {
  return `<div class="tabs-wrap"><button type="button" class="tabs-arrow left" data-tabs-scroll="-1" aria-label="Ver secciones anteriores" tabindex="-1">${ico('back', 'sm')}</button><button type="button" class="tabs-arrow right" data-tabs-scroll="1" aria-label="Ver más secciones" tabindex="-1">${ico('arrow', 'sm')}</button><div class="tabs" role="tablist" aria-label="${esc(label)}">${items.map(t => {
    const id = t.id || t;
    const on = id === active;
    return `<button type="button" role="tab" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-tone="${t.tone || 'violet'}" data-tabkey="${key}" data-tabval="${esc(id)}">${t.icon ? ico(t.icon, 'sm') : ''}${esc(t.label || id)}${t.badge != null && t.badge !== '' ? `<span class="badge">${t.badge}</span>` : ''}</button>`;
  }).join('')}</div></div>`;
}
const seg = (items, active, key, label) => `<div class="seg" role="group" aria-label="${esc(label)}">${items.map(t => `<button type="button" aria-pressed="${t.id === active}" data-tone="${t.tone || 'blue'}" data-segkey="${key}" data-segval="${esc(t.id)}">${t.icon ? ico(t.icon, 'sm') : ''}${esc(t.label)}</button>`).join('')}</div>`;

function stepper(phase, compact = false) {
  const idx = PHASES.findIndex(x => x.id === phase);
  return `<ol class="stepper ${compact ? 'compact' : ''}" aria-label="Fase: ${esc(phaseOf(phase).label)}">${PHASES.map((x, i) => {
    const st = i < idx ? 'past' : i === idx ? 'current' : 'next';
    const word = st === 'past' ? 'completada' : st === 'current' ? 'fase actual' : 'pendiente';
    return `<li data-tone="${x.tone}" data-state="${st}" ${compact ? `data-tip="${i + 1}. ${x.label} · ${word}"` : ''}><span class="seg-line"></span>${compact ? `<span class="sr-only">${x.label}: ${word}</span>` : `<span class="lbl">${x.label}</span>`}</li>`;
  }).join('')}</ol>`;
}

/* ================= Inicio ================= */
function turnRow(a) {
  const action = a.href
    ? `<a class="btn sm" href="${a.href}">${a.verb}${ico('arrow', 'sm')}</a>`
    : `<button type="button" class="btn sm" ${a.attr}>${a.verb}${ico('arrow', 'sm')}</button>`;
  const command = a.cmd ? `<div class="turn-cmd"><span class="small muted">Corre ${esc(a.cmdNote || '')}:</span>${cmd(a.cmd)}</div>` : '';
  return `<div class="turn" data-tone="${a.tone}"><span class="badge-icon">${ico(a.icon)}</span><div class="grow"><span class="kind">${esc(a.kind)}</span><strong>${inl(a.title)}</strong><small>${esc(a.sub)}</small></div>${action}${command}</div>`;
}
function feedEntry(e, withProject = true) {
  return `<div class="entry"><span class="pav" data-tone="${e.p.tone}" aria-hidden="true">${esc(e.p.initials)}</span><div>${inl(e.text.replace(/^\s*[-*]\s+/, ''))}${withProject ? `<span class="who">${esc(e.p.short)}</span>` : ''}</div></div>`;
}
function projectCard(p) {
  const next = p.commands?.[0];
  return `<a class="proj-card" data-tone="${p.tone}" href="${href('portfolio', { project: p.id })}">
    <div class="row between top"><div class="row"><span class="pav md" data-tone="${p.tone}">${esc(p.initials)}</span><div class="grow"><h3>${esc(p.short)}</h3>${phaseChip(p.phase)}</div></div>${p.counts.orders ? ring(p.pct, p.pct === 100 ? 'green' : p.tone, '', `${p.counts.done} de ${p.counts.orders} work orders verificados`) : `<span class="chip plain" data-tip="Aún no tiene work orders publicados" tabindex="0">Sin WOs</span>`}</div>
    <div class="stack sm">${stepper(p.phase, true)}<span class="xs faint">Etapa ${PHASES.findIndex(x => x.id === p.phase) + 1} de ${PHASES.length} del pipeline${p.lastActivity ? ` · último cambio ${sinceCapture(p.lastActivity)}` : ''}</span></div>
    <div class="facts"><span><b>${p.counts.done}/${p.counts.orders}</b> WO verificados</span><span><b>${p.counts.frds}</b> FRDs</span><span><b>${p.counts.docs}</b> docs</span>${p.running ? chip('Construyendo', 'violet') : ''}</div>
    ${next ? `<div class="small faint">Siguiente · <code>${esc(next.command)}</code></div>` : ''}
  </a>`;
}
function home() {
  const ideasActive = IDEAS.filter(i => i.status !== 'discarded');
  const g = EXTRAS?.guild;
  const totals = { frds: PROJECTS.reduce((n, p) => n + p.counts.frds, 0), done: PROJECTS.reduce((n, p) => n + p.counts.done, 0), orders: PROJECTS.reduce((n, p) => n + p.counts.orders, 0) };
  const funnel = PHASES.map(ph => ({ ph, n: ideasActive.filter(i => ideaPhase(i) === ph.id).length }));
  const maxN = Math.max(1, ...funnel.map(f => f.n));
  const turns = OWNER_TURN;
  return pageHead('Centro de mando', 'Primero lo que necesita tu acción; después lo que avanza y el estado de tus proyectos.', { eyebrow: projectStamp() })
    + pluginBanner()
    + `<div class="home-grid"><div class="stack lg">
      ${card(`Tu turno ${turns.length ? `<span class="chip" data-tone="amber">${turns.length}</span>` : ''}`, ownerTurn(turns), { icon: 'target', tone: 'amber' })}
      <section aria-labelledby="h-cartera"><h2 id="h-cartera" class="saga-head" data-tone="blue">${ico('folder', 'sm')}<span>Tu cartera</span><span class="saga-line"></span><a class="link xs" data-tone="blue" href="#portfolio">Ver portafolio ${ico('arrow', 'sm')}</a></h2>
        <div class="proj-cards">${BY_RECENT.map(projectCard).join('')}</div></section>
      ${inFlightCard()}
    </div><div class="stack lg">
      ${card('Pulso', `<div class="pulse"><div><span class="num">${PROJECTS.length}</span><small>Proyectos</small></div><div><span class="num">${totals.frds}</span><small>FRDs</small></div><div><span class="num">${totals.done}</span><small>de ${totals.orders} WO verificados</small></div></div>`, { icon: 'gauge', tone: 'teal' })}
      ${g ? card('Gremio', `<div class="row"><img src="assets/ranks/${esc(rankSprite(g))}.png" alt="" width="56" height="56" style="image-rendering:pixelated"><div class="grow"><b>${esc(g.rankName)}</b><div class="small muted">Nivel ${g.level} · ${g.xp} XP</div></div></div><div style="margin-top:12px">${bar(g.pctToNext, 'gold')}</div><p class="small faint" style="margin-top:6px">${g.nextLevelXp - g.xp} XP para el nivel ${g.level + 1} · ${g.trophies.filter(t => t.unlocked).length} trofeos</p>${lastAchievement(g)}<div class="card-foot"><span class="small faint">Captura del ${esc(fmtDate(EXTRAS.capturedAt))}</span><a class="link" data-tone="gold" href="#logros">Ver logros ${ico('arrow', 'sm')}</a></div>`, { icon: 'trophy', tone: 'gold' }) : ''}
      ${card('Embudo de ideas', `<div class="funnel">${funnel.map(f => `<div class="frow"><span>${f.ph.label}</span>${bar((f.n / maxN) * 100, f.ph.tone)}<b>${f.n}</b></div>`).join('')}</div><div class="card-foot"><span class="small faint">${IDEAS.filter(i => i.status === 'discarded').length} descartadas</span><a class="link" data-tone="teal" href="#tablero">Abrir tablero ${ico('arrow', 'sm')}</a></div>`, { icon: 'kanban', tone: 'teal' })}
      ${worktreesCard()}
    </div></div>`;
}
/** "Tu turno": one short line per item, the exact command, and everything else behind "Detalles". */
function ownerTurn(items, { showProject = true } = {}) {
  if (!items.length) return empty('Nada espera tu acción ahora mismo.', 'check');
  const order = { decision: 0, change: 1 };
  const row = (a, n) => {
    const isDecision = a.type === 'decision';
    const meta = [showProject ? a.p.short : '', isDecision ? 'Decisión' : 'Cambio listo', isDecision ? `hace ${plural(ageDays(a.d.date), 'día', 'días')}` : `pedido el ${fmtDate(a.c.date)}`].filter(Boolean).join(' · ');
    return `<li class="ask-row"><span class="ask-ico" data-tone="${a.tone}">${ico(a.icon, 'sm')}</span>
      <div class="grow"><strong class="clamp-2">${inl(a.title)}</strong><span class="ask-meta">${esc(meta)}${a.detail?.fileStatus ? ' · <span class="tone-text" data-tone="coral">ya resuelta en el archivo</span>' : ''}</span>
        <span class="ask-cmd">${ico('terminal', 'sm')}<code>${cmdWbr(a.cmd)}</code><button type="button" class="iconbtn" data-copy="${esc(a.cmd)}" aria-label="Copiar ${esc(a.cmd)}" data-tip="Copiar comando">${ico('copy', 'sm')}</button></span></div>
      <button type="button" class="btn sm ghost" data-turn="${n}" aria-label="Detalles: ${esc(plain(a.title))}">Detalles</button></li>`;
  };
  const sorted = [...items].sort((x, y) => order[x.type] - order[y.type]);
  TURN_INDEX = sorted;
  return `<ul class="ask-list">${sorted.map(row).join('')}</ul>`;
}
let TURN_INDEX = [];
/** Modal with the full story of one "Tu turno" item: what it is, what is needed, the command and what it does. */
function turnDetail(a) {
  if (a.type === 'decision') {
    const det = a.detail, age = ageDays(a.d.date);
    dialog(inl(a.title), `<p class="small muted">Decisión pendiente en <b>${esc(a.p.short)}</b>: un agente encontró algo que no debe decidir solo (alcance, dinero o algo irreversible) y ese punto espera tu respuesta.</p>
      <div class="row wrap">${chip(`hace ${plural(age, 'día', 'días')}`, age >= 7 ? 'amber' : '', age >= 7 ? '' : 'plain')}${chip(esc(a.d.id), '', 'plain')}</div>
      ${det?.fileStatus ? `<div class="notice" data-tone="coral">${ico('alert')}<p class="small">El archivo ya la da por cerrada («${inl(det.fileStatus.slice(0, 120))}…») pero Mission Control la sigue contando. Al correr el comando puedes cerrarla bien.</p></div>` : ''}
      ${det?.ask ? `<div><span class="eyebrow">Lo que se necesita de ti</span><p style="margin-top:4px">${inl(det.ask)}</p></div>` : ''}
      ${a.d.recommendation ? `<div><span class="eyebrow">Recomendación del agente</span><p style="margin-top:4px">${inl(a.d.recommendation)}</p></div>` : ''}
      ${det?.context ? `<details><summary class="link small">Contexto</summary><p class="small muted" style="margin-top:6px">${inl(det.context)}</p></details>` : ''}
      <div class="stack sm"><span class="small muted">Corre en la carpeta de ${esc(a.p.short)}. Te muestra la pregunta, las opciones y la recomendación${age >= 7 ? ', primero te pregunta si sigue vigente' : ''}, y guarda tu respuesta.</span>${cmd(a.cmd)}</div>`, { tone: 'amber', kicker: `Decisión · ${esc(a.p.short)}` });
    return;
  }
  const c = a.c;
  dialog(inl(c.title), `<p class="small muted">Cambio que pediste en <b>${esc(a.p.short)}</b>, ya especificado y en la cola. El próximo build lo construye solo; el comando lo construye ahora, solo a él (primero lo convierte en FRD y work orders).</p>
    <div class="md compact" data-tone="pink">${c.html}</div>
    <div class="stack sm"><span class="small muted">Corre en la carpeta de ${esc(a.p.short)}:</span>${cmd(a.cmd)}</div>`, { tone: 'pink', kicker: `Cambio en cola · ${esc(a.p.short)}` });
}
/** FRD-15: the most important notice of all, first on Inicio, only when the installed plugin is behind. */
function pluginBanner() {
  const pl = HEALTH?.plugin;
  if (!pl) return '';
  const behind = pl.behind === true, dirty = (pl.uncommitted || 0) > 0;
  if (!behind && !dirty) return '';
  return `<section class="alert-banner" data-tone="coral" role="alert" aria-labelledby="plugin-alert-title">
    <span class="badge-icon lg">${ico('alert', 'lg')}</span>
    <div class="grow stack sm"><h2 id="plugin-alert-title">${behind ? 'El plugin instalado está atrás' : 'Hay cambios sin commitear en el plugin'}</h2>
      <p>${behind ? `Tienes instalada la <b>${esc(pl.installed)}</b> y el repositorio ya va por la <b>${esc(pl.source)}</b>. Las skills que corras usan la versión vieja hasta que actualices.` : ''}${dirty ? ` ${plural(pl.uncommitted, 'archivo modificado', 'archivos modificados')} en <code>plugin/</code> sin commitear.` : ''}</p>
      ${behind ? `<p class="small muted">1) Corre el comando · 2) Reinicia la sesión de Claude Code.</p>${cmd('claude plugin update pandacorp@panda-corp')}` : ''}</div></section>`;
}
const ORIGIN = [[/^lane\//, 'Carril de un build'], [/^claude\//, 'Sesión de Claude Code'], [/^codex\//, 'Sesión de Codex']];
const originOf = branch => (ORIGIN.find(([re]) => re.test(branch)) || [null, 'Rama manual'])[1];
const CLEANUP_SKILL = '/pandacorp:worktrees';
/**
 * Per-repo cleanup urgency (a design proposal, explained in the card's legend):
 * leftovers = open worktrees that carry nothing pending (already merged), which a cleanup removes;
 * "Depurar ya" when there are 3+ leftovers or pending branches, or any branch untouched for over 7 days;
 * "Revisar pronto" when any branch is older than a day or any leftover exists; "Al día" otherwise.
 */
function cleanupState(r) {
  const pend = r.items.length;
  const wt = r.worktrees || { total: 0, locked: 0 };
  const leftovers = Math.max(0, wt.total - wt.locked - r.items.filter(i => i.worktree).length);
  const oldest = Math.max(0, ...r.items.map(i => i.ageHours));
  let state = ['Limpio', 'green', 0];
  if (pend || leftovers) state = ['Al día', 'green', 1];
  if (oldest > 24 || leftovers > 0) state = ['Revisar pronto', 'amber', 2];
  if (leftovers >= 3 || pend >= 3 || oldest > 24 * 7) state = ['Depurar ya', 'coral', 3];
  return { pend, leftovers, oldest, label: state[0], tone: state[1], rank: state[2] };
}
function worktreesCard() {
  const pend = HEALTH?.pending;
  if (!pend) return card('Árboles de trabajo', missingExtras('las ramas abiertas'), { icon: 'branch' });
  const rows = pend.map(r => ({ r, st: cleanupState(r) })).sort((x, y) => y.st.rank - x.st.rank || y.st.pend + y.st.leftovers - (x.st.pend + x.st.leftovers));
  return card('Árboles de trabajo', `<p class="small muted">Trabajo en paralelo que no está en <code>main</code>, y worktrees que sobraron.</p>
    <div class="skill-line"><span class="xs faint">Para depurar un proyecto, corre en su carpeta</span><span class="ask-cmd">${ico('terminal', 'sm')}<code>${CLEANUP_SKILL}</code><button type="button" class="iconbtn" data-copy="${CLEANUP_SKILL}" aria-label="Copiar ${CLEANUP_SKILL}" data-tip="Copiar comando">${ico('copy', 'sm')}</button></span>${illus('Habilidad propuesta')}</div>
    <div class="scroll-x"><table class="wt-table"><thead><tr><th scope="col">Proyecto</th><th scope="col" title="Ramas con trabajo que no está en main">Sin integrar</th><th scope="col" title="Worktrees abiertos sin nada pendiente">Sobrantes</th><th scope="col">Estado</th></tr></thead>
    <tbody>${rows.map(({ r, st }) => `<tr><th scope="row"><button type="button" class="link" data-tone="slate" data-wt-repo="${esc(r.id)}" ${st.pend || st.leftovers ? '' : 'disabled'}>${esc(r.name.replace(' (panda-corp)', ''))}</button></th><td>${st.pend || '—'}</td><td>${st.leftovers || '—'}</td><td>${r.kind === 'error' ? chip('No se pudo leer', 'coral') : `<span class="state-dot" data-tone="${st.tone}"><span class="dot"></span>${st.label}</span>`}</td></tr>`).join('')}</tbody></table></div>
    <details class="legend"><summary class="link small">¿Cómo se decide el estado?</summary><p class="xs muted" style="margin-top:6px"><b>Depurar ya:</b> 3 o más sobrantes o ramas sin integrar, o alguna sin tocar hace más de 7 días. <b>Revisar pronto:</b> alguna rama de más de un día o algún sobrante. <b>Al día:</b> solo trabajo reciente. Captura del ${esc(fmtStamp(EXTRAS.capturedAt))}.</p></details>`, { icon: 'branch' });
}
/** Branch list of one repo, on demand. */
function worktreeDetail(id) {
  const r = HEALTH.pending.find(x => x.id === id);
  const st = cleanupState(r);
  const age = h => h < 48 ? `${h} h` : `${Math.round(h / 24)} días`;
  dialog(`Árboles de trabajo · ${esc(r.name)}`, `<p class="small muted">${plural(st.pend, 'rama sin integrar', 'ramas sin integrar')} y ${plural(st.leftovers, 'worktree sobrante', 'worktrees sobrantes')}${r.worktrees?.locked ? ` (más ${r.worktrees.locked} bloqueado, que no se toca)` : ''}.</p>
    ${r.items.length ? `<ul class="ask-list">${r.items.map(i => `<li class="ask-row"><span class="ask-ico">${ico('branch', 'sm')}</span><div class="grow"><strong class="clamp-2">${inl(i.subject || i.branch)}</strong><span class="ask-meta">${esc(originOf(i.branch))} · hace ${age(i.ageHours)} · ${plural(i.ahead, 'commit', 'commits')} fuera de main${i.uncommitted ? ` · ${i.uncommitted} sin guardar` : ''}</span><span class="xs faint mono">${esc(i.branch)}</span></div></li>`).join('')}</ul>` : ''}
    <div class="stack sm"><span class="small muted">Corre en la carpeta de ${esc(r.name)} para depurarlo:</span>${cmd(CLEANUP_SKILL)}</div>`, { tone: 'teal', kicker: 'Árboles de trabajo' });
}
/** Work already in the factory's hands; grouped so "who moves next" is explicit. */
function inFlightCard() {
  if (!IN_FLIGHT.length) return '';
  const groups = [['building', 'Construyéndose ahora', 'Cambios que un build está implementando.'], ['review', 'Esperan la revisión de su FRD', 'Órdenes ya construidas; se verifican cuando el build revisa su FRD completo.'], ['draft', 'Borradores en la cola', 'Cambios capturados que aún no están listos para construirse.']];
  return card(`En marcha <span class="chip" data-tone="violet">${IN_FLIGHT.length}</span>`, `<p class="small muted card-intro">Trabajo que ya está en manos de la fábrica. No espera una decisión tuya; avanza cuando corre el build.</p>
    <div class="flight">${groups.map(([g, title, hint]) => { const list = IN_FLIGHT.filter(a => a.group === g); return list.length ? `<details class="flight-group"><summary><span class="grow"><b>${title}</b><small>${hint}</small></span><span class="chip plain">${list.length}</span>${ico('chevD', 'sm')}</summary><div class="turn-list">${list.map(turnRow).join('')}</div></details>` : ''; }).join('')}</div>`, { icon: 'loader', tone: 'violet' });
}
function rankSprite(g) { return g.ranks?.find(r => r.current)?.sprite || 'human'; }

/* ================= Tablero ================= */
function ideaCard(i) {
  const p = ideaProject(i);
  const tab = p?.architecture ? 'Arquitectura' : p?.spec ? 'Spec' : 'Propuesta';
  return `<article class="kcard" data-tone="${phaseOf(ideaPhase(i)).tone}" data-idea-text="${esc((i.title + ' ' + (i.body || '')).toLowerCase())}" data-cat="${esc(i.category || '')}">
    <a class="title" href="${href('idea', { idea: i.slug, tab })}">${esc(i.title)}</a>
    <button type="button" class="iconbtn star" aria-pressed="${!!i.favorite}" data-star="${esc(i.slug)}" aria-label="${i.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}: ${esc(i.title)}">${ico('star', 'sm')}</button>
    <div class="meta">${chip(esc(i.category || 'Sin categoría'), '', 'plain')}${returnChip(i.return)}<span class="score">${i.score ? `Score ${bar(i.score, 'teal')}${i.score}` : 'Sin score'}</span></div>
    ${p ? `<div class="projline"><span>${p.counts.orders ? `${p.counts.done}/${p.counts.orders} WO` : 'Proyecto creado'}</span>${p.counts.orders ? bar(p.pct, p.tone) : ''}${p.running ? chip('Construyendo', 'violet') : ''}</div>` : ''}
  </article>`;
}
function board() {
  const active = IDEAS.filter(i => i.status !== 'discarded');
  const cats = [...new Set(active.map(i => i.category).filter(Boolean))].sort();
  const discarded = IDEAS.filter(i => i.status === 'discarded').length;
  const cols = PHASES.map(ph => ({ ph, items: active.filter(i => ideaPhase(i) === ph.id) }));
  return pageHead('Tablero', 'Todas tus ideas por fase. Cada tarjeta abre su propuesta y, si ya es proyecto, su documentación completa.', {
    eyebrow: projectStamp(),
    actions: `<button type="button" class="btn" data-action="discarded">${ico('archive', 'sm')}Descartadas · ${discarded}</button><button type="button" class="btn primary" data-action="capture">${ico('plus', 'sm')}Capturar ideas</button>`,
  })
    + `<div class="toolbar"><label class="field search">${ico('search', 'sm')}<input id="idea-search" type="search" placeholder="Buscar por nombre o contenido…" aria-label="Buscar ideas" value="${esc(UI.boardQ)}"></label>
      <div class="chipset" role="group" aria-label="Filtrar por categoría"><button type="button" class="chipbtn" data-cat-filter="" aria-pressed="${!UI.boardCat}">Todas <span class="n">${active.length}</span></button>${cats.map(c => `<button type="button" class="chipbtn" data-cat-filter="${esc(c)}" aria-pressed="${UI.boardCat === c}">${esc(c)} <span class="n">${active.filter(i => i.category === c).length}</span></button>`).join('')}</div>
      <button type="button" class="btn ghost sm" data-action="clear-board" ${UI.boardQ || UI.boardCat ? '' : 'hidden'}>${ico('x', 'sm')}Limpiar</button>
      <span class="grow"></span><span class="small faint" id="board-count" aria-live="polite"></span>
      <button type="button" class="switch" role="switch" aria-checked="${hideEmpty()}" data-action="toggle-empty"><span class="track" aria-hidden="true"><span></span></span>Ocultar columnas vacías</button></div>
    <nav class="phase-nav" aria-label="Ir a una fase">${cols.filter(({ items }) => items.length || !hideEmpty()).map(({ ph, items }) => `<button type="button" data-tone="${ph.tone}" data-phase-jump="${ph.id}" aria-current="${ph.id === cols[0].ph.id}"><span class="dot"></span>${ph.label}<span class="n">${items.length}</span></button>`).join('')}</nav>
    <div class="kanban ideas" id="board-scroller" tabindex="0" role="region" aria-label="Tablero por fases. Desliza o usa las flechas para ver más columnas.">${cols.filter(({ items }) => items.length || !hideEmpty()).map(({ ph, items }) => `<section class="kcol ${items.length ? '' : 'is-empty'}" id="col-${ph.id}" data-phase="${ph.id}" data-tone="${ph.tone}" aria-label="${ph.label}: ${plural(items.length, 'idea', 'ideas')}">
      <h2 class="kcol-head"><span class="dot"></span><span class="step">${PHASES.indexOf(ph) + 1}</span><span class="grow">${ph.label}</span>${chip(items.length, ph.tone)}</h2>
      ${items.map(ideaCard).join('') || '<p class="kempty">Sin ideas en esta fase</p>'}${items.length ? '<div class="kempty" hidden>Sin coincidencias</div>' : ''}</section>`).join('')}</div>`;
}
function hideEmpty() { return store.get('orbita-hide-empty') === 'true'; }
function filterBoard() {
  const q = UI.boardQ.trim().toLowerCase();
  let shown = 0;
  $$('[data-idea-text]').forEach(el => { const ok = (!q || el.dataset.ideaText.includes(q)) && (!UI.boardCat || el.dataset.cat === UI.boardCat); el.hidden = !ok; if (ok) shown++; });
  $$('.kanban.ideas .kcol').forEach(col => { const any = col.querySelectorAll('.kcard:not([hidden])').length; const total = col.querySelectorAll('.kcard').length; const k = col.querySelector('div.kempty'); if (k) k.hidden = !(total && !any); });
  const count = $('#board-count'); if (count) count.textContent = q || UI.boardCat ? plural(shown, 'idea coincide', 'ideas coinciden') : '';
  const clear = $('[data-action="clear-board"]'); if (clear) clear.hidden = !(q || UI.boardCat);
}

/** Highlights, in the phase selector, the first column that is fully or mostly visible in the scroller. */
function syncPhaseNav() {
  const sc = $('#board-scroller');
  if (!sc) return;
  const update = () => {
    const left = sc.scrollLeft;
    const cols = $$('.kcol', sc);
    const current = cols.find(c => c.offsetLeft - sc.offsetLeft + c.offsetWidth / 2 > left) || cols[0];
    $$('[data-phase-jump]').forEach(b => b.setAttribute('aria-current', String(b.dataset.phaseJump === current.dataset.phase)));
  };
  sc.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update();
}

/* ================= Idea detail ================= */
function ideaScreen() {
  const i = IDEAS.find(x => x.slug === P('idea'));
  if (!i) return notFound('Esta idea no existe en la captura', `No hay ninguna idea con el identificador «${esc(P('idea') || '(vacío)')}».`, '#tablero', 'Volver al tablero');
  const p = ideaProject(i);
  const phase = ideaPhase(i);
  const ph = phaseOf(phase === 'discarded' ? 'discovered' : phase);
  const avail = [{ id: 'Propuesta', icon: 'bulb', tone: 'blue' }, ...(p?.spec ? [{ id: 'Spec', icon: 'layers', tone: 'blue' }] : []), ...(p ? [{ id: 'Arquitectura', icon: 'cube', tone: 'amber' }, { id: 'Documentos', icon: 'file', tone: 'teal', badge: p.counts.docs }] : []), { id: 'Campaña', icon: 'flag', tone: 'green' }];
  const tab = avail.some(t => t.id === P('tab')) ? P('tab') : 'Propuesta';
  const discarded = i.status === 'discarded';
  const ctx = { p, screen: 'idea', base: { idea: i.slug, tab } };
  let body;
  if (tab === 'Spec') body = specView(p, ctx);
  else if (tab === 'Arquitectura') body = architectureView(p, ctx);
  else if (tab === 'Documentos') body = ideaDocsView(i, p, ctx);
  else if (tab === 'Campaña') body = campaignView(i, p);
  else body = pitchView(i, p);
  return `<header class="idea-head" data-tone="${discarded ? 'slate' : ph.tone}">
      <div class="idea-title"><span class="badge-icon">${ico('bulb')}</span><h1>${esc(i.title)}</h1><span class="row wrap" style="gap:6px">${chip(esc(i.category || 'Sin categoría'), '', 'plain')}${returnChip(i.return)}<span class="xs faint">${i.score ? `Score ${i.score}/100` : 'Sin score'}</span></span></div>
      <p class="small muted idea-stage">${discarded ? 'Descartada' : `Etapa: ${esc(ph.label)}`}</p>
      <div class="row between wrap idea-actions"><a class="btn sm" href="#tablero">${ico('back', 'sm')}<span>Volver<span class="hide-sm"> al tablero</span></span></a><span class="row wrap" style="gap:8px"><button type="button" class="iconbtn star-toggle" data-star="${esc(i.slug)}" aria-pressed="${!!i.favorite}" aria-label="${i.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}">${ico('star', 'sm')}</button>${p ? `<a class="btn sm" href="${href('portfolio', { project: p.id, tab: ['Spec', 'Arquitectura', 'Documentos'].includes(tab) ? tab : '' })}"><span><span class="hide-sm">Abrir en </span>Portafolio</span>${ico('arrow', 'sm')}</a>` : ''}${discarded ? `<button type="button" class="btn sm" data-action="restore-idea" data-slug="${esc(i.slug)}">${ico('rotate', 'sm')}Restaurar</button>` : i.status === 'shipped' ? '' : `<button type="button" class="btn sm danger" data-action="discard-idea" data-slug="${esc(i.slug)}" aria-label="Descartar idea">${ico('trash', 'sm')}<span class="hide-sm">Descartar idea</span></button>`}</span></div>
    </header>`
    + tabs(avail, tab, 'tab', 'Secciones de la idea')
    + `<div role="tabpanel" aria-label="${esc(tab)}">${body}</div>`;
}
/* ================= Portfolio ================= */
function portfolio() {
  const p = projectById(P('project'));
  if (!p && P('project')) return notFound('Este proyecto no existe en la captura', `No hay ningún proyecto «${esc(P('project'))}».`, '#portfolio', 'Ver todos los proyectos');
  if (!p) return portfolioOverview();
  if (P('tab') && !WS_TABS.some(t => t.id === wsTab())) return crumbs([['Portafolio', '#portfolio'], [p.short]]) + compactHero(p) + notFound('Esta sección no existe', `«${esc(P('tab'))}» no es una sección del proyecto.`, href('portfolio', { project: p.id }), 'Ir al resumen');
  const tab = WS_TABS.some(t => t.id === wsTab()) ? wsTab() : 'Resumen';
  const ctx = { p, screen: 'portfolio', base: { project: p.id, tab } };
  const openChanges = p.changesList.filter(c => !['done', 'discarded'].includes(c.status)).length;
  const badges = { Observabilidad: p.counts.orders || '', Cambios: openChanges || '', Documentos: p.counts.docs, Cuentas: (p.services || []).length || '' };
  const body = {
    Resumen: () => summaryView(p), Spec: () => specView(p, ctx), Observabilidad: () => ordersView(p), Arquitectura: () => architectureView(p, ctx),
    Cambios: () => changesView(p), Documentos: () => documentsView(p, ctx), Comandos: () => commandsView(p), Cuentas: () => accountsView(p),
  }[tab]();
  return crumbs([['Portafolio', '#portfolio'], [p.short]]) + (tab === 'Resumen' ? projectHero(p) : compactHero(p))
    + tabs(WS_TABS.map(t => ({ ...t, badge: badges[t.id] })), tab, 'tab', `Secciones de ${p.short}`)
    + `<div role="tabpanel" aria-label="${esc(tab)}">${body}</div>`;
}
function portfolioOverview() {
  return pageHead('Portafolio', 'Tus proyectos lado a lado. Entra a uno para recorrer su Spec, arquitectura, work orders y documentos.', { eyebrow: projectStamp() })
    + `<div class="stack lg"><div class="toolbar">${seg([{ id: 'cards', label: 'Tarjetas', icon: 'grid', tone: 'blue' }, { id: 'lista', label: 'Lista', icon: 'list', tone: 'blue' }], P('view') === 'lista' ? 'lista' : 'cards', 'view', 'Vista de proyectos')}<span class="grow"></span><span class="small faint">Ordenados por último cambio</span></div>
    ${P('view') !== 'lista' ? `<div class="proj-cards">${BY_RECENT.map(projectCard).join('')}</div>` : card('Comparativa', `<div class="table-wrap" tabindex="0" role="region" aria-label="Comparativa de proyectos"><table class="t t-cards"><thead><tr><th scope="col">Proyecto</th><th scope="col">Fase</th><th scope="col">Work orders</th><th scope="col">FRDs</th><th scope="col">Docs</th><th scope="col">ADRs</th><th scope="col">Cambios abiertos</th><th scope="col">Decisiones</th></tr></thead><tbody>${BY_RECENT.map(p => `<tr><td data-span="main"><a class="link" data-tone="${p.tone}" href="${href('portfolio', { project: p.id })}">${esc(p.short)}</a></td><td data-span="end">${phaseChip(p.phase)}</td><td style="min-width:150px" data-span="full" data-label="Work orders"><div class="small">${p.counts.done}/${p.counts.orders}</div>${p.counts.orders ? bar(p.pct, p.tone) : ''}</td><td data-label="FRDs">${p.counts.frds}</td><td data-label="Docs">${p.counts.docs}</td><td data-label="ADRs">${p.adrs.length}</td><td data-label="Cambios">${p.changesList.filter(c => !['done', 'discarded'].includes(c.status)).length}</td><td data-label="Decisiones">${p.decisions.filter(d => !d.resolved).length || '—'}</td></tr>`).join('')}</tbody></table></div>`, { icon: 'list', tone: 'blue' })}</div>`;
}
function projectHero(p) {
  const ph = phaseOf(p.phase);
  const openChanges = p.changesList.filter(c => !['done', 'discarded'].includes(c.status)).length;
  return `<section class="hero" data-tone="${ph.tone}" style="margin-top:14px">
    <div class="hero-top">
      <div class="hero-title"><span class="pav lg" data-tone="${ph.tone}">${esc(p.initials)}</span><div class="grid" style="gap:6px;min-width:0"><div class="row wrap">${phaseChip(p.phase)}${chip(esc(p.version ? 'v' + String(p.version).replace(/^v/, '') : 'Sin versión'), '', 'plain')}${p.running ? chip(`${ico('loader', 'sm')}Construyendo`, 'violet') : chip('Sin construcción activa', '', 'plain')}</div><h1>${esc(p.short)}</h1></div></div>
      <button type="button" class="switcher" data-action="projects" aria-haspopup="dialog">${ico('folder')}<span><b>Cambiar proyecto</b><small>${PROJECTS.length} proyectos</small></span>${ico('chevD', 'sm')}</button>
    </div>
    ${p.subtitle ? `<div><p class="hero-sub ${UI.subtitleOpen ? '' : 'clamp-2'}" id="hero-sub">${inl(p.subtitle)}</p>${p.subtitle.length > 180 ? `<button type="button" class="link" data-action="toggle-sub" aria-controls="hero-sub" aria-expanded="${UI.subtitleOpen}" style="margin-top:4px">${UI.subtitleOpen ? 'Ver menos' : 'Leer completo'}</button>` : ''}</div>` : ''}
    <div class="hero-stats">
      ${p.counts.orders ? `<div class="row">${ring(p.pct, p.pct === 100 ? 'green' : ph.tone, 'lg')}<div class="st"><b>${p.counts.done}/${p.counts.orders}</b><small>work orders verificados</small></div></div>` : `<div class="st"><b>—</b><small>Plan aún sin work orders</small></div>`}
      <div class="st"><b>${p.counts.frds}</b><small>FRDs</small></div><div class="st"><b>${p.counts.docs}</b><small>documentos</small></div><div class="st"><b>${p.adrs.length}</b><small>ADRs</small></div><div class="st"><b>${openChanges}</b><small>cambios abiertos</small></div><div class="st"><b>${esc(agoText(daysAgo(HEALTH?.lastActivity?.[p.id])))}</b><small>último movimiento</small></div>
    </div>
    ${stepper(p.phase)}
  </section>`;
}
/** One-line project header for every section except Resumen, so the content starts near the top. */
function compactHero(p) {
  const ph = phaseOf(p.phase);
  return `<section class="hero compact" data-tone="${ph.tone}" style="margin-top:14px"><div class="row grow" style="gap:14px"><span class="pav md" data-tone="${ph.tone}">${esc(p.initials)}</span><div class="grid" style="gap:4px;min-width:0"><h1>${esc(p.short)}</h1><div class="row wrap" style="gap:6px">${phaseChip(p.phase)}${p.counts.orders ? `<span class="small faint">${p.counts.done}/${p.counts.orders} WO · ${p.pct}%</span>` : '<span class="small faint">Sin work orders</span>'}</div></div></div><div class="compact-step">${stepper(p.phase, true)}</div><button type="button" class="switcher" data-action="projects" aria-haspopup="dialog">${ico('folder')}<span><b>Cambiar proyecto</b><small>${PROJECTS.length} proyectos</small></span>${ico('chevD', 'sm')}</button></section>`;
}
function openPicker() {
  const cur = P('project');
  dialog('Cambiar de proyecto', `<label class="field">${ico('search', 'sm')}<input id="project-search" type="search" placeholder="Buscar proyecto…" aria-label="Buscar proyecto" autocomplete="off"></label>
    <div class="divided" style="border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden">${BY_RECENT.map(p => `<a class="lrow" href="${href('portfolio', { project: p.id, tab: state.screen === 'portfolio' ? P('tab') : '' })}" data-close-dialog data-project-match="${esc(p.short.toLowerCase())}" ${p.id === cur ? 'aria-current="true"' : ''}><span class="pav md" data-tone="${p.tone}">${esc(p.initials)}</span><div class="grow"><strong>${esc(p.short)}</strong><small>${esc(phaseOf(p.phase).label)} · ${p.counts.frds} FRDs · ${p.counts.docs} documentos · ${p.counts.orders ? `${p.counts.done}/${p.counts.orders} WO` : 'sin WOs'}</small><div style="margin-top:6px;max-width:260px">${bar(p.pct, p.tone)}</div></div>${p.id === cur ? chip(`${ico('check', 'sm')}Actual`, 'green') : ico('arrow', 'sm')}</a>`).join('')}</div>`, { tone: 'blue', kicker: 'Cartera' });
  $('#project-search')?.focus();
}

/* ---------- Resumen: the project's state at a glance, for a manager ---------- */
/** Decision entries written by the build engine (timestamped log lines) rather than questions for the owner. */
const isEngineLog = d => /^(T?\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}T)/.test(d.title.replace(/^·\s*/, '').trim());
const daysAgo = iso => iso ? Math.max(0, Math.floor((Date.parse(SNAP.capturedAt) - Date.parse(iso)) / 864e5)) : null;
const agoText = n => n == null ? 'sin registro' : n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n}\u00a0días`;
/**
 * Recent progress in plain words, from structured sources only: work orders verified (build timeline)
 * and changes filed (change queue), grouped by day, newest first. The raw engine log is not used.
 */
function recentProgress(p, limit = 6) {
  const items = [];
  const byDay = new Map();
  for (const w of (p.timeline?.frds || []).flatMap(f => f.workOrders).filter(w => w.state === 'done' && w.endMs)) {
    const day = new Date(w.endMs).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(w);
  }
  for (const [day, list] of byDay) {
    const frds = [...new Set(list.map(w => p.frds.find(f => f.group === w.frd)?.code).filter(Boolean))];
    items.push({ date: day, tone: 'green', icon: 'check', verb: plural(list.length, 'work order verificada', 'work orders verificadas'), subject: frds.join(', ') });
  }
  const CH = { building: ['En construcción', 'blue', 'loader'], ready: ['Listo para construir', 'pink', 'branch'], draft: ['Pedido (borrador)', 'slate', 'file'], done: ['Terminado', 'green', 'check'], discarded: ['Descartado', 'slate', 'x'] };
  for (const c of p.changesList.filter(c => c.date)) { const [verb, tone, icon] = CH[c.status] || ['Registrado', 'slate', 'branch']; items.push({ date: c.date, tone, icon, verb, subject: plain(c.title), attr: `data-change="${esc(p.id)}|${esc(c.id)}"` }); }
  return items.sort((x, y) => Date.parse(y.date) - Date.parse(x.date)).slice(0, limit);
}
/** One progress line: a coloured icon and a small status label carry the meaning; the text stays neutral. */
const progressItem = e => { const body = `<span class="pg-ico" data-tone="${e.tone}">${ico(e.icon, 'sm')}</span><span class="pg-main"><span class="pg-verb" data-tone="${e.tone}">${esc(e.verb)}</span><span class="pg-subj">${esc(e.subject || '')}</span></span><span class="xs faint nowrap">${esc(fmtDate(e.date))}</span>`; return `<li>${e.attr ? `<button type="button" class="pg-row" ${e.attr}>${body}${ico('chevR', 'sm')}</button>` : `<div class="pg-row">${body}</div>`}</li>`; };
/** One honest verdict for the project: what state it is in, and why, in a sentence. */
function projectVerdict(p) {
  const n = s => p.orders.filter(w => w.state === s).length;
  const mine = attentionFor(p).filter(a => a.owner !== false).length;
  const days = daysAgo(HEALTH?.lastActivity?.[p.id]);
  const open = p.changesList.filter(c => !['done', 'discarded'].includes(c.status)).length;
  const ph = phaseOf(p.phase);
  let health;
  if (mine) health = ['Espera tu decisión', 'amber', 'flag'];
  else if (p.running) health = ['Construyendo ahora', 'violet', 'loader'];
  else if (days != null && days > 7) health = ['En pausa', 'slate', 'clock'];
  else if (p.counts.orders && p.counts.done === p.counts.orders && p.phase === 'implementation') health = ['Listo para lanzar', 'green', 'rocket'];
  else health = ['Avanzando', 'green', 'activity'];
  const parts = [];
  if (p.counts.orders) {
    parts.push(`${ph.label} al ${p.pct} %: ${p.counts.done} de ${p.counts.orders} work orders verificadas.`);
    const left = p.counts.orders - p.counts.done;
    if (left) parts.push(n('review') === left ? `Las ${left} restantes ya están construidas y esperan la revisión de su FRD.` : `Faltan ${left}: ${[n('review') && `${n('review')} en revisión`, n('in_progress') && `${n('in_progress')} en curso`, n('todo') && `${n('todo')} por empezar`, n('fail') && `${n('fail')} con fallos`].filter(Boolean).join(', ')}.`);
  } else parts.push(`Fase de ${ph.label.toLowerCase()}: el plan de construcción todavía no tiene work orders.`);
  if (open) parts.push(`${plural(open, 'cambio abierto', 'cambios abiertos')}.`);
  parts.push(mine ? `${plural(mine, 'cosa espera', 'cosas esperan')} tu decisión.` : 'Nada espera tu decisión.');
  return { health, text: parts.join(' '), days };
}
function summaryView(p) {
  const v = projectVerdict(p);
  const ov = p.overlay;
  const mine = attentionFor(p).filter(a => a.owner !== false);
  const decisions = p.decisions.filter(d => !isEngineLog(d));
  const hidden = p.decisions.length - decisions.length;
  const next = (p.commands || [])[0];
  const frds = [...p.frds].sort((a, b) => (a.orders.length && a.done === a.orders.length) - (b.orders.length && b.done === b.orders.length));
  const progress = recentProgress(p);
  return `<div class="stack lg">
    ${ov?.reason === 'behind' ? `<section class="notice upgrade" data-tone="amber" aria-label="Actualización pendiente">${ico('alert')}<div class="grow"><b>Este proyecto usa una versión vieja del motor de Pandacorp</b><p class="small">Va con la v${esc(ov.projectVersion)} y la fábrica ya está en la v${esc(ov.factoryVersion)}. Actualízalo para que el próximo build use las reglas y herramientas nuevas${p.running ? ' (espera a que termine el build en curso)' : ''}.</p></div><div class="pa-cmd" style="margin:0">${cmd(ov.upgradeCommand)}<span class="xs faint">Córrelo en la carpeta de ${esc(p.short)}</span></div></section>` : ''}
    ${next ? `<div class="pst-next row wrap" style="gap:8px;align-items:center;justify-content:flex-end"><span class="small"><b>Siguiente paso:</b> <span class="muted">${esc(next.when)}</span></span>${cmd(next.command)}</div>` : ''}
    ${fraguaScene(p, v)}
    <div class="grid-2 sum-cols">
      <div class="stack lg">${card(`Avance por FRD <span class="chip" data-tone="violet">${p.frds.length}</span>`, p.frds.length ? `<p class="small muted card-intro">Primero lo que falta terminar.</p><div class="stack sm">${frds.slice(0, 8).map(f => frdProgressLine(p, f)).join('')}</div>${p.frds.length > 8 ? `<div class="card-foot"><span class="small faint">${p.frds.length} FRDs en total</span><button type="button" class="link" data-tone="green" data-tab-jump="Observabilidad">Ver todos ${ico('arrow', 'sm')}</button></div>` : ''}` : empty('Aún no hay FRDs publicados.'), { icon: 'clipboard', tone: 'violet' })}
        ${card('Decisiones', `${decisions.length ? `<div class="divided">${decisions.map(d => `<button type="button" class="lrow" data-decision="${esc(p.id)}|${esc(d.id)}"><span class="badge-icon sm" data-tone="${d.resolved ? 'green' : 'amber'}">${ico(d.resolved ? 'check' : 'flag', 'sm')}</span><div class="grow"><strong>${inl(d.title.replace(/^·\s*/, ''))}</strong><small>${esc(fmtDate(d.date))} · ${d.resolved ? 'Resuelta' : 'Pendiente'}</small></div>${ico('chevR', 'sm')}</button>`).join('')}</div>` : `<p class="small muted">Sin decisiones tuyas registradas.</p>`}${hidden ? `<p class="xs faint" style="margin-top:8px">${plural(hidden, 'entrada automática del motor oculta', 'entradas automáticas del motor ocultas')} (no son preguntas para ti).</p>` : ''}`, { icon: 'flag', tone: 'amber' })}
      </div>
      <div class="stack lg sum-act">
        ${card(`Tu turno ${mine.length ? `<span class="chip" data-tone="amber">${mine.length}</span>` : ''}`, mine.length ? ownerTurn(mine, { showProject: false }) : `<p class="small muted row" style="gap:8px">${ico('check', 'sm')}Nada espera tu acción en este proyecto.</p>`, { icon: 'target', tone: 'amber' })}
        ${card('Últimos avances', progress.length ? `<ul class="progress-list">${progress.map(progressItem).join('')}</ul>` : `<p class="small muted">Sin avances registrados todavía.</p>`, { icon: 'activity', tone: 'teal' })}
      </div>
    </div>
    ${(p.activity?.entries || []).length ? `<details class="card"><summary class="row between" style="cursor:pointer;list-style:none"><h2 class="row"><span class="badge-icon sm" data-tone="slate">${ico('terminal', 'sm')}</span>Bitácora técnica del motor <span class="chip" data-tone="slate">${p.activity.entries.length}</span></h2><span class="row small muted"><span class="hide-sm">Notas en crudo del build</span>${ico('chevD', 'sm')}</span></summary><div class="feed" style="margin-top:12px">${p.activity.entries.map(text => feedEntry({ p, text: typeof text === 'string' ? text : (text.text || '') }, false)).join('')}</div></details>` : ''}
  </div>`;
}
function frdProgressLine(p, f) {
  return `<button type="button" class="lrow" style="min-height:48px" data-frd-jump="${esc(f.group)}"><div class="grow"><strong style="font-size:14px"><span class="mono faint" style="font-size:12px;margin-right:6px">${f.code}</span>${esc(f.title)}</strong><div style="margin-top:6px">${stackbar(f.orders)}</div></div><span class="small faint nowrap frd-count">${f.done}/${f.orders.length}</span></button>`;
}
function stackbar(orders) {
  const order = ['done', 'review', 'in_progress', 'fail', 'todo'];
  const total = orders.length || 1;
  return `<div class="stackbar" role="img" aria-label="${order.map(s => `${orders.filter(w => w.state === s).length} ${stateOf(s).label.toLowerCase()}`).join(', ')}">${order.map(s => { const n = orders.filter(w => w.state === s).length; return n ? `<span data-tone="${stateOf(s).tone}" style="flex:${n / total}"></span>` : ''; }).join('')}</div>`;
}

/* ---------- Spec ---------- */
function blockTone(label) {
  if (/problema/i.test(label)) return ['coral', 'alert'];
  if (/hipótesis|valor|diferenciador/i.test(label)) return ['green', 'sparkles'];
  if (/métrica|éxito/i.test(label)) return ['teal', 'gauge'];
  if (/decisi/i.test(label)) return ['amber', 'flag'];
  if (/fuera/i.test(label)) return ['slate', 'x'];
  if (/^alcance/i.test(label)) return ['blue', 'check'];
  if (/usuario/i.test(label)) return ['violet', 'users'];
  if (/hallazgo|referente|research|competen|mercado/i.test(label)) return ['teal', 'search'];
  return ['blue', 'book'];
}
function docBtn(p, d, label, ctx) {
  if (!d) return '';
  const t = DOC_TYPES[docType(d)];
  return `<button type="button" class="btn sm toned" data-tone="${t.tone}" data-open-doc="${esc(d.id)}" data-ctx="${ctx?.screen || 'portfolio'}">${ico(t.icon, 'sm')}${esc(label)}</button>`;
}


/* ================= Digests: Propuesta, Spec, Arquitectura =================
   Same structure and data as the current app (IdeaPitch, SpecDigest, ArchitectureDigest):
   a hero, full-width tinted bands and label | content rows, restyled in the Órbita system. */
const MODALS = [];
/** A button that opens a registered modal; `opts` carries the dialog's tone and kicker so the modal keeps its tab's colours. */
function modalBtn(label, title, html, cls = 'link small', opts = {}) {
  MODALS.push({ title, html, opts });
  return `<button type="button" class="${cls}" data-modal="${MODALS.length - 1}">${label}</button>`;
}
/** Full-width section of a report page; its header is the same as a card's (tinted icon, display title, optional action). */
const band = (tone, icon, title, body, id = '') => {
  const [raw, action = ''] = title.split('<span class="grow"></span>');
  const head = raw.replace(/ · (\d+)$/, ' <span class="chip">$1</span>');
  return `<section class="band" data-tone="${tone}" ${id ? `id="${id}"` : ''}><div class="card-head band-head"><h2><span class="badge-icon sm">${ico(icon, 'sm')}</span>${head}</h2>${action}</div>${body}</section>`;
};
const brow = (label, content, cls = '') => `<div class="brow ${cls}"><span class="brow-label">${label}</span><div class="brow-body">${content}</div></div>`;
const digestHero = (eyebrow, title, lead, chips) => `<header class="dhero"><span class="eyebrow">${eyebrow}</span>${title ? `<h2>${title}</h2>` : ''}${lead ? `<div class="dhero-lead">${lead}</div>` : ''}${chips ? `<div class="row wrap" style="gap:6px">${chips}</div>` : ''}</header>`;
const BADGE_TONE = { warn: 'amber', info: 'blue', pain: 'coral', neutral: '', build: 'green' };
const SCORE_TONE = { high: 'green', mid: 'amber', low: 'coral' };
const SCORE_WIDTH = { high: 92, mid: 55, low: 25 };

/* ---------- Propuesta ---------- */
function pitchView(i, p) {
  const pt = i.pitch;
  const typeChips = `${chip(`${ico('cube', 'sm')}${esc(i.category || 'Sin tipo')}`, '', 'plain')}${p?.targetPlatforms ? chip(`${ico('columns', 'sm')}${esc(p.targetPlatforms[0].toUpperCase() + p.targetPlatforms.slice(1))}`, '', 'plain') : ''}`;
  if (!pt) return `<div class="stack lg">${digestHero('Memo-pitch de idea', esc(i.title), '', typeChips)}<article class="paper" data-tone="blue"><div class="md" data-tone="blue">${i.html || '<p>Sin contenido.</p>'}</div></article></div>`;
  const badges = pt.badges.filter(b => b.tone !== 'build').map(b => chip(esc(b.label), BADGE_TONE[b.tone] || '', BADGE_TONE[b.tone] ? '' : 'plain')).join('');
  const glanceRow = g => {
    if (g.kind === 'problema') return brow(esc(g.label), `<div class="md compact">${g.proseHtml}</div>${g.quoteHtml ? `<blockquote class="pquote">${g.quoteHtml}</blockquote>` : ''}`);
    if (g.kind === 'vision' && g.features?.length >= 2) return brow(esc(g.label), `<div class="feats">${g.features.map(f => `<div class="feat"><b>${inl(f.title)}</b><span>${inl(f.desc)}</span></div>`).join('')}</div>${g.checks?.length ? `<div class="mock"><div class="mock-bar"><span></span><span></span><span></span>${g.previewUrl ? `<em>${esc(g.previewUrl)}</em>` : ''}</div>${g.checks.map(c => `<div class="mock-item" data-tone="${c.ok ? 'green' : 'coral'}"><span>${c.ok ? '✓' : '!'}</span>${inl(c.text)}</div>`).join('')}</div>` : ''}`);
    return brow(esc(g.label), `<div class="md compact">${g.html}</div>`);
  };
  const deepRow = d => {
    if (d.kind === 'premortem') return brow(esc(d.heading), `<div class="pbox" data-tone="coral"><div class="md compact">${d.html}</div></div>`);
    if (d.kind === 'ask') return brow(esc(d.heading), `<div class="pbox" data-tone="blue"><div class="md compact">${d.html}</div></div>`);
    if (d.kind === 'risks') return brow(esc(d.heading), `<div class="md compact">${d.html}</div><div class="risks">${d.risks.map(r => `<div class="risk"><div data-tone="coral">${r.riskHtml}</div><div data-tone="green"><p><b>Mitigación</b></p>${r.mitigationHtml}</div></div>`).join('')}</div>`);
    return brow(esc(d.heading), `<div class="md compact ${d.kind === 'legal' ? 'legal' : ''}">${d.html}</div>`);
  };
  const evidence = pt.deep.find(d => d.kind === 'evidence');
  const ex = (() => { const e = pt.scorecard.find(a => /esfuerzo/i.test(a.axis)); const t = (e?.value || '').toLowerCase(); return /micro/.test(t) ? 0.22 : /peque|small|1-2|semana/.test(t) ? 0.5 : /grande|large|mes/.test(t) ? 0.82 : 0.5; })();
  const vy = (() => { const axes = pt.scorecard.filter(a => /founder-fit|demanda|retorno/i.test(a.axis)); const v = { high: 1, mid: 0.55, low: 0.25 }; return axes.length ? axes.reduce((s, a) => s + (v[a.level] ?? 0.55), 0) / axes.length : 0.55; })();
  const cx = 44 + ex * 316, cy = 14 + (1 - vy) * 166;
  return `<div class="digest">
    ${digestHero('Memo-pitch de idea', '', '', typeChips + badges)}
    ${band('teal', 'flame', 'De un vistazo · el sueño', pt.glance.map(glanceRow).join(''))}
    ${band('blue', 'layers', 'Profundizar · el criterio', pt.deep.filter(d => d.kind !== 'evidence').map(deepRow).join(''))}
    ${pt.scorecard.length ? band('violet', 'gauge', 'El tablero de decisión', `<div class="board-panels"><section class="gcard"><h3>Scorecard</h3>${pt.scorecard.map(a => `<div class="score"><span class="mono">${esc(a.axis)}</span><span class="score-bar"><i data-tone="${SCORE_TONE[a.level]}" style="width:${SCORE_WIDTH[a.level]}%"></i></span><span class="xs muted">${esc(a.value)}</span></div>`).join('')}</section>
      <section class="gcard"><h3>Esfuerzo vs. valor</h3><svg class="effort" viewBox="0 0 380 220" role="img" aria-label="Esfuerzo frente a valor: la idea está en esfuerzo ${Math.round(ex * 100)} % y valor ${Math.round(vy * 100)} %"><rect x="44" y="14" width="150" height="80" rx="6" class="sweet"/><text x="54" y="32" class="sweet-t">★ zona ideal</text><line x1="44" y1="180" x2="360" y2="180" class="axis"/><line x1="44" y1="14" x2="44" y2="180" class="axis"/><circle cx="${cx}" cy="${cy}" r="9" class="dot"/><text x="${cx + 14}" y="${cy + 5}" class="dot-t">esta idea</text><text x="70" y="198" class="tick">MICRO</text><text x="180" y="198" class="tick">PEQUEÑA</text><text x="300" y="198" class="tick">GRANDE</text><text x="200" y="214" class="cap">← más fácil · esfuerzo · más complejo →</text><text x="20" y="110" class="cap" transform="rotate(-90 20 110)">valor →</text></svg></section></div>
      ${evidence ? `<details class="evidence"><summary class="link small">Evidencia y fuentes (lo que sostiene este memo)</summary><div class="md compact" style="margin-top:10px">${evidence.html}</div></details>` : ''}`) : ''}
  </div>`;
}

/* ---------- Spec ---------- */
function specBlock(b) {
  const items = b.items || [];
  switch (b.kind) {
    case 'bullets': return `<ul class="sbul">${items.map(it => `<li><b>${inl(it.title)}</b>${it.desc ? ` — ${inl(it.desc)}` : ''}</li>`).join('')}</ul>`;
    case 'highlight': return `<div class="pbox" data-tone="blue"><div class="md compact">${b.html}</div></div>`;
    case 'roles': return `<div class="feats">${items.map(it => `<div class="feat"><b>${inl(it.title)}</b><span>${inl(it.desc)}</span></div>`).join('')}</div>`;
    case 'metrics': return `<div class="feats">${items.map(it => `<div class="feat metric"><b>${inl(it.title)}</b><span>${inl(it.desc)}</span></div>`).join('')}</div>`;
    case 'chips': return `<ul class="checks">${items.map(it => `<li>${inl(it.title)}${it.desc ? ` — ${inl(it.desc)}` : ''}</li>`).join('')}</ul>`;
    case 'chips-muted': return `<div class="row wrap" style="gap:6px">${items.map(it => `<span class="muted-pill">${inl(it.title)}</span>`).join('')}</div>`;
    case 'decisions': return `<div class="pbox" data-tone="amber"><ul class="decs">${items.map(it => `<li><b>${inl(it.title)}</b>${it.desc ? ` — ${inl(it.desc)}` : ''}</li>`).join('')}</ul></div>`;
    case 'refs': return `<div class="feats">${items.map(it => `<div class="feat ref"><b>${inl(it.title)}</b><span>${inl(it.desc)}</span></div>`).join('')}</div>`;
    default: return `<div class="md compact">${b.html || `<p>${esc(b.markdown || '')}</p>`}</div>`;
  }
}
/** FRD kind tag colours: one hue per kind so the tag reads at a glance. */
const TAG_TONE = { UI: 'pink', Infra: 'slate', Tool: 'teal', CLI: 'teal', API: 'blue', Data: 'gold' };
/**
 * The FRD's kind tag: the spec heading's tag when the spec lists the FRD; otherwise the FRD's own
 * frontmatter `ui:` flag (marked as derived), so a newer FRD the spec doesn't list yet still says what it is.
 */
function frdTag(p, f) {
  const s = (p.spec?.parsed?.frds || []).find(x => x.id === f.code);
  if (s?.tag) return { tag: s.tag, derived: false };
  const ui = /^ui:\s*(true|false)\s*$/m.exec(f.doc?.body || '');
  return ui ? { tag: ui[1] === 'true' ? 'UI' : 'Infra', derived: true } : null;
}
const tagChip = t => t ? `<span class="chip kind-tag" data-tone="${TAG_TONE[t.tag] || 'slate'}" ${t.derived ? 'title="Tomado del frd.md (ui:); el spec todavía no lista este FRD"' : ''}>${esc(t.tag)}</span>` : '';
/** Work-order progress only means something once the build has started (in Portfolio or on the board). */
const buildStarted = p => ['implementation', 'release'].includes(p.phase) || p.orders.some(w => w.state !== 'todo');
function frdDetail(p, f, ctx, { blueprint = false } = {}) {
  const s = (p.spec?.parsed?.frds || []).find(x => x.id === f.code) || {};
  const row = (tone, label, content) => `<div class="brow" data-tone="${tone}"><span class="brow-label">${label}</span><div class="brow-body">${content}</div></div>`;
  const list = (tone, t, xs) => xs?.length ? row(tone, t, `<ul class="sbul">${xs.map(x => `<li>${inl(x)}</li>`).join('')}</ul>`) : '';
  return `<div class="dsheet">${s.overview || f.summary ? row('violet', 'Visión', `<p>${inl(s.overview || f.summary)}</p>`) : ''}${blueprint && f.blueprint ? row('teal', 'Implementación', `<p>${inl(f.blueprint)}</p>`) : ''}${list('blue', 'Historias de usuario', s.userStories)}${list('green', 'Reglas de negocio', s.businessRules)}${list('slate', 'Fuera de alcance', s.outOfScope)}${list('amber', 'Preguntas abiertas', s.openQuestions)}
    ${f.orders.length && buildStarted(p) ? row('violet', 'Work orders', `<div class="row" style="gap:8px">${stackbar(f.orders)}<span class="xs muted nowrap">${f.done}/${f.orders.length} verificados</span></div>`) : ''}</div>
    <div class="row wrap">${docBtn(p, f.doc, 'Contrato', ctx)}${docBtn(p, f.fdd, 'Diseño', ctx)}${docBtn(p, f.blue, 'Blueprint', ctx)}${f.orders.length ? `<button type="button" class="btn sm" data-frd-jump="${esc(f.group)}" data-project="${esc(p.id)}">${ico('clipboard', 'sm')}Ver work orders</button>` : ''}</div>`;
}
const frdCards = (p, ctx, opts = {}) => `<div class="frd-cards">${p.frds.map(f => { return `<article class="frdc" data-tone="violet"><div class="row between"><span class="fcode" data-tone="violet">${f.code}</span>${tagChip(frdTag(p, f))}</div>${modalBtn(esc(f.title), esc(f.title), frdDetail(p, f, ctx, opts), 'frdc-open', { tone: 'violet', kicker: `${f.code} · ${opts.blueprint ? 'Plan de implementación' : 'Spec'}` })}${f.summary ? `<span class="small muted">${esc(f.summary)}</span>` : ''}${f.orders.length && buildStarted(p) ? `<div class="row" style="gap:8px">${stackbar(f.orders)}<span class="xs faint nowrap">${f.done}/${f.orders.length}</span></div>` : f.orders.length ? `<span class="xs faint">${plural(f.orders.length, 'work order planificada', 'work orders planificadas')}</span>` : ''}</article>`; }).join('')}</div>`;
function specView(p, ctx) {
  if (!p) return empty('Esta idea todavía no tiene proyecto.');
  const data = p.spec?.parsed;
  const prd = getDoc(p, 'docs/product/prd.md'), research = getDoc(p, 'docs/product/research.md');
  if (!data?.hasContent) return `<div class="stack lg"><div class="notice" data-tone="slate">${ico('layers')}<div class="grow"><b>El spec todavía no está publicado.</b><p class="small muted">Su PRD y sus FRDs reales siguen disponibles.</p><div class="row wrap" style="margin-top:8px">${docBtn(p, prd, 'PRD completo', ctx)}${docBtn(p, research, 'Research', ctx)}</div></div></div>${p.frds.length ? band('violet', 'book', `FRDs · las piezas del v1 (${p.frds.length})`, frdCards(p, ctx)) : ''}</div>`;
  const chips = `${chip(`fase · ${esc(data.fase || phaseOf(p.phase).label)}`, 'blue')}${p.idea?.category ? chip(`${ico('cube', 'sm')}${esc(p.idea.category)}`, '', 'plain') : ''}${p.targetPlatforms ? chip(esc(p.targetPlatforms[0].toUpperCase() + p.targetPlatforms.slice(1)), '', 'plain') : ''}`;
  return `<div class="digest">
    ${digestHero('Resumen del spec', esc(data.proyecto || p.short), `<p>${inl(data.intro || p.subtitle)}</p>`, chips)}
    ${data.prd ? band('blue', 'flag', `PRD · qué y por qué <span class="grow"></span>${docBtn(p, prd, 'PRD completo', ctx)}`, data.prd.blocks.map(b => brow(esc(b.label), specBlock(b))).join('')) : ''}
    ${data.research ? band('teal', 'search', `Research · la evidencia <span class="grow"></span>${docBtn(p, research, 'Research completo', ctx)}`, data.research.blocks.map(b => brow(esc(b.label), specBlock(b))).join('')) : ''}
    ${band('violet', 'book', `FRDs · las piezas del v1 (${p.frds.length})`, frdCards(p, ctx))}
  </div>`;
}

/* ---------- Arquitectura ---------- */
function architectureView(p, ctx) {
  if (!p) return empty('Esta idea todavía no tiene documentos de arquitectura.');
  const a = p.architecture?.parsed;
  const doc = getDoc(p, 'docs/product/architecture.md');
  if (!a && p.model.kind === 'missing') return `<div class="stack">${empty('La arquitectura todavía no está publicada.', 'cube')}${doc ? docBtn(p, doc, 'Abrir el documento técnico', ctx) : ''}</div>`;
  const chips = `${a?.host ? chip(`${ico('cube', 'sm')}${esc(a.host)}`, '', 'plain') : ''}${a?.coste ? chip(esc(a.coste), 'green') : ''}${chip(`fase · ${esc(phaseOf(p.phase).label)}`, phaseOf(p.phase).tone)}${p.targetPlatforms ? chip(esc(p.targetPlatforms[0].toUpperCase() + p.targetPlatforms.slice(1)), '', 'plain') : ''}`;
  const envVars = p.envVars || (p.envNames || []).map(name => ({ name, comment: '' }));
  return `<div class="digest">
    ${digestHero('Arquitectura', esc(a?.proyecto || p.short), `${a?.stack ? `<p class="dhero-stack">${inl(a.stack)}</p>` : ''}${a?.intro ? `<p>${inl(a.intro)}</p>` : ''}`, chips)}
    ${a?.stackRows?.length ? band('blue', 'layers', 'Stack y tecnologías', `<p class="small muted band-note">Qué tecnologías se usarán para construir la aplicación y por qué se eligieron.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Stack y tecnologías"><table class="t t-cards stack-t"><thead><tr><th scope="col">Capa</th><th scope="col">Elección</th><th scope="col">Por qué</th></tr></thead><tbody>${a.stackRows.map(r => `<tr><td class="muted" data-span="full">${inl(r.capa)}</td><td data-span="full"><b>${inl(r.eleccion)}</b></td><td class="muted" data-span="full">${inl(r.porque)}</td></tr>`).join('')}</tbody></table></div>`, 'g-stack') : ''}
    ${a?.services?.length ? band('teal', 'bolt', 'Integraciones y operación', `<p class="small muted band-note">Cómo se conectan y operan las piezas del sistema: flujos, responsabilidades y límites.</p><ul class="sbul">${a.services.map(s => `<li><b>${inl(s.title)}</b> — ${inl(s.desc)}</li>`).join('')}</ul>`, 'g-services') : ''}
    ${band('blue', 'database', 'Modelo de datos', `${a?.dataModel?.note ? `<p class="small muted band-note">${inl(a.dataModel.note)}</p>` : ''}${modelView(p)}`, 'g-data')}
    ${band('pink', 'terminal', `Variables de entorno · ${envVars.length}`, envVars.length ? envView(envVars) : empty('No hay variables documentadas.', 'terminal'), 'g-env')}
    ${band('gold', 'shield', `Decisiones · ${p.adrs.length}`, p.adrs.length ? `<ul class="adrs">${p.adrs.map(adr => `<li>${modalBtn(`<span class="fcode" data-tone="amber">${esc(String(adr.id).replace(/^ADR-?/i, 'ADR-'))}</span><span class="grow"><b>${inl(adr.title || adr.id)}</b>${adr.decision ? `<span class="xs muted clamp-1">${inl(adr.decision)}</span>` : ''}</span>${ico('chevR', 'sm')}`, esc(adr.title || adr.id), `<div class="md" data-tone="amber">${adr.html}</div>`, 'adr-row', { tone: 'amber', kicker: esc(String(adr.id).replace(/^ADR-?/i, 'ADR-')) })}</li>`).join('')}</ul>` : empty('No hay ADRs publicados.', 'shield'), 'g-adrs')}
    ${band('violet', 'clipboard', 'Plan de implementación', `${p.orders.length && !buildStarted(p) ? `<p class="small muted band-note">${plural(p.orders.length, 'work order planificada', 'work orders planificadas')} en ${plural(p.frds.filter(f => f.orders.length).length, 'FRD', 'FRDs')}. Su avance aparece aquí cuando empiece la construcción.</p>` : p.orders.length ? `<p class="small muted band-note">Cada fila es un FRD y cada cuadro una work order, por su estado; en la app real este bloque es el grafo interactivo de dependencias.</p><div class="mosaic">${p.frds.filter(f => f.orders.length).map(f => `<div class="mos-row"><span class="name" title="${esc(f.title)}"><b>${f.code}</b>${esc(f.title)}</span><div class="tiles">${f.orders.map(w => `<button type="button" class="tile" data-tone="${stateOf(w.state).tone}" data-wo="${esc(w.id)}" data-project="${esc(p.id)}" aria-label="${esc(w.id)}: ${esc(stateOf(w.state).label)}" title="${esc(w.id)} · ${esc(plain(w.short))}"></button>`).join('')}</div></div>`).join('')}</div>` : '<p class="small muted band-note">El plan todavía no tiene work orders publicadas.</p>'}${p.orders.length && buildStarted(p) ? '<p class="band-sub">Por FRD</p>' : ''}${frdCards(p, ctx, { blueprint: true })}`, 'g-plan')}
  </div>`;
}
const woRowLink = p => w => `<button type="button" class="worow" data-wo="${esc(w.id)}" data-project="${esc(p.id)}"><span class="wid">${esc(w.id)}</span><span class="wt">${inl(w.short)}</span>${stateChip(w.state)}<span class="wdeps"></span></button>`;

/* ---------- Cuentas (workspace) ---------- */
const SERVICE_STATUS = { configured: ['Configurado', 'green'], active: ['Activo', 'green'], planned: ['Planificado', 'amber'], pending: ['Pendiente', 'amber'], proposed: ['Propuesto', 'amber'], candidate: ['Candidato', 'slate'], inactive: ['Inactivo', 'slate'] };
const SERVICE_ICON = { database: 'database', authentication: 'lock', storage: 'archive', hosting: 'cube', email: 'inbox', analytics: 'activity', monitoring: 'eye', payments: 'bolt' };
// Environments are one category, so one hue: green/amber/red stay reserved for status.
const ENV_TONE = 'teal';
/** Accounts: which service each part of the project runs on, which user to sign in with, and where. */
/** Status order for the Accounts table: what is live first, then what is planned, then what is off. */
const SERVICE_RANK = { configured: 0, active: 0, proposed: 1, planned: 1, pending: 1, candidate: 1, inactive: 2 };
function accountsView(p) {
  const services = [...(p.services || [])].sort((a, b) => (SERVICE_RANK[a.status] ?? 1.5) - (SERVICE_RANK[b.status] ?? 1.5) || String(a.provider).localeCompare(String(b.provider), 'es'));
  if (!services.length) return empty('Este proyecto no tiene servicios asignados en el directorio de la fábrica.', 'users');
  return `<div class="stack lg"><p class="small muted">Servicios externos del proyecto según el directorio de la fábrica: para qué sirve cada uno, con qué usuario entrar y en qué entornos tiene recursos. Clic en el nombre para abrir su panel y en el usuario para copiarlo. Las credenciales nunca se muestran.</p>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Servicios del proyecto"><table class="t acc-table"><thead><tr><th scope="col">Servicio</th><th scope="col">Para qué</th><th scope="col">Usuario</th><th scope="col">Entornos</th><th scope="col">Estado</th></tr></thead><tbody>${services.map(s => { const [label, tone] = SERVICE_STATUS[s.status] || [s.status, 'slate']; const name = `${ico(SERVICE_ICON[s.type] || 'cube', 'sm')}<b>${esc(s.provider)}</b>`; return `<tr><td data-label="Servicio">${s.url ? `<a class="acc-name" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="Abrir el panel de ${esc(s.provider)} en una pestaña nueva">${name}<span class="sr-only"> (se abre en una pestaña nueva)</span></a>` : `<span class="acc-name">${name}</span>`}</td><td class="muted" data-label="Para qué">${esc(s.purpose || s.type || '')}</td><td data-label="Usuario">${s.account?.login ? `<button type="button" class="copy-text mono small" data-copy="${esc(s.account.login)}" aria-label="Copiar el usuario de ${esc(s.provider)}: ${esc(s.account.login)}" data-hint="Copiar">${esc(s.account.login)}</button>` : '<span class="faint">—</span>'}</td><td data-label="Entornos"><div class="env-chips">${s.environments.map(e => `<span class="chip" data-tone="${ENV_TONE}" title="${esc(e.resource || '')}">${esc(e.environment)}</span>`).join('') || '<span class="faint">—</span>'}</div></td><td data-label="Estado"><span class="state-dot" data-tone="${tone}"><span class="dot"></span>${esc(label)}</span></td></tr>`; }).join('')}</tbody></table></div></div>`;
}

/**
 * Environment variables as label | content rows, like the Spec's opening rows: the name on the left,
 * what it is for on the right. A `--- Group ---` header in a comment opens a new group. A variable
 * with no comment of its own says so instead of borrowing another's.
 */
function envView(envVars) {
  const groups = [];
  for (const v of envVars) {
    const m = /^---\s*(.+?)\s*---\s*(.*)$/s.exec(v.comment || '');
    if (m || !groups.length) groups.push({ title: m ? m[1] : '', vars: [] });
    groups[groups.length - 1].vars.push({ name: v.name, text: m ? m[2] : v.comment || '' });
  }
  const missing = groups.flatMap(g => g.vars).filter(v => !v.text.trim()).length;
  const row = v => `<div class="envrow"><code class="env-name">${esc(v.name)}</code><div class="env-text">${v.text ? inl(v.text) : `<span class="env-missing">${ico('alert', 'sm')}Sin descripción en <code>.env.example</code></span>`}</div></div>`;
  return `<div class="row wrap band-note"><p class="small muted grow">Qué es y para qué sirve cada variable, según <code>.env.example</code>. Los valores nunca se muestran.</p>${missing ? chip(`${ico('alert', 'sm')}${missing} de ${envVars.length} sin descripción`, 'amber') : chip(`${ico('check', 'sm')}Todas descritas`, 'green')}</div>
    ${envVars.length > 12 && groups.length > 1
      // Long inventories fold by group so the section stays scannable; the count says what each fold holds.
      ? `<div class="env-folds">${groups.map((g, k) => `<details class="env-fold" ${k === 0 ? 'open' : ''}><summary>${ico('chevR', 'sm chev')}<span class="grow">${g.title ? inl(g.title) : 'General'}</span><span class="chip" data-tone="pink">${g.vars.length}</span>${g.vars.some(v => !v.text.trim()) ? `<span class="chip" data-tone="amber">${ico('alert', 'sm')}${g.vars.filter(v => !v.text.trim()).length}</span>` : ''}</summary><div class="envrows">${g.vars.map(row).join('')}</div></details>`).join('')}</div>`
      : groups.map(g => `${g.title ? `<p class="band-sub env-group">${inl(g.title)}</p>` : ''}<div class="envrows">${g.vars.map(row).join('')}</div>`).join('')}`;
}

/* ---------- Documentos (board): curated rail + reader, as in the app ---------- */
const narrowDocs = () => matchMedia('(max-width: 899px)').matches;
function ideaDocsView(i, p, ctx) {
  if (!p) return empty('Esta idea todavía no tiene proyecto ni documentos.', 'file');
  const sections = [
    ['Documentos', [{ id: 'resumen', label: 'Resumen' }]],
    ['Producto', [getDoc(p, 'docs/product/prd.md') && { id: getDoc(p, 'docs/product/prd.md').id, label: 'PRD' }, getDoc(p, 'docs/product/research.md') && { id: getDoc(p, 'docs/product/research.md').id, label: 'Investigación' }].filter(Boolean)],
    ...p.frds.map(f => [`${f.code} · ${f.title}`, [f.doc && { id: f.doc.id, label: 'Contrato (frd.md)' }, f.fdd && { id: f.fdd.id, label: 'Diseño (fdd.md)' }, f.blue && { id: f.blue.id, label: 'Implementación (blueprint.md)' }].filter(Boolean)]),
  ].filter(([, items]) => items.length);
  const cur = P('doc') || 'resumen';
  const doc = cur === 'resumen' ? null : p.docs.find(d => d.id === cur);
  const body = doc ? doc.html : i.html;
  const t = doc ? DOC_TYPES[docType(doc)] : { tone: 'teal' };
  const secTone = title => title === 'Documentos' ? 'teal' : title === 'Producto' ? 'blue' : 'violet';
  const rail = `<nav class="idocs-rail" aria-label="Documentos de la idea">${sections.map(([title, items]) => `<p class="idocs-sec" data-tone="${secTone(title)}">${esc(title)}</p>${items.map(it => `<button type="button" class="idocs-item" data-tone="${secTone(title)}" data-idoc="${esc(it.id)}" ${it.id === cur ? 'aria-current="page"' : ''}>${ico('file', 'sm')}<span>${esc(it.label)}</span></button>`).join('')}`).join('')}</nav>`;
  return `<div class="idocs"><article class="idocs-paper paper" data-tone="${t.tone}"><div class="paper-head">${doc ? docTypeChip(doc) : chip(`${ico('bulb', 'sm')}Tarjeta de la idea`, 'teal')}<span class="path">${esc(doc?.relPath || `factory/ideas/${i.slug}.md`)}</span></div><div class="md" data-tone="${t.tone}" data-doc-base="${esc(doc?.relPath || 'factory/ideas/x.md')}">${body || '<p>Sin contenido.</p>'}</div></article>${narrowDocs()
    // Narrow screens pick the document from a folded list instead of a short inner-scrolling box.
    ? `<details class="idocs-pick"><summary class="btn index-toggle"><span class="row">${ico('file', 'sm')}<span class="clamp-1">${esc(sections.flatMap(([, items]) => items).find(it => it.id === cur)?.label || 'Resumen')}</span></span><span class="row xs muted">Cambiar · ${sections.flatMap(([, items]) => items).length}${ico('chevD', 'sm')}</span></summary>${rail}</details>`
    : rail}</div>`;
}

/* ---------- Campaña: the six-room journey map and the selected phase's sheet, as in the app ---------- */
const ZONE_ART = ['research', 'review', 'frontend', 'architecture', 'build-hall', 'release'];
const ZONE_HANDOFF = ['research.md', 'PRD + FRDs', 'sistema + mocks', 'blueprint + Build Plan', 'el código'];
const SPRITE_OF = { researcher: 'researcher', 'product-manager': 'product-manager', designer: 'designer', copywriter: 'copywriter', architect: 'architect', implementer: 'frontend-dev', reviewer: 'reviewer', analytics: 'analytics', 'security-auditor': 'security-auditor', devops: 'devops' };
/** Sprite home spots inside a room (percent), by team size, like the app's SPRITE_HOMES. */
const CAST_HOMES = { 1: [[50, 52]], 2: [[34, 52], [66, 52]], 3: [[24, 50], [50, 62], [76, 50]], 4: [[30, 34], [62, 34], [30, 66], [62, 66]] };
function castHtml(team, state) {
  const homes = CAST_HOMES[team.length] || CAST_HOMES[4];
  return team.map((m, k) => { const [x, y] = homes[k % homes.length]; return `<span class="cm cm-${state}" data-home-x="${x}" data-home-y="${y}" style="left:${x}%;top:${y}%;animation-delay:${(-k * 0.7).toFixed(1)}s">${SPRITE_OF[m.role] ? `<img src="assets/${SPRITE_OF[m.role]}.png" alt="">` : `<i>${esc(m.label.slice(0, 2))}</i>`}<em>${esc(m.label)}</em></span>`; }).join('');
}
/**
 * Roam engine for the active room, after the app's RoamingCast: each member walks to a fresh spot
 * every 0.9–2.5 s, sometimes toward a teammate; walking bobs, pausing idles. Off under reduced motion.
 */
let ROAM = 0;
function startRoam() {
  cancelAnimationFrame(ROAM);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const room = $('.room.is-current');
  if (!room) return;
  const cast = $$('.cm', room).map(el => ({ el, x: +el.dataset.homeX, y: +el.dataset.homeY, tx: +el.dataset.homeX, ty: +el.dataset.homeY, walk: false, t0: performance.now(), dur: 600 + Math.random() * 1400 }));
  const step = now => {
    if (!room.isConnected) return;
    for (const s of cast) {
      if (s.walk) {
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        if (d < 0.6) { s.walk = false; s.t0 = now; s.dur = 900 + Math.random() * 1500; s.el.classList.remove('walking'); }
        else { s.x += (dx / d) * 0.35; s.y += (dy / d) * 0.35; }
      } else if (now - s.t0 > s.dur) {
        const mate = cast.length > 1 && Math.random() < 0.45 ? cast.filter(o => o !== s)[Math.floor(Math.random() * (cast.length - 1))] : null;
        s.tx = mate ? Math.max(14, Math.min(86, mate.x + (s.x < mate.x ? -14 : 14))) : 14 + Math.random() * 72;
        s.ty = mate ? mate.y : 34 + Math.random() * 40;
        s.walk = true; s.el.classList.add('walking');
      }
      s.el.style.left = s.x + '%'; s.el.style.top = s.y + '%'; s.el.style.zIndex = String(Math.round(s.y));
    }
    ROAM = requestAnimationFrame(step);
  };
  ROAM = requestAnimationFrame(step);
}
function campaignView(i, p) {
  // Phase names are Mission Control's own words, so the one English label in the capture is shown in Spanish.
  const phases = (SNAP.campaign || []).map(ph => ph.name === 'Release' ? { ...ph, name: 'Lanzamiento' } : ph);
  if (!phases.length) return empty('La captura no incluye las fases de la campaña. Regenera data/snapshot.js con el exportador de OPEN-MOCKUP.md.', 'map');
  const curIdx = Math.max(0, PHASES.findIndex(x => x.id === ideaPhase(i)));
  const sel = Math.min(phases.length - 1, Math.max(0, P('phase') !== '' ? Number(P('phase')) : curIdx));
  const st = n => n < curIdx ? ['entregado', 'green', 'check'] : n === curIdx ? ['en curso', 'blue', 'loader'] : ['en espera', 'slate', 'lock'];
  const toneOf = n => PHASES[n]?.tone || 'blue';
  const room = n => { const [label, tone, icon] = st(n); const ph = phases[n]; const state = n < curIdx ? 'done' : n === curIdx ? 'current' : 'locked'; return `<button type="button" class="room ${n === sel ? 'is-sel' : ''} is-${state}" data-tone="${toneOf(n)}" style="--n:${n}" data-phase="${n}" aria-pressed="${n === sel}" aria-label="${n + 1}. ${esc(ph.name)}: ${label}"><img src="assets/zones/${ZONE_ART[n]}.png" alt=""><span class="cast ${ph.team.length >= 3 ? 'is-crowd' : ''}" aria-hidden="true">${castHtml(ph.team, state)}</span><span class="room-name"><span class="room-dot"></span><span class="room-n">${n + 1} · </span>${esc(ph.name)}</span><span class="room-state chip" data-tone="${tone}">${ico(icon, 'sm')}${label}</span></button>`; };
  /* Snake path: 1→2→3, down, 4←5←6 displayed right to left. A corridor carries the artifact one room hands to the next. */
  const link = (h, dir) => `<span class="corridor ${h < curIdx ? 'is-done' : ''}" data-dir="${dir}"><span class="handoff">${dir === 'l' ? '<span aria-hidden="true">← </span>' : ''}${esc(ZONE_HANDOFF[h])}${dir === 'r' ? '<span aria-hidden="true"> →</span>' : ''}${dir === 'd' ? '<span aria-hidden="true"> ↓</span>' : ''}</span></span>`;
  const map = `${room(0)}${link(0, 'r')}${room(1)}${link(1, 'r')}${room(2)}${link(2, 'd')}${room(5)}${link(4, 'l')}${room(4)}${link(3, 'l')}${room(3)}`;
  const progress = `<div class="camp-progress" role="img" aria-label="${curIdx} de ${phases.length} fases entregadas; en curso: ${esc(phases[curIdx].name)}">${phases.map((x, n) => `<span class="cp-seg is-${n < curIdx ? 'done' : n === curIdx ? 'current' : 'locked'}" data-tone="${toneOf(n)}"></span>`).join('')}</div><span class="small muted nowrap"><b class="tone-text" data-tone="green">${curIdx}/${phases.length}</b> entregadas</span>`;
  const ph = phases[sel];
  const [label, stTone, stIcon] = st(sel);
  const tone = toneOf(sel);
  const team = ph.team.map(m => `<div class="tmember"><span class="tm-stage">${SPRITE_OF[m.role] ? `<img src="assets/${SPRITE_OF[m.role]}.png" alt="" width="56" height="56">` : `<span class="pav md" data-tone="violet">${esc(m.label.slice(0, 2))}</span>`}</span><div><b>${esc(m.label)}</b><span class="mono xs tm-role">${esc(m.role)}</span><p class="small muted">${inl(m.what)}</p></div></div>`).join('');
  const fill = c => c.replace('<idea>', i.slug);
  const cmdBlock = c => c.modes?.length && p && /:implement$/.test(c.command)
    ? `<div id="mode-cmd">${cmd(('/pandacorp:implement ' + (store.get('orbita-mode-' + p.id) ?? '')).trim())}</div><details><summary class="link small">Elegir modo de construcción</summary><div style="margin-top:10px">${buildModePicker(p)}</div></details>`
    : `${cmd(fill(c.command))}${c.modes?.length ? `<details><summary class="link small">${esc(c.modeTitle || 'Modos')}</summary><div class="stack sm" style="margin-top:10px">${c.hint ? `<p class="xs muted">${esc(c.hint)}</p>` : ''}${c.modes.map(m => `<div class="ps-mode"><span class="small"><b>${esc(m.label)}</b> · <span class="muted">${esc(m.hint)}</span></span>${cmd(`${fill(c.command)} ${m.flag}`)}</div>`).join('')}</div></details>` : ''}`;
  const [first, ...rest] = ph.commands;
  const next = phases[sel + 1];
  const cmds = `${first ? `<div class="ps-next" data-tone="${next ? toneOf(sel + 1) : tone}"><p class="ps-next-l">${ico('arrow', 'sm')}Siguiente paso${next ? ` · avanza a ${esc(next.name)}` : ''}</p><b>${esc(first.label)}</b>${cmdBlock(first)}</div>` : ''}
    ${rest.length ? `<p class="ps-sub">Otras opciones de esta fase</p><div class="ps-opts">${rest.map(c => `<div class="stack sm"><span class="small">${esc(c.label)}</span>${cmdBlock(c)}</div>`).join('')}</div>` : ''}
    <p class="xs faint">spec y explore se corren desde la fábrica con el nombre de la idea; el resto, dentro de la carpeta del proyecto.</p>`;
  const stepBtn = (n, dir) => n >= 0 && n < phases.length ? `<button type="button" class="iconbtn ps-step" data-phase="${n}" aria-label="${dir === 'prev' ? 'Fase anterior' : 'Fase siguiente'}: ${esc(phases[n].name)}">${ico(dir === 'prev' ? 'back' : 'arrow', 'sm')}</button>` : '<span class="ps-step-gap"></span>';
  return `<div class="digest camp">
    <div class="camp-top"><h2 class="saga-head" data-tone="violet">${ico('map', 'sm')}<span>El viaje de esta idea por las 6 fases</span><span class="saga-line"></span><span class="xs faint">Clic en una sala para su ficha</span></h2><div class="row camp-prog">${progress}</div></div>
    <div class="map">${map}</div>
    <section class="phase-sheet" data-tone="${tone}" aria-labelledby="ps-title">
      <header class="ps-head"><span class="ps-num">${sel + 1}</span><div class="grow"><p class="ps-kicker">Fase ${sel + 1} de ${phases.length}</p><h3 id="ps-title">${esc(ph.name)}</h3></div>${chip(`${ico(stIcon, 'sm')}${label}`, stTone)}<span class="row ps-nav">${stepBtn(sel - 1, 'prev')}${stepBtn(sel + 1, 'next')}</span></header>
      ${brow('Descripción', `<p>${inl(ph.description)}</p>`)}
      ${brow('Entra y sale', `<div class="ps-flow"><div class="ps-io" data-tone="slate"><span class="ps-io-l">${ico('file', 'sm')}Lee</span><p>${inl(ph.reads)}</p></div><span class="ps-arrow" aria-hidden="true">${ico('arrow')}</span><div class="ps-io" data-tone="${tone}"><span class="ps-io-l">${ico('sparkles', 'sm')}Escribe</span><p>${inl(ph.writes)}</p></div></div>`)}
      ${brow(`Equipo · ${plural(ph.team.length, 'especialista', 'especialistas')}`, `<div class="team">${team}</div>`)}
      ${brow('Qué puedes correr', cmds)}
      ${p && ph.key === 'build' ? `<a class="btn toned" data-tone="violet" href="${href('portfolio', { project: p.id, tab: 'Party' })}">${ico('sparkles', 'sm')}Entrar a La Fragua${ico('arrow', 'sm')}</a>` : ''}
    </section>
  </div>`;
}
/* ---------- Work orders ---------- */
function ordersView(p) {
  if (!p.orders.length) return `<div class="stack">${empty('Este proyecto todavía no tiene work orders publicados. Sus documentos de producto y diseño siguen disponibles.', 'clipboard')}${cmd('/pandacorp:architecture')}</div>`;
  const wo = p.orders.find(w => w.id === P('wo'));
  if (wo) return orderDetail(p, wo);
  if (P('wo')) return notFound('Esta orden no está publicada', `${esc(P('wo'))} no aparece entre los work orders capturados de ${esc(p.short)}.`, href('portfolio', { project: p.id, tab: 'Observabilidad' }), 'Ver work orders');
  const view = ['tablero', 'deps'].includes(P('view')) ? P('view') : 'frd';
  const frd = P('frd');
  const st = P('state');
  const scoped = p.orders.filter(w => !frd || w.frd === frd);
  const states = ['todo', 'in_progress', 'review', 'done', ...(p.orders.some(w => w.state === 'fail') ? ['fail'] : [])];
  const filtered = scoped.filter(w => !st || w.state === st);
  const views = seg([{ id: 'frd', label: 'Por FRD', icon: 'list', tone: 'green' }, { id: 'tablero', label: 'Tablero', icon: 'columns', tone: 'green' }, { id: 'deps', label: 'Dependencias', icon: 'link', tone: 'green' }], view, 'view', 'Vista de work orders');
  if (view === 'deps') return `<div class="toolbar">${views}</div>${depsView(p)}`;
  return `<div class="toolbar">${views}
      <label class="field"><span class="sr-only">Filtrar por FRD</span><select id="wo-frd" aria-label="Filtrar por FRD"><option value="">Todos los FRDs (${p.frds.filter(f => f.orders.length).length})</option>${p.frds.filter(f => f.orders.length).map(f => `<option value="${esc(f.group)}" ${f.group === frd ? 'selected' : ''}>${f.code} · ${esc(f.title)}</option>`).join('')}</select>${ico('chevD', 'sm')}</label>
      <span class="grow"></span><span class="small faint">${plural(filtered.length, 'orden', 'órdenes')}</span></div>
    <div class="state-strip" role="group" aria-label="Filtrar por estado">${states.map(s => { const n = scoped.filter(w => w.state === s).length; const S = stateOf(s); return `<button type="button" class="state-tile" data-tone="${S.tone}" aria-pressed="${st === s}" data-state-filter="${s}"><span class="lbl"><span class="dot"></span>${S.label}</span><b>${n}</b>${bar(pctOf(n, scoped.length), S.tone)}</button>`; }).join('')}</div>
    ${view === 'tablero' ? woKanban(p, filtered, states) : woByFrd(p, filtered, !!(st || frd))}`;
}
function woRow(w) {
  return `<button type="button" class="worow" data-wo="${esc(w.id)}"><span class="wid">${esc(w.id)}</span><span class="wt">${inl(w.short)}</span>${stateChip(w.state)}<span class="wdeps">${w.deps.length ? `${ico('link', 'sm')} ${w.deps.length}` : ''}</span></button>`;
}
function woByFrd(p, orders, filtering) {
  const groups = p.frds.map(f => ({ f, list: orders.filter(w => w.frd === f.group) })).filter(g => g.list.length);
  if (!groups.length) return empty('Ningún work order coincide con el filtro.', 'search');
  const all = UI.frdAllOpen;
  return `<div class="frd-tools"><button type="button" class="btn sm" data-action="frd-toggle-all" aria-pressed="${all}">${ico(all ? 'minus' : 'plus', 'sm')}${all ? 'Colapsar todo' : 'Expandir todo'}</button></div><div class="frd-rows">${groups.map(({ f, list }) => {
    const open = all || filtering;
    return `<details class="frd-row" ${open ? 'open' : ''}><summary>${ico('chevR', 'sm chev')}<span class="fname"><small>${f.code}</small>${esc(f.title)}</span>${stackbar(f.orders)}<span class="fcount">${f.done}/${f.orders.length}</span><span class="fpct small faint">${pctOf(f.done, f.orders.length)}%</span></summary><div class="wo-list">${list.map(woRow).join('')}</div></details>`;
  }).join('')}</div>`;
}
function woKanban(p, orders, states) {
  const cols = states.filter(s => s !== 'fail' || orders.some(w => w.state === 'fail'));
  return `<div class="wo-kanban" style="--cols:${Math.min(cols.length, 5)}">${cols.map(s => {
    const list = orders.filter(w => w.state === s);
    const S = stateOf(s);
    const base = matchMedia('(max-width: 759px)').matches ? 4 : 8;
    const limit = UI.woExpanded.has(s) ? list.length : base;
    return `<section class="kcol ${list.length ? '' : 'is-empty'}" data-tone="${S.tone}" aria-label="${S.label}: ${list.length}"><h2 class="kcol-head">${ico(S.icon, 'sm')}${S.label}${chip(String(list.length), S.tone)}</h2>
      ${list.slice(0, limit).map(w => `<button type="button" class="wocard" data-tone="${S.tone}" data-wo="${esc(w.id)}"><span class="wid">${esc(w.id)}</span><strong>${inl(w.short)}</strong><small>${esc(p.frds.find(f => f.group === w.frd)?.code || w.frd)}${w.deps.length ? ` · ${plural(w.deps.length, 'dependencia', 'dependencias')}` : ''}</small></button>`).join('') || '<div class="kempty">Sin órdenes</div>'}
      ${list.length > limit ? `<button type="button" class="morebtn" data-wo-more="${s}">Mostrar ${list.length - limit} más</button>` : ''}${UI.woExpanded.has(s) && list.length > base ? `<button type="button" class="morebtn" data-wo-more="${s}">Mostrar menos</button>` : ''}</section>`;
  }).join('')}</div>`;
}
/** Extract the HTML of the first matching h2 section from rendered markdown. */
function sectionHtml(html, names) {
  const parts = (html || '').split(/(?=<h2[^>]*>)/);
  const hit = parts.find(part => names.some(n => new RegExp(`^<h2[^>]*>\\s*${n}`, 'i').test(part)));
  return hit ? hit.replace(/^<h2[^>]*>.*?<\/h2>/, '') : '';
}
const DIFFICULTY = { trivial: 'Trivial', low: 'Baja', normal: 'Media', medium: 'Media', high: 'Alta' };
const WO_FLOW = ['todo', 'in_progress', 'review', 'done'];
const WO_NOW = {
  todo: 'Todavía no empieza. Se construye cuando sus dependencias estén verificadas.',
  in_progress: 'Un agente la está construyendo ahora, con las pruebas primero.',
  review: 'Ya está construida. Espera la revisión de su FRD, que mira todas sus órdenes juntas.',
  done: 'Construida y verificada en la revisión de su FRD.',
  fail: 'Está bloqueada: necesita una decisión o un arreglo antes de seguir.',
};
/** A list field of the work order's own frontmatter (block or inline form); empty when absent. */
function frontList(body, key) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(body || '')?.[1] || '';
  const inline = new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm').exec(fm);
  if (inline) return inline[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const block = new RegExp(`^${key}:\\s*\\n((?:[ \\t]+-.*\\n?)+)`, 'm').exec(fm);
  return block ? block[1].split('\n').map(l => l.replace(/^\s+-\s*/, '').trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : [];
}
/** Acceptance criteria as a checklist: the id as a tag, EARS keywords marked, the sentence readable. */
function criteriaHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const list = doc.body.querySelector('ul, ol');
  const items = list ? [...list.children].filter(li => li.tagName === 'LI') : [];
  if (!items.length) return `<div class="md wo-read" data-tone="green">${html}</div>`;
  const mark = h => h.replace(/(^|>)([^<]*)/g, (_, a, txt) => a + txt.replace(/\b(WHEN|WHILE|WHERE|IF|THEN|SHALL NOT|SHALL|AND)\b/g, '<span class="ears">$1</span>'));
  return `<ol class="crit">${items.map(li => {
    const m = /^\s*(?:<(?:strong|b|code)>)?((?:AC|REQ)-[\w.-]+)(?:<\/(?:strong|b|code)>)?\s*[—–:-]?\s*/.exec(li.innerHTML);
    return `<li>${m ? `<span class="crit-id">${esc(m[1])}</span>` : `<span class="crit-id">${ico('check', 'sm')}</span>`}<div class="crit-t md">${mark(m ? li.innerHTML.slice(m[0].length) : li.innerHTML)}</div></li>`;
  }).join('')}</ol>`;
}
/** A long section shows its first blocks and folds the rest, so the summary stays a summary. */
function foldedHtml(html, keep = 2) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = [...doc.body.children];
  // A note that is one long list folds after its first items instead of showing everything.
  if (blocks.length === 1 && /^(UL|OL)$/.test(blocks[0].tagName) && blocks[0].children.length > keep + 1) {
    const rest = blocks[0].cloneNode(true);
    [...blocks[0].children].slice(keep).forEach(li => li.remove());
    [...rest.children].slice(0, keep).forEach(li => li.remove());
    return `<div class="md wo-read" data-tone="violet">${blocks[0].outerHTML}</div><details class="wo-more"><summary>${ico('chevD', 'sm chev')}Ver la nota completa</summary><div class="md wo-read" data-tone="violet">${rest.outerHTML}</div></details>`;
  }
  if (blocks.length <= keep + 1) return `<div class="md wo-read" data-tone="violet">${html}</div>`;
  return `<div class="md wo-read" data-tone="violet">${blocks.slice(0, keep).map(b => b.outerHTML).join('')}</div><details class="wo-more"><summary>${ico('chevD', 'sm chev')}Ver la nota completa</summary><div class="md wo-read" data-tone="violet">${blocks.slice(keep).map(b => b.outerHTML).join('')}</div></details>`;
}
function orderDetail(p, w) {
  const f = p.frds.find(x => x.group === w.frd);
  const view = P('woview') === 'Documento completo' ? 'Documento completo' : 'Resumen';
  const S = stateOf(w.state);
  const dependents = p.orders.filter(o => o.deps.includes(w.id));
  const depBtn = id => `<button type="button" class="btn sm" data-wo="${esc(id)}">${esc(id)}${p.orders.find(o => o.id === id) ? `<span class="dot" data-tone="${stateOf(p.orders.find(o => o.id === id).state).tone}" style="background:var(--tone)"></span>` : ''}</button>`;
  const about = sectionHtml(w.html, ['Summary', 'Resumen', 'Goal', 'Objective', 'Problem', 'Context']) || (w.summary ? `<p>${esc(w.summary)}</p>` : '');
  const scope = sectionHtml(w.html, ['In Scope', 'Scope', 'Alcance']);
  const outScope = sectionHtml(w.html, ['Out of Scope']);
  const accept = sectionHtml(w.html, ['Acceptance', 'Requirements & acceptance', 'EARS', 'Criterios']) || sectionHtml(w.html, ['Definition of done', 'TDD / Definition of done']);
  const built = sectionHtml(w.html, ['Status Note', 'What shipped']);
  const files = frontList(w.body, 'artifacts');
  const step = WO_FLOW.indexOf(w.state);
  const stepper = `<ol class="wo-steps" aria-label="Avance de la orden">${WO_FLOW.map((k, n) => { const st = stateOf(k); const on = n === step, past = step > n; return `<li class="${on ? 'is-now' : past ? 'is-past' : ''}" data-tone="${st.tone}" ${on ? 'aria-current="step"' : ''}><span class="wo-step-dot">${ico(past ? 'check' : st.icon, 'sm')}</span><span>${st.label}</span></li>`; }).join('')}</ol>`;
  const section = (title, icon, tone, body) => card(title, body, { icon, tone });
  return `<div class="row wrap" style="margin-bottom:12px">${crumbs([['Observabilidad', href('portfolio', { project: p.id, tab: 'Observabilidad' })], [f ? f.code : w.frd, href('portfolio', { project: p.id, tab: 'Observabilidad', frd: w.frd })], [w.id]])}</div>
    <section class="card tinted wo-hero" data-tone="${S.tone}"><div class="row between wrap top"><div class="grid" style="gap:10px;min-width:0"><div class="row wrap"><span class="chip plain mono">${esc(w.id)}</span>${f ? chip(`${f.code} · ${esc(f.title)}`, 'violet') : ''}</div><h2 class="wo-title">${inl(w.short)}</h2></div>
      <a class="btn sm" href="${href('portfolio', { project: p.id, tab: 'Observabilidad', frd: P('frd'), view: P('view'), state: P('state') })}">${ico('back', 'sm')}Volver</a></div>
      ${w.state === 'fail' ? `<p class="wo-now">${stateChip(w.state)}<span>${WO_NOW.fail}</span></p>` : `${stepper}<p class="wo-now"><b>Ahora:</b> ${WO_NOW[w.state] || ''}</p>`}</section>
    ${tabs([{ id: 'Resumen', icon: 'gauge', tone: 'green' }, { id: 'Documento completo', icon: 'file', tone: 'green' }], view, 'woview', 'Vista de la orden')}
    ${view === 'Documento completo'
      ? `<article class="paper" data-tone="green"><div class="paper-head">${chip(`${ico('clipboard', 'sm')}Work order`, 'green')}<span class="path">${esc(w.relPath)}</span><button type="button" class="iconbtn" data-copy="${esc(w.body)}" aria-label="Copiar documento">${ico('copy', 'sm')}</button></div><div class="md" data-tone="green">${w.html}</div></article>`
      : `<div class="wo-detail-grid"><div class="stack wo-story">
          ${about ? section('De qué trata', 'file', 'teal', `<div class="md wo-read" data-tone="teal">${about}</div>`) : ''}
          ${scope || outScope ? section('Qué cambia', 'target', 'blue', `${scope ? `<div class="md wo-read" data-tone="blue">${scope}</div>` : ''}${outScope ? `<div class="wo-out"><p class="eyebrow">${ico('x', 'sm')}Fuera de alcance</p><div class="md wo-read" data-tone="slate">${outScope}</div></div>` : ''}`) : ''}
          ${accept ? section('Cómo se comprueba', 'check', 'green', criteriaHtml(accept)) : ''}
          ${built ? section(w.state === 'done' || w.state === 'review' ? 'Qué se construyó' : 'Nota de estado', 'factory', 'violet', foldedHtml(built)) : ''}
          ${!about && !scope && !accept && !built ? `<p class="muted">Esta orden no publica resumen, alcance ni criterios; su contrato está en el documento completo.</p>` : ''}
          <p class="xs faint wo-lang">${ico('file', 'sm')}El contenido viene del documento de la orden, escrito en inglés; los títulos son de Mission Control.</p>
          <button type="button" class="link" data-tone="green" data-tabkey="woview" data-tabval="Documento completo">Leer el documento completo ${ico('arrow', 'sm')}</button></div>
        <div class="stack">${card('Ficha', `<dl class="kv"><dt>Estado</dt><dd>${stateChip(w.state)}</dd>${w.difficulty ? `<dt>Dificultad</dt><dd>${esc(DIFFICULTY[String(w.difficulty).toLowerCase()] || w.difficulty)}</dd>` : ''}<dt>Reaperturas</dt><dd>${Number(w.reopen) ? esc(w.reopen) : 'Ninguna'}</dd>${w.updated ? `<dt>Actualizada</dt><dd>${esc(fmtDate(w.updated))}</dd>` : ''}${w.reqs.length ? `<dt>Requisitos</dt><dd class="row wrap" style="gap:4px">${w.reqs.map(r => chip(esc(r), 'blue', 'outline')).join('')}</dd>` : ''}${w.blocked ? `<dt>Bloqueo</dt><dd>${esc(w.blocked)}</dd>` : ''}</dl>${files.length ? `<p class="eyebrow" style="margin-top:14px">Archivos que toca</p><ul class="wo-files">${files.map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ul>` : ''}`, { icon: 'list', tone: 'slate', level: 3 })}
          ${card('Dependencias', `<div class="stack sm"><span class="eyebrow">Depende de</span><div class="row wrap">${w.deps.map(depBtn).join('') || '<span class="small faint">Ninguna</span>'}</div><span class="eyebrow" style="margin-top:8px">Desbloquea</span><div class="row wrap">${dependents.map(o => depBtn(o.id)).join('') || '<span class="small faint">Ninguna</span>'}</div></div>`, { icon: 'link', tone: 'teal', level: 3 })}
          ${card('Construir esta orden', cmd(`/pandacorp:implement ${w.id}`), { icon: 'terminal', tone: 'violet', level: 3 })}</div></div>`}`;
}

function modelView(p) {
  const m = p.model;
  if (m.kind !== 'ready') return `<div class="notice" data-tone="slate">${ico('database')}<p>${m.kind === 'none' ? 'Este proyecto declara explícitamente que no usa base de datos.' : m.kind === 'error' ? 'El modelo publicado no se pudo interpretar: ' + esc(m.message) : 'Todavía no hay un modelo de datos publicado; queda visiblemente pendiente.'}</p></div>`;
  const model = m.model;
  // A phone shows one or two entities of the canvas at a time, so it opens on the schema list.
  const view = (P('model') || (matchMedia('(max-width: 759px)').matches ? 'Esquema' : 'Diagrama')) === 'Esquema' ? 'Esquema' : 'Diagrama';
  return `<div class="stack">
    <div class="row wrap between"><div class="row wrap">${chip('Modelo diseñado, no verificado contra una base viva', 'teal', 'outline')}<span class="small faint">${model.entities.length} entidades · ${model.relationships.length} relaciones · <code>docs/product/data-model.json</code></span></div></div>
    <div class="row wrap"><label class="field search" style="flex:1 1 240px">${ico('search', 'sm')}<input id="model-search" type="search" placeholder="Buscar entidad o atributo…" aria-label="Buscar entidad o atributo" value="${esc(UI.modelQ)}"></label>${seg([{ id: 'Diagrama', label: 'Diagrama', icon: 'grid', tone: 'teal' }, { id: 'Esquema', label: 'Esquema', icon: 'list', tone: 'teal' }], view, 'model', 'Vista del modelo')}</div>
    <div id="model-body">${view === 'Diagrama' ? diagramHtml(model) : schemaHtml(model)}</div>
    <details class="plan-row"><summary>${ico('chevR', 'sm')}Relaciones <span class="chip" data-tone="teal">${model.relationships.length}</span></summary><div style="padding:0">${model.relationships.map(r => { const from = model.entities.find(e => e.id === r.from.entity); const to = model.entities.find(e => e.id === r.to.entity); const card = e => `${e.min}..${e.max === 'many' ? '*' : e.max}`; return `<div class="rel-row"><span><b>${esc(from?.name || r.from.entity)}</b> <span class="card-n">${card(r.from)}</span></span>${ico('arrow', 'sm')}<span><b>${esc(to?.name || r.to.entity)}</b> <span class="card-n">${card(r.to)}</span>${r.name ? ` <span class="small faint">· ${esc(r.name)}</span>` : ''}</span></div>`; }).join('')}</div></details>
  </div>`;
}
const entityMatch = e => { const q = UI.modelQ.trim().toLowerCase(); return !q || (e.name + ' ' + e.attributes.map(a => a.name).join(' ')).toLowerCase().includes(q); };
function diagramHtml(model) {
  return `<div class="diagram" id="diagram"><div class="diagram-tools" role="toolbar" aria-label="Controles del diagrama"><button type="button" class="iconbtn" data-graph="out" aria-label="Alejar">${ico('minus', 'sm')}</button><span id="zoom-label">${Math.round(UI.modelScale * 100)}%</span><button type="button" class="iconbtn" data-graph="in" aria-label="Acercar">${ico('plus', 'sm')}</button><button type="button" class="iconbtn" data-graph="fit" aria-label="Ajustar a la vista">${ico('target', 'sm')}</button><button type="button" class="iconbtn" data-graph="reset" aria-label="Restablecer">${ico('rotate', 'sm')}</button><button type="button" class="iconbtn" data-graph="expand" aria-label="Pantalla completa">${ico('maximize', 'sm')}</button></div>
    <div class="diagram-scroll" id="diagram-scroll" tabindex="0" aria-label="Diagrama de entidades. Arrastra o usa las barras para desplazarte; el esquema textual tiene la misma información."><div class="sizer" id="sizer"><div class="canvas" id="canvas"><svg class="links" id="links" aria-hidden="true"></svg>
    ${model.entities.filter(entityMatch).map(e => `<article class="entity ${UI.modelSel === e.id ? 'on' : ''}" data-entity="${esc(e.id)}"><header><button type="button" data-select-entity="${esc(e.id)}" aria-pressed="${UI.modelSel === e.id}">${esc(e.name)}<span class="n">${e.attributes.length}</span></button></header>${e.attributes.map(a => `<div class="field-row"><span>${esc(a.name)}${(a.keys || []).map(k => `<span class="k ${k === 'FK' ? 'fk' : ''}">${k}</span>`).join('')}</span><span class="ty">${esc(a.type)}${a.optional ? '?' : ''}</span></div>`).join('')}</article>`).join('')}</div></div></div></div>
    <p class="small faint" style="margin-top:8px">Selecciona una entidad para resaltar sus relaciones; vuelve a pulsarla para limpiar la selección.</p>`;
}
function schemaHtml(model) {
  const list = model.entities.filter(entityMatch);
  return `<div class="schema-list">${list.map((e, n) => `<details data-schema ${n === 0 ? 'open' : ''}><summary>${ico('database', 'sm')}${esc(e.name)}<span class="small faint">${e.attributes.length} atributos</span></summary><pre tabindex="0" aria-label="Esquema de ${esc(e.name)}">${esc(`model ${e.name} {\n${e.attributes.map(a => `  ${a.name.padEnd(22)} ${(a.type + (a.optional ? '?' : '')).padEnd(16)} ${(a.keys || []).map(k => '@' + k).join(' ')}`).join('\n')}\n}`)}</pre>${e.description ? `<p class="small muted" style="padding:0 14px 14px">${esc(e.description)}</p>` : ''}</details>`).join('') || empty('Ninguna entidad coincide.', 'search')}</div>`;
}
function layoutDiagram() {
  const canvas = $('#canvas');
  const p = currentProject();
  if (!canvas || p?.model?.kind !== 'ready') return;
  const nodes = $$('[data-entity]', canvas);
  const cols = 5, colW = 300, gap = 36;
  const bottoms = Array(cols).fill(0);
  bottoms.fill(40); // keeps the first row below the floating toolbar
  nodes.forEach(node => { const c = bottoms.indexOf(Math.min(...bottoms)); node.style.left = (c * colW + 24) + 'px'; node.style.top = (bottoms[c] + 24) + 'px'; bottoms[c] += node.offsetHeight + gap; });
  const w = cols * colW + 24, h = Math.max(...bottoms) + 48;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; canvas.style.transform = `scale(${UI.modelScale})`;
  const svg = $('#links'); svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const sel = UI.modelSel;
  const related = new Set([sel]);
  svg.innerHTML = p.model.model.relationships.map(r => {
    const a = nodes.find(n => n.dataset.entity === r.from.entity), b = nodes.find(n => n.dataset.entity === r.to.entity);
    if (!a || !b) return '';
    const on = sel && (r.from.entity === sel || r.to.entity === sel);
    if (on) { related.add(r.from.entity); related.add(r.to.entity); }
    const ax = a.offsetLeft + (b.offsetLeft > a.offsetLeft ? a.offsetWidth : 0), ay = a.offsetTop + 20;
    const bx = b.offsetLeft + (b.offsetLeft > a.offsetLeft ? 0 : b.offsetWidth), by = b.offsetTop + 20;
    const mx = a === b ? ax + 40 : (ax + bx) / 2;
    return `<path class="${on ? 'on' : ''}" d="M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}"/>`;
  }).join('');
  nodes.forEach(n => { n.classList.toggle('on', n.dataset.entity === sel); n.classList.toggle('dim', !!sel && !related.has(n.dataset.entity)); });
  const label = $('#zoom-label'); if (label) label.textContent = Math.round(UI.modelScale * 100) + '%';
  const sizer = $('#sizer'); sizer.style.width = w * UI.modelScale + 'px'; sizer.style.height = h * UI.modelScale + 'px';
}

/* ---------- Cambios ---------- */
const CHANGE_STATES = { ready: ['Listos para construir', 'pink', 'check'], draft: ['Borradores', 'slate', 'file'], building: ['En construcción', 'blue', 'loader'], closing: ['Cerrando', 'amber', 'archive'], done: ['Hechos', 'green', 'check'], discarded: ['Descartados', 'slate', 'x'] };
function changeRow(p, c) {
  const [label, tone] = CHANGE_STATES[c.status] || [c.status, 'slate'];
  return `<button type="button" class="lrow" data-change="${esc(p.id)}|${esc(c.id)}"><span class="badge-icon sm" data-tone="${c.type === 'bug' ? 'coral' : 'pink'}">${ico(c.type === 'bug' ? 'alert' : 'branch', 'sm')}</span><div class="grow"><strong>${inl(c.title)}</strong><small>${esc(c.id)} · ${esc(fmtDate(c.date))}${c.frd ? ' · ' + esc(c.frd) : ''}</small></div>${chip(esc(c.type === 'bug' ? 'Bug' : 'Cambio'), c.type === 'bug' ? 'coral' : 'pink', 'outline')}${chip(esc(label), tone)}</button>`;
}
function changesView(p) {
  const items = p.changesList;
  const open = ['ready', 'building', 'closing', 'draft'];
  const history = items.filter(c => ['done', 'discarded'].includes(c.status));
  return `<div class="stack lg">${p.changes?.errors?.length ? `<div class="notice" data-tone="coral">${ico('alert')}<p>${plural(p.changes.errors.length, 'archivo de cambios no se pudo interpretar', 'archivos de cambios no se pudieron interpretar')}. No se cuentan como cola vacía.</p></div>` : ''}
    <div class="state-strip">${open.map(s => { const [label, tone, icon] = CHANGE_STATES[s]; return `<div class="state-tile" data-tone="${tone}"><span class="lbl">${ico(icon, 'sm')}${label}</span><b>${items.filter(c => c.status === s).length}</b></div>`; }).join('')}</div>
    ${open.map(s => { const list = items.filter(c => c.status === s); const [label, tone, icon] = CHANGE_STATES[s]; return list.length ? card(`${label} <span class="chip" data-tone="${tone}">${list.length}</span>`, `<div class="divided">${list.map(c => changeRow(p, c)).join('')}</div>`, { icon, tone }) : ''; }).join('') || empty('No hay cambios abiertos en la cola.', 'check')}
    ${history.length ? `<details class="card"><summary class="row between" style="cursor:pointer;list-style:none"><h2 class="row"><span class="badge-icon sm" data-tone="slate">${ico('archive', 'sm')}</span>Historial <span class="chip" data-tone="slate">${history.length}</span></h2>${ico('chevD', 'sm')}</summary><div class="divided" style="margin-top:12px">${history.map(c => changeRow(p, c)).join('')}</div></details>` : ''}
    ${card('Pedir un cambio', `<p class="small muted card-intro">La puerta única para features, ajustes y bugs. El cambio queda en la cola hasta el siguiente punto seguro del build.</p>${cmd('/pandacorp:change')}`, { icon: 'plus', tone: 'pink' })}</div>`;
}

/* ---------- Party ---------- */
/**
 * La Fragua: the project's work orders as a scene, the visual head of the Resumen. Every number comes
 * from the capture. Modes: real (the build's actual state), off, on (a running build) and a labelled
 * simulation that moves tokens between stations so the motion can be reviewed.
 */
const SCENE_MODES = [['real', 'Estado real'], ['off', 'Apagada'], ['on', 'Encendida'], ['sim', 'Simulación']];
function sceneMode(p) { const m = P('scene'); return ['off', 'on', 'sim'].includes(m) ? m : (p.running ? 'on' : 'off'); }
function fraguaScene(p, v) {
  const mode = sceneMode(p);
  const live = mode !== 'off';
  const by = s => p.orders.filter(w => w.state === s);
  const total = p.orders.length;
  const stations = [
    { key: 'todo', label: 'Cola', sub: 'por empezar', tone: 'slate', sprites: ['product-manager'], list: by('todo') },
    { key: 'in_progress', label: 'Taller', sub: 'construyéndose', tone: 'blue', sprites: ['frontend-dev', 'backend-dev'], list: [...by('in_progress'), ...by('fail')] },
    { key: 'review', label: 'Revisión', sub: 'esperan a su FRD', tone: 'amber', sprites: ['reviewer', 'test-writer'], list: by('review') },
    { key: 'done', label: 'Bóveda', sub: 'verificadas', tone: 'green', sprites: ['devops'], list: by('done') },
  ];
  // Each token shows its work-order code on two lines (FRD number over order number); hover or focus opens its card.
  const SHOW = 8;
  const code = id => { const m = /^WO-(\d+)-(\d+)$/.exec(id); return m ? `<span class="tk-a">${m[1]}</span><span class="tk-b">${m[2]}</span>` : `<span class="tk-b">${esc(id)}</span>`; };
  const EMPTY = { todo: ['Nada por empezar', 'check'], in_progress: ['Nadie construyendo ahora', 'clock'], review: ['Nada esperando revisión', 'check'], done: ['Aún nada verificado', 'lock'] };
  const tokens = (list, tone, key) => list.length ? `<div class="tokens">${list.slice(0, SHOW).map(w => `<button type="button" class="token" data-tone="${stateOf(w.state).tone || tone}" data-wo="${esc(w.id)}" data-tok aria-label="${esc(w.id)}: ${esc(plain(w.short))}">${code(w.id)}</button>`).join('')}<span class="token-more" ${list.length > SHOW ? '' : 'hidden'}>+${Math.max(0, list.length - SHOW)}</span></div>` : `<div class="tokens is-empty"><span class="tk-ghost"></span><span class="tk-ghost"></span><span class="tk-ghost"></span><p class="fr-empty-msg">${ico(EMPTY[key][1], 'sm')}${EMPTY[key][0]}</p></div>`;
  const seg2 = s => total ? `<span style="width:${(p.orders.filter(w => w.state === s).length / total) * 100}%" data-tone="${stateOf(s).tone}"></span>` : '';
  const left = total - by('done').length;
  // The courier only walks the stretch of stations that actually hold work (the simulation uses all four).
  const busy = stations.map((st, i) => (st.list.length ? i : -1)).filter(i => i >= 0);
  const [from, to] = mode === 'sim' ? [0, 3] : [Math.min(...busy), Math.max(...busy)];
  const at = i => `calc(${(i + 0.5) * 25}% - 28px)`;
  const courier = live && busy.length && to > from ? `<div class="fr-route" style="left:${(from + 0.5) * 25}%;right:${(3 - to + 0.5) * 25}%" aria-hidden="true"></div><img class="fr-courier" src="assets/courier.png" alt="" aria-hidden="true" style="--from:${at(from)};--to:${at(to)};--dur:${(to - from) * 3}s">` : '';
  const open = p.changesList.filter(c => !['done', 'discarded'].includes(c.status)).length;
  const status = mode === 'sim' ? 'Simulación: las fichas se mueven para que veas la animación; no son datos reales.' : mode === 'on' ? (p.running ? 'El equipo está trabajando: hay un build corriendo.' : 'Vista de cómo se ve con un build corriendo (ahora no hay uno).') : `El equipo descansa: no hay un build corriendo.${p.running ? ' (Vista apagada a pedido; en realidad hay un build corriendo.)' : ''}`;
  return `<section class="fragua ${live ? 'is-live' : 'is-idle'} ${mode === 'sim' ? 'is-sim' : ''}" aria-labelledby="fr-h" data-scene="${mode}">
      <div class="fr-head"><div class="grow"><span class="eyebrow">La Fragua · ${esc(p.short)}</span><h2 id="fr-h">${esc(v.text)}</h2><p class="small">${status}</p></div>
        <div class="fr-side">${chip(`${ico(v.health[2], 'sm')}${v.health[0]}`, v.health[1])}<div class="seg fr-modes" role="group" aria-label="Estado de la escena">${SCENE_MODES.map(([id, l]) => `<button type="button" aria-pressed="${(P('scene') || 'real') === id}" data-scene-mode="${id}">${l}</button>`).join('')}</div></div></div>
      ${total ? `<div class="fr-quest" role="img" aria-label="${p.counts.done} verificadas, ${by('review').length} en revisión, ${by('in_progress').length} en el taller, ${by('todo').length} en cola">${seg2('done')}${seg2('review')}${seg2('in_progress')}${seg2('fail')}${seg2('todo')}</div>
      <div class="fr-scene"><div class="fr-path" aria-hidden="true"></div>${courier}
        ${stations.map((st, i) => `<div class="fr-station" data-tone="${st.tone}" data-station="${st.key}"><div class="fr-cast" aria-hidden="true">${st.sprites.map((sp, k) => `<img src="assets/${sp}.png" alt="" style="animation-delay:${(-k * 0.8 - i * 0.3).toFixed(1)}s">`).join('')}</div><div class="fr-plate"><b>${st.label}</b><span class="fr-count">${st.list.length}</span><span class="xs">${st.sub}</span>${tokens(st.list, st.tone, st.key)}</div></div>`).join('')}
      </div>` : `<p class="small">Aún no hay work orders: la escena se llena cuando la arquitectura publique el plan.</p>`}
      <div class="fr-foot"><span class="row wrap" style="gap:6px">${chip(left ? `Faltan ${left}` : 'Todo forjado', left ? 'amber' : 'green')}${chip(`${plural(open, 'cambio abierto', 'cambios abiertos')}`, 'pink')}${chip(`${ico('clock', 'sm')}Último movimiento ${agoText(v.days)}`, '', 'plain')}</span><span class="xs fr-note">Cada cuadradito es una work order real: púlsalo para abrirla.</span></div>
    </section>`;
}
/** Work-order card for a Fragua token: code, title and a short description, on hover or keyboard focus. */
function tokenTip(el) {
  let tip = $('#tok-tip');
  if (!el) { if (tip) tip.hidden = true; return; }
  const p = currentProject();
  const w = p?.orders.find(o => o.id === el.dataset.wo);
  if (!w) return;
  if (!tip) { tip = document.createElement('div'); tip.id = 'tok-tip'; tip.className = 'tok-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  const f = p.frds.find(x => x.group === w.frd);
  tip.innerHTML = `<span class="row between" style="gap:8px"><b class="mono">${esc(w.id)}</b>${stateChip(w.state)}</span><strong>${inl(w.short)}</strong>${w.summary ? `<span class="small muted">${esc(firstSentence(plain(w.summary)))}</span>` : ''}${f ? `<span class="xs faint">${esc(f.code)} · ${esc(f.title)}</span>` : ''}`;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
  const x = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8);
  const y = r.top - t.height - 10 < 8 ? r.bottom + 10 : r.top - t.height - 10;
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}
document.addEventListener('pointerover', e => { const t = e.target.closest?.('[data-tok]'); if (t) tokenTip(t); });
document.addEventListener('pointerout', e => { const t = e.target.closest?.('[data-tok]'); if (t && !t.contains(e.relatedTarget)) tokenTip(null); });
document.addEventListener('focusin', e => { const t = e.target.closest?.('[data-tok]'); tokenTip(t || null); });
addEventListener('scroll', () => tokenTip(null), { passive: true });
/** Simulation mode: every 1.4 s one token travels to the next station and the counts follow. */
let SIM_TIMER = 0;
function startForgeSim() {
  clearInterval(SIM_TIMER);
  const scene = $('.fragua[data-scene="sim"]');
  if (!scene || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const order = ['todo', 'in_progress', 'review', 'done'];
  const tone = { todo: 'slate', in_progress: 'blue', review: 'amber', done: 'green' };
  const st = k => scene.querySelector(`[data-station="${k}"]`);
  const count = k => Number(st(k).querySelector('.fr-count').textContent);
  const setCount = (k, n) => { const el = st(k); el.querySelector('.fr-count').textContent = n; const shown = el.querySelectorAll('.token').length; const more = el.querySelector('.token-more'); if (more) { more.hidden = n <= shown; more.textContent = `+${Math.max(0, n - shown)}`; } };
  // A station that was empty drops its placeholder the moment work arrives.
  const fill = k => { const box = st(k).querySelector('.tokens'); if (box.classList.contains('is-empty')) { box.classList.remove('is-empty'); box.querySelectorAll('.tk-ghost, .fr-empty-msg').forEach(e => e.remove()); } return box; };
  // Seed the queue so the simulation always has work to move.
  if (!count('todo') && !count('in_progress')) { const box = fill('todo'); for (let i = 6; i > 0; i--) { const t = document.createElement('span'); t.className = 'token sim'; t.dataset.tone = 'slate'; t.innerHTML = `<span class="tk-a">sim</span><span class="tk-b">${String(i).padStart(2, '0')}</span>`; box.prepend(t); } setCount('todo', 6); }
  SIM_TIMER = setInterval(() => {
    if (!scene.isConnected) { clearInterval(SIM_TIMER); return; }
    const candidates = order.slice(0, 3).filter(k => count(k) > 0);
    const from = candidates[Math.floor(Math.random() * candidates.length)];
    if (!from) { clearInterval(SIM_TIMER); return; }
    const to = order[order.indexOf(from) + 1];
    const src = st(from).querySelector('.token') || st(from).querySelector('.fr-plate');
    const dst = fill(to);
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    const ghost = document.createElement('span');
    ghost.className = 'token-ghost'; ghost.dataset.tone = tone[to];
    Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px` });
    document.body.appendChild(ghost);
    requestAnimationFrame(() => { ghost.style.transform = `translate(${b.left + b.width / 2 - a.left - 12}px, ${b.top - a.top}px)`; });
    const label = (src.classList.contains('token') && src.innerHTML) || '<span class="tk-a">sim</span><span class="tk-b">wo</span>';
    if (src.classList.contains('token')) src.remove();
    setCount(from, count(from) - 1);
    setTimeout(() => {
      ghost.remove();
      const t = document.createElement('span'); t.className = 'token sim arrive'; t.dataset.tone = tone[to]; t.innerHTML = label;
      dst.prepend(t);
      const all = dst.querySelectorAll('.token'); if (all.length > 12) all[all.length - 1].remove();
      setCount(to, count(to) + 1);
    }, 900);
  }, 1400);
}

/* ---------- Observabilidad: dependency graphs (a view of the work-order section) ---------- */
/** Level switch shared by both dependency graphs. */
const dagLevels = cur => `<div style="margin-bottom:12px">${seg([{ id: 'frd', label: 'Por FRD', icon: 'layers', tone: 'teal' }, { id: 'wo', label: 'Por work order', icon: 'link', tone: 'teal' }], cur, 'dag', 'Nivel del grafo')}</div>`;
/**
 * FRD-level dependency map, like the app's compound DAG: each FRD is a box holding its work orders by
 * intra-FRD chain order; boxes read in the FRD super-graph's dependency order, two per row; cross-FRD dependencies
 * are aggregated into one FRD → FRD line per pair, labelled with how many work-order links it carries.
 */
function frdDagView(p) {
  const frds = p.frds.filter(f => f.orders.length);
  if (!frds.length) return empty('No hay work orders publicados para trazar dependencias.', 'link');
  const byId = new Map(p.orders.map(o => [o.id, o]));
  const frdOf = id => byId.get(id)?.frd;
  const pairs = new Map();
  for (const o of p.orders) for (const d of o.deps) { const a = frdOf(d), b = o.frd; if (a && b && a !== b) { const k = `${a}→${b}`; pairs.set(k, (pairs.get(k) || 0) + 1); } }
  // FRDs often depend on each other both ways; each pair keeps its dominant direction (more links;
  // a tie goes to the lower FRD number) so the map reads left to right, and the minority links show as "⇄".
  const code = g => p.frds.find(f => f.group === g)?.code || g;
  const links = new Map();
  for (const [k, n] of pairs) { const [a, b] = k.split('→'); const back = pairs.get(`${b}→${a}`) || 0; if (n > back || (n === back && code(a) < code(b))) links.set(k, { a, b, n, back }); }
  const fdepth = new Map();
  const onStack = new Set();
  const preds = g => [...links.values()].filter(l => l.b === g).map(l => l.a);
  const depthOf = g => { if (fdepth.has(g)) return fdepth.get(g); onStack.add(g); const d = Math.max(0, ...preds(g).filter(x => !onStack.has(x)).map(x => depthOf(x) + 1)); onStack.delete(g); fdepth.set(g, d); return d; };
  [...frds].sort((x, y) => x.code.localeCompare(y.code)).forEach(f => depthOf(f.group));
  // Compact boxes: each FRD's orders flow in chain order through a 3-column grid; boxes then read in
  // dependency order, two per row, so the whole map fits the page width.
  const CW = 144, CH = 40, COLW = 154, ROWH = 48, HEAD = 46, PAD = 12, GX = 56, GY = 56, M = 20, PER = 3, BOXCOLS = 2;
  const boxes = frds.map(f => {
    const rank = new Map();
    const rankOf = (id, seen = new Set()) => { if (rank.has(id)) return rank.get(id); if (seen.has(id)) return 0; seen.add(id); const o = byId.get(id); const r = Math.max(0, ...(o?.deps || []).filter(x => frdOf(x) === f.group).map(x => rankOf(x, seen) + 1)); rank.set(id, r); return r; };
    f.orders.forEach(o => rankOf(o.id));
    const list = [...f.orders].sort((x, y) => rank.get(x.id) - rank.get(y.id) || x.id.localeCompare(y.id));
    const ncol = Math.min(PER, list.length), nrow = Math.ceil(list.length / PER);
    return { f, list, w: PAD * 2 + ncol * COLW - (COLW - CW), h: HEAD + PAD * 2 + nrow * ROWH - (ROWH - CH), d: fdepth.get(f.group) };
  }).sort((x, y) => x.d - y.d || x.f.code.localeCompare(y.f.code));
  const BW = PAD * 2 + PER * COLW - (COLW - CW);
  let H = M;
  for (let i = 0; i < boxes.length; i += BOXCOLS) {
    const row = boxes.slice(i, i + BOXCOLS);
    row.forEach((b, k) => { b.x = M + k * (BW + GX); b.y = H; });
    H += Math.max(...row.map(b => b.h)) + GY;
  }
  H += M - GY;
  const W = M * 2 + BOXCOLS * BW + (BOXCOLS - 1) * GX;
  const card2 = new Map();
  boxes.forEach(b => b.list.forEach((o, i) => card2.set(o.id, { x: b.x + PAD + (i % PER) * COLW, y: b.y + HEAD + PAD + Math.floor(i / PER) * ROWH })));
  const boxOf = new Map(boxes.map(b => [b.f.group, b]));
  const cross = [...links.values()].map(({ a, b: bb, n, back }) => { const A = boxOf.get(a), B = boxOf.get(bb); if (!A || !B) return ''; const sameRow = A.y === B.y; let x1, y1, x2, y2, d; if (sameRow) { const right = B.x > A.x; x1 = right ? A.x + A.w : A.x; x2 = right ? B.x : B.x + B.w; y1 = A.y + 22; y2 = B.y + 22; const mx = (x1 + x2) / 2; d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; } else { const down = B.y > A.y; x1 = A.x + A.w / 2; y1 = down ? A.y + A.h : A.y; x2 = B.x + B.w / 2; y2 = down ? B.y : B.y + B.h; const my = (y1 + y2) / 2; d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`; } const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; return `<path class="fdag-link" style="stroke-width:${Math.min(8, 1.5 + n / 2)}" d="${d}"><title>${code(a)} → ${code(bb)}: ${n} dependencias${back ? ` (y ${back} en sentido contrario)` : ''}</title></path><text class="fdag-n" x="${mx}" y="${my - 6}" text-anchor="middle">${n}${back ? ` ⇄ ${back}` : ''}</text>`; }).join('');
  const boxHtml = boxes.map(b => `<div class="fdag-box" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"><button type="button" class="fdag-head" data-dag-frd="${esc(b.f.group)}" title="Ver las work orders de ${esc(b.f.code)} en el grafo detallado"><span class="fcode" data-tone="violet">${b.f.code}</span><span class="fdag-title">${esc(b.f.title)}</span><span class="xs faint nowrap">${b.f.done}/${b.f.orders.length}</span></button><div class="fdag-bar">${stackbar(b.f.orders)}</div></div>`).join('');
  const cards = p.orders.filter(o => card2.has(o.id)).map(o => { const q = card2.get(o.id); const S = stateOf(o.state); return `<button type="button" class="dag-node mini" data-tone="${S.tone}" data-wo="${esc(o.id)}" style="left:${q.x}px;top:${q.y}px;width:${CW}px;height:${CH}px" title="${esc(o.id)} · ${esc(plain(o.short))} · ${esc(S.label)}"><span class="dot"></span><span class="dag-id">${esc(o.id)}</span><span class="dag-t">${esc(plain(o.short))}</span></button>`; }).join('');
  // Below 900 px the same map is a list in dependency order: the canvas is too clipped to read there.
  const frdRefs = list => list.map(l => `<span class="chip" data-tone="violet">${esc(code(l.g))}${l.n > 1 ? ` · ${l.n}` : ''}</span>`).join('');
  const linkList = `<ol class="dag-list">${boxes.map(b => {
    const before = [...links.values()].filter(l => l.b === b.f.group).map(l => ({ g: l.a, n: l.n }));
    const after = [...links.values()].filter(l => l.a === b.f.group).map(l => ({ g: l.b, n: l.n }));
    return `<li><details class="dl-frd"><summary><span class="fcode" data-tone="violet">${b.f.code}</span><span class="grow"><b>${esc(b.f.title)}</b><span class="xs muted">${b.f.done}/${b.f.orders.length} verificadas</span></span>${ico('chevD', 'sm chev')}</summary>
      <div class="dl-body"><div class="dl-rel"><span class="xs muted">Depende de</span><span class="row wrap" style="gap:4px">${frdRefs(before) || '<span class="xs faint">Nada: es un punto de partida</span>'}</span></div><div class="dl-rel"><span class="xs muted">Desbloquea</span><span class="row wrap" style="gap:4px">${frdRefs(after) || '<span class="xs faint">Nada</span>'}</span></div>
      <div class="divided">${b.list.map(o => `<button type="button" class="lrow" data-wo="${esc(o.id)}"><span class="state-dot" data-tone="${stateOf(o.state).tone}"><span class="dot"></span></span><div class="grow"><strong class="mono small">${esc(o.id)}</strong><small class="clamp-2">${esc(plain(o.short))}</small></div>${ico('chevR', 'sm')}</button>`).join('')}</div></div></details></li>`;
  }).join('')}</ol>`;
  return card(`Grafo de dependencias <span class="chip" data-tone="teal">${plural(frds.length, 'FRD', 'FRDs')}</span>`, `${dagLevels('frd')}<p class="small faint show-sm" style="margin-bottom:12px">Los FRDs en el orden en que se pueden construir. Abre uno para ver de qué depende, qué desbloquea y sus work orders.</p><p class="small faint hide-sm dag-note" style="margin-bottom:12px">Cada caja es un FRD con sus work orders en el orden de su cadena. Las líneas entre cajas agrupan las dependencias entre FRDs: el número dice cuántas, y «⇄» las que van en sentido contrario. Pulsa el título de un FRD para verlo en detalle, o una orden para abrirla.</p>
    <div class="dag" tabindex="0" role="region" aria-label="Mapa de dependencias entre FRDs, desplazable"><div class="dag-canvas" style="width:${W}px;height:${H}px"><svg class="dag-edges" width="${W}" height="${H}" aria-hidden="true">${cross}</svg>${boxHtml}${cards}</div></div>${linkList}`, { icon: 'link', tone: 'teal' });
}
/**
 * Dependency graph (DAG) of the work orders: one column per depth (longest chain of prerequisites),
 * nodes coloured by state, curved edges from prerequisite to dependant. Clicking a node focuses it:
 * its whole upstream and downstream chain stays lit, the rest dims, and a side card lists both sides.
 */
function depsView(p) {
  if (P('dag') !== 'wo') return frdDagView(p);
  const frd = P('frd');
  const byId = new Map(p.orders.map(o => [o.id, o]));
  const inScope = o => !frd || o.frd === frd;
  const scoped = p.orders.filter(o => inScope(o) || p.orders.some(x => inScope(x) && (x.deps.includes(o.id) || o.deps.includes(x.id))));
  const ids = new Set(scoped.map(o => o.id));
  const depth = new Map();
  const depthOf = (id, seen = new Set()) => { if (depth.has(id)) return depth.get(id); if (seen.has(id)) return 0; seen.add(id); const o = byId.get(id); const d = o ? Math.max(0, ...o.deps.filter(x => ids.has(x)).map(x => depthOf(x, seen) + 1)) : 0; depth.set(id, d); return d; };
  scoped.forEach(o => depthOf(o.id));
  const cols = [];
  for (const o of scoped) { const d = depth.get(o.id); (cols[d] ||= []).push(o); }
  cols.forEach(c => c.sort((a, b) => String(a.frd).localeCompare(String(b.frd)) || a.id.localeCompare(b.id)));
  const W = 176, H = 46, GX = 64, GY = 12, PAD = 16;
  const pos = new Map();
  cols.forEach((c, x) => c.forEach((o, y) => pos.set(o.id, { x: PAD + x * (W + GX), y: PAD + y * (H + GY) })));
  const width = PAD * 2 + cols.length * W + (cols.length - 1) * GX;
  const height = PAD * 2 + Math.max(...cols.map(c => c.length)) * (H + GY) - GY;
  const focusId = P('focus') && ids.has(P('focus')) ? P('focus') : '';
  const anc = new Set(), desc = new Set();
  if (focusId) {
    const up = id => { for (const d of byId.get(id)?.deps || []) if (!anc.has(d)) { anc.add(d); up(d); } };
    const down = id => { for (const o of p.orders) if (o.deps.includes(id) && !desc.has(o.id)) { desc.add(o.id); down(o.id); } };
    up(focusId); down(focusId);
  }
  const lit = new Set([...(focusId ? [focusId] : []), ...anc, ...desc]);
  const upSide = id => id === focusId || anc.has(id);
  const downSide = id => id === focusId || desc.has(id);
  const edges = scoped.flatMap(o => o.deps.filter(d => pos.has(d)).map(d => { const a = pos.get(d), b = pos.get(o.id); const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2; const on = focusId && ((upSide(d) && upSide(o.id)) || (downSide(d) && downSide(o.id))); return `<path class="dag-edge ${on ? 'on' : ''} ${focusId && !on ? 'dim' : ''}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`; })).join('');
  const nodes = scoped.map(o => { const q = pos.get(o.id); const S = stateOf(o.state); const out = !inScope(o); return `<button type="button" class="dag-node ${o.id === focusId ? 'focus' : ''} ${focusId && !lit.has(o.id) ? 'dim' : ''} ${out ? 'out' : ''}" data-tone="${S.tone}" data-focus="${esc(o.id)}" style="left:${q.x}px;top:${q.y}px" title="${esc(o.id)} · ${esc(plain(o.short))} · ${esc(S.label)}"><span class="dot"></span><span class="dag-id">${esc(o.id)}</span><span class="dag-t">${esc(plain(o.short))}</span></button>`; }).join('');
  const f = focusId ? byId.get(focusId) : null;
  const ups = f ? f.deps.map(id => byId.get(id)).filter(Boolean) : [];
  const downs = f ? p.orders.filter(o => o.deps.includes(f.id)) : [];
  const mini = o => `<button type="button" class="lrow" data-focus="${esc(o.id)}"><span class="state-dot" data-tone="${stateOf(o.state).tone}"><span class="dot"></span></span><div class="grow"><strong class="mono small">${esc(o.id)}</strong><small class="clamp-2">${esc(plain(o.short))}</small></div></button>`;
  const frds = p.frds.filter(x => x.orders.length);
  return `<div class="dag-wrap">${card(`Grafo de dependencias <span class="chip" data-tone="teal">${plural(scoped.length, 'orden', 'órdenes')}</span>`, `${dagLevels('wo')}<div class="row wrap" style="gap:12px;margin-bottom:12px"><label class="field" style="min-width:240px"><span class="sr-only">Filtrar por FRD</span><select id="dag-frd" aria-label="Filtrar el grafo por FRD"><option value="">Todos los FRDs</option>${frds.map(x => `<option value="${esc(x.group)}" ${x.group === frd ? 'selected' : ''}>${x.code} · ${esc(x.title)}</option>`).join('')}</select>${ico('chevD', 'sm')}</label><span class="small faint grow hide-sm dag-note">De izquierda a derecha: lo que va primero → lo que desbloquea. Pulsa una orden para ver su cadena.</span><span class="small faint grow show-sm">Por pasos: cada paso se puede construir cuando termina el anterior. Pulsa una orden para ver de qué depende y qué desbloquea.</span>${focusId ? `<button type="button" class="link small" data-focus="">${ico('x', 'sm')}Quitar foco</button>` : ''}</div>
      <div class="dag" tabindex="0" role="region" aria-label="Grafo de dependencias, desplazable"><div class="dag-canvas" style="width:${width}px;height:${height}px"><svg class="dag-edges" width="${width}" height="${height}" aria-hidden="true">${edges}</svg>${nodes}</div></div>
      <div class="dag-list">${cols.map((c, i) => `<p class="eyebrow">Paso ${i + 1} · ${plural(c.length, 'orden', 'órdenes')}</p><div class="divided">${c.map(o => `<button type="button" class="lrow ${o.id === focusId ? 'is-focus' : ''} ${focusId && !lit.has(o.id) ? 'dim' : ''}" data-focus="${esc(o.id)}" aria-pressed="${o.id === focusId}"><span class="state-dot" data-tone="${stateOf(o.state).tone}"><span class="dot"></span></span><div class="grow"><strong class="mono small">${esc(o.id)}</strong><small class="clamp-2">${esc(plain(o.short))}</small></div></button>`).join('')}</div>`).join('')}</div>`, { icon: 'link', tone: 'teal' })}
    ${f ? `<section class="card dag-side" aria-label="Orden en foco"><div class="dag-focus"><div class="row wrap" style="gap:8px">${stateChip(f.state)}<b class="mono">${esc(f.id)}</b></div><p class="small">${inl(f.short)}</p><button type="button" class="btn sm" data-wo="${esc(f.id)}">Abrir orden${ico('arrow', 'sm')}</button></div><div><p class="eyebrow">Depende de · ${ups.length}</p><div class="divided">${ups.map(mini).join('') || '<p class="small faint">Es un punto de partida.</p>'}</div></div><div><p class="eyebrow">Desbloquea · ${downs.length}</p><div class="divided">${downs.map(mini).join('') || '<p class="small faint">Nada depende de ella.</p>'}</div></div></section>` : ''}</div>`;
}

/* ---------- Documentos ---------- */
const GROUP_ORDER = ['Product', 'Global', 'Feature', 'Design', 'Analytics', 'Reviews', 'Rules', 'Work orders'];
const GROUP_LABEL = { Product: 'Producto', Global: 'Arquitectura y decisiones', Design: 'Diseño', Analytics: 'Analítica', Reviews: 'Revisiones', Rules: 'Reglas', 'Work orders': 'Work orders' };
const GROUP_TONE = { Product: 'blue', Global: 'amber', Design: 'pink', Analytics: 'teal', Reviews: 'slate', Rules: 'slate', 'Work orders': 'violet' };
function docGroups(p) {
  const groups = [...new Set(p.docs.map(d => d.group))];
  const rank = g => { const i = GROUP_ORDER.indexOf(g.startsWith('Feature:') ? 'Feature' : g); return i < 0 ? 99 : i; };
  return groups.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
function documentsView(p, ctx) {
  if (!p?.docs.length) return empty('No hay documentos publicados para este proyecto.', 'file');
  if (P('doc') && !p.docs.some(d => d.id === P('doc'))) return notFound('Este documento no está en la captura', `No hay un documento «${esc(P('doc'))}» en ${esc(p.short)}.`, ctx.screen === 'idea' ? href('idea', { idea: P('idea'), tab: 'Documentos' }) : href('portfolio', { project: p.id, tab: 'Documentos' }), 'Ver documentos');
  const sel = p.docs.find(d => d.id === P('doc')) || getDoc(p, 'docs/product/prd.md') || p.docs[0];
  const t = DOC_TYPES[docType(sel)];
  const groups = docGroups(p);
  const q = UI.docQ.trim().toLowerCase();
  const typeCounts = Object.entries(p.docs.reduce((acc, d) => { const t = docType(d); acc[t] = (acc[t] || 0) + 1; return acc; }, {})).sort((x, y) => y[1] - x[1]);
  const typeFilter = `<div class="chipset doc-types" role="group" aria-label="Filtrar por tipo de documento"><button type="button" class="chipbtn" data-doctype="" aria-pressed="${!UI.docType}">Todos <span class="n">${p.docs.length}</span></button>${typeCounts.map(([t, n]) => `<button type="button" class="chipbtn" data-doctype="${t}" aria-pressed="${UI.docType === t}"><span class="dot" data-tone="${DOC_TYPES[t].tone}" style="background:var(--tone)"></span>${DOC_TYPES[t].label} <span class="n">${n}</span></button>`).join('')}</div>`;
  const index = `<nav class="doc-index" id="doc-index" aria-label="Documentos del proyecto"><label class="field">${ico('search', 'sm')}<input id="doc-search" type="search" placeholder="Buscar documento…" aria-label="Buscar documento" value="${esc(UI.docQ)}"></label>
    ${groups.map(g => { const docs = p.docs.filter(d => d.group === g); const feat = g.startsWith('Feature:'); const label = feat ? (p.frds.find(f => f.group === g.slice(9).trim())?.code || '') + ' · ' + (p.frds.find(f => f.group === g.slice(9).trim())?.title || g.slice(9)) : GROUP_LABEL[g] || g; const tone = feat ? 'violet' : GROUP_TONE[g] || 'slate'; const open = docs.some(d => d.id === sel.id) || g === 'Product' || !!q || !!UI.docType; const anyHit = docs.some(d => (!q || (d.label + ' ' + d.relPath).toLowerCase().includes(q)) && (!UI.docType || docType(d) === UI.docType));
      return `<details class="dgroup" data-tone="${tone}" data-doc-group ${open ? 'open' : ''} ${anyHit ? '' : 'hidden'}><summary>${ico('chevR', 'sm chev')}<span>${esc(label)}</span><span class="n">${docs.length}</span></summary>${docs.map(d => { const dt = DOC_TYPES[docType(d)]; const hit = (!q || (d.label + ' ' + d.relPath).toLowerCase().includes(q)) && (!UI.docType || docType(d) === UI.docType); return `<button type="button" class="ditem" data-tone="${dt.tone}" data-open-doc="${esc(d.id)}" data-ctx="${ctx.screen}" data-doc-text="${esc((d.label + ' ' + d.relPath).toLowerCase())}" ${hit ? '' : 'hidden'} ${d.id === sel.id ? 'aria-current="page"' : ''}>${ico(dt.icon)}<span>${esc(d.label)}</span></button>`; }).join('')}</details>`; }).join('')}</nav>`;
  return `${typeFilter}<button type="button" class="btn index-toggle" data-action="doc-index" aria-controls="doc-index" aria-expanded="false" style="margin-bottom:12px"><span class="row">${ico('file', 'sm')}Elegir documento · ${p.docs.length}</span>${ico('chevD', 'sm')}</button>
    <div class="reader"><article class="paper" data-tone="${t.tone}" id="paper"><div class="paper-head">${docTypeChip(sel)}<span class="path">${esc(sel.relPath)}</span><button type="button" class="iconbtn" data-copy="${esc(sel.body)}" aria-label="Copiar el documento">${ico('copy', 'sm')}</button></div><div class="md" data-tone="${t.tone}" data-doc-base="${esc(sel.relPath)}">${sel.html || '<p>Documento vacío.</p>'}</div></article>${index}</div>`;
}

/* ---------- Comandos ---------- */
const BUILD_MODES = [
  { flag: '', label: 'Equilibrado', tag: 'default', icon: 'layers', power: 2, hint: 'Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x.' },
  { flag: 'pro', label: 'Pro', tag: 'pro', icon: 'clock', power: 1, hint: '1 agente a la vez, modelos económicos (sonnet/haiku). Más lento, mínimo consumo. Para plan Pro.' },
  { flag: 'powerful', label: 'Potente', tag: 'powerful', icon: 'bolt', power: 3, hint: 'Hasta 5 agentes en paralelo → avanza más rápido. Para Max 20x.' },
  { flag: 'deep', label: 'Profundo', tag: 'deep', icon: 'diamond', power: 4, hint: 'Mejores modelos en todos + revisión adversarial extra. Para un proyecto especial.' },
];
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable: the choice lasts this view only */ } } };
function buildModePicker(p) {
  const mode = store.get('orbita-mode-' + p.id) ?? '';
  return `<p class="small muted card-intro">Con cuánta potencia se construye. Se recuerda por proyecto.</p><div class="mode-grid" role="group" aria-label="Modo de construcción">${BUILD_MODES.map(m => `<button type="button" class="mode" aria-pressed="${m.flag === mode}" data-mode="${m.flag}" data-project="${esc(p.id)}"><span class="mode-top"><span class="mode-ico">${ico(m.icon, 'sm')}</span><b>${m.label} <span class="faint mode-tag">${m.tag}</span></b></span><span class="mode-power" aria-label="Potencia ${m.power} de 4">${[1, 2, 3, 4].map(n => `<i class="${n <= m.power ? 'on' : ''}"></i>`).join('')}</span><small>${m.hint}</small></button>`).join('')}</div><div style="margin-top:12px" id="mode-cmd">${cmd(('/pandacorp:implement ' + mode).trim())}</div>`;
}
function commandsView(p) {
  const target = P('target');
  const targets = [...p.frds.map(f => ({ id: f.code, label: `${f.code} · ${f.title}` })), ...p.orders.filter(w => w.state !== 'done').map(w => ({ id: w.id, label: `${w.id} · ${plain(w.short)}` })), ...p.changesList.filter(c => ['ready', 'draft', 'building'].includes(c.status)).map(c => ({ id: 'change:' + c.id, label: `Cambio · ${plain(c.title)}` }))];
  const step = (tone, icon, label, command) => `<div class="cmd-step" data-tone="${tone}"><p class="cmd-l">${ico(icon, 'sm')}${label}</p>${cmd(command)}</div>`;
  return `<div class="grid-2 cmd-page"><div class="stack">
    ${card('Siguiente paso', (p.commands || []).map(c => `<div class="stack sm" style="margin-bottom:12px"><p class="small muted">${esc(c.when)}</p>${cmd(c.command)}</div>`).join('') || empty('No hay comandos de fase para este proyecto.'), { icon: 'arrow', tone: phaseOf(p.phase).tone })}
    ${card('Modo de construcción', buildModePicker(p), { icon: 'bolt', tone: 'violet' })}
  </div><div class="stack">
    ${card('Construir un objetivo concreto', `<p class="small muted card-intro">Elige un FRD, una orden pendiente o un cambio de la cola para acotar el build.</p><label class="field" style="margin-bottom:12px"><span class="sr-only">Objetivo</span><select id="cmd-target" aria-label="Objetivo del build"><option value="">Elige un FRD o work order…</option>${targets.map(t => `<option value="${esc(t.id)}" ${t.id === target ? 'selected' : ''}>${esc(t.label).slice(0, 90)}</option>`).join('')}</select>${ico('chevD', 'sm')}</label>${cmd(target ? `/pandacorp:implement ${target}` : '/pandacorp:implement <id>')}`, { icon: 'target', tone: 'teal' })}
    ${card('Cambios y decisiones', `<div class="stack">${step('pink', 'branch', 'Pedir un cambio o un bug', '/pandacorp:change')}${step('amber', 'flag', 'Responder una decisión pendiente', '/pandacorp:decide')}${step('violet', 'rocket', 'Paquete grande o rediseño', '/pandacorp:new-version')}<p class="xs faint row" style="gap:6px">${ico('copy', 'sm')}Los comandos se copian para pegarlos en Claude Code. Mission Control nunca los ejecuta.</p></div>`, { icon: 'branch', tone: 'pink' })}
  </div></div>`;
}

/* ================= Propuestas ================= */
const missingExtras = what => empty(`La captura de la fábrica (<code>data/extras.js</code>) no está disponible, así que ${what} no se puede mostrar. Ejecuta el exportador de OPEN-MOCKUP.md.`, 'alert');
const PRIORITY = { p0: ['P0', 'coral'], p1: ['P1', 'amber'], p2: ['P2', 'slate'] };
const LESSON_TYPE = { gotcha: ['Trampa', 'pink'], pattern: ['Patrón', 'blue'], 'library-verdict': ['Veredicto', 'teal'], 'anti-pattern': ['Antipatrón', 'coral'], 'problem-solution': ['Problema→solución', 'violet'] };
function moreList(key, list, render, step = 8) {
  const limit = UI.more[key] || step;
  return list.slice(0, limit).map(render).join('') + (list.length > limit ? `<button type="button" class="morebtn" style="margin-top:8px" data-more="${key}" data-step="${step}">Mostrar ${Math.min(step * 2, list.length - limit)} más · quedan ${list.length - limit}</button>` : '');
}
/**
 * Factory signals grouped by what they mean, so the owner sees three kinds instead of a flat list:
 * board bottlenecks, lessons seen in 2+ projects, and skills with no usage event in the log window.
 */
function proposalSignals(m) {
  const sug = m.streams.find(s => s.key === 'suggestions')?.items || [];
  return {
    board: sug.filter(s => s.kind === 'bottleneck'),
    recurring: sug.filter(s => s.kind === 'recurring-lesson'),
    unused: sug.filter(s => s.kind === 'unused-capability'),
    other: sug.filter(s => !['bottleneck', 'recurring-lesson', 'unused-capability'].includes(s.kind)),
  };
}
/**
 * The ordered "what to do now" list behind the Resumen tab and the menu badge. Each action names its
 * count, why it matters in plain words, the one command to run, and where to run it. Derived only from
 * the captured memory, backlog and ideas; an empty source yields no action, never a made-up one.
 */
function proposalActions() {
  const m = EXTRAS.memory, b = EXTRAS.backlog;
  const open = b.items.filter(i => ['open', 'doing'].includes(i.status));
  const p0 = open.filter(i => i.priority === 'p0' && i.status === 'open');
  const p1 = open.filter(i => i.priority === 'p1' && i.status === 'open');
  const promo = m.streams.find(s => s.key === 'promotions')?.items || [];
  const sig = proposalSignals(m);
  const discovered = IDEAS.filter(i => i.status !== 'discarded' && ideaPhase(i) === 'discovered');
  const stale = m.health.staleDays || 0;
  const acts = [];
  if (p0.length) acts.push({ needsYou: true, tone: 'coral', icon: 'alert', kind: 'Urgente', title: `${plural(p0.length, 'problema urgente', 'problemas urgentes')} en la fábrica`, why: `${p0.length === 1 ? 'Es el ítem P0 del backlog' : 'Son los P0 del backlog'}: «${plain(p0[0].title)}». Arréglalo antes que lo demás.`, cmd: `/pandacorp:implement-backlog ${p0[0].id}`, where: 'en la carpeta de la fábrica', link: href('propuestas', { tab: 'Backlog' }), linkLabel: 'Ver el backlog' });
  if (promo.length || sig.recurring.length) acts.push({ needsYou: true, tone: 'teal', icon: 'rocket', kind: 'Decidir', title: `${plural(promo.length + sig.recurring.length, 'lección espera', 'lecciones esperan')} tu sí o no`, why: `La fábrica las vio funcionar en varios proyectos y propone volverlas estándar, regla o skill${sig.recurring.length ? ` (${sig.recurring.length} recién detectadas en 2 proyectos)` : ''}. Revisa una, decide, y sigue con la próxima.`, cmd: `/pandacorp:learn ${(promo[0] || { id: sig.recurring[0]?.target }).id}`, where: 'en la carpeta de la fábrica · cambia el número por la lección que elijas', link: href('propuestas', { tab: 'Memoria' }), linkLabel: 'Ver las lecciones' });
  if (p1.length) acts.push({ needsYou: true, tone: 'amber', icon: 'list', kind: 'Importante', title: `${plural(p1.length, 'arreglo importante', 'arreglos importantes')} en cola`, why: 'Prioridad P1: fallos o mejoras del motor, las plantillas y las skills que conviene hacer pronto. Se hacen de a uno.', cmd: `/pandacorp:implement-backlog ${p1[0].id}`, where: 'en la carpeta de la fábrica · el primero de la lista', link: href('propuestas', { tab: 'Backlog' }), linkLabel: 'Ver los P1' });
  if (discovered.length) acts.push({ needsYou: true, tone: 'blue', icon: 'bulb', kind: 'Ideas', title: `${plural(discovered.length, 'idea descubierta espera', 'ideas descubiertas esperan')} decisión`, why: 'Están en la primera columna del tablero sin proyecto. La recomendación te dice cuál conviene llevar a spec y cuáles descartar.', cmd: '/pandacorp:recommend', where: 'en la carpeta de la fábrica', link: href('tablero'), linkLabel: 'Ver el tablero' });
  acts.push(stale > 2
    ? { needsYou: true, tone: 'teal', icon: 'inbox', kind: 'Memoria', title: `La memoria lleva ${plural(stale, 'día', 'días')} sin revisarse`, why: 'La rutina diaria no ha corrido. Cosechar convierte las notas de los proyectos en lecciones candidatas.', cmd: '/pandacorp:memory harvest', where: 'en la carpeta de la fábrica', link: href('propuestas', { tab: 'Memoria' }), linkLabel: 'Ver la memoria' }
    : { needsYou: false, tone: 'teal', icon: 'check', kind: 'Al día', title: 'La memoria se revisa sola', why: `La rutina diaria cosechó y revisó por última vez el ${fmtDate(m.health.lastMemoryRunAt || m.health.lastSweepAt)}. No necesitas hacer nada.` });
  return acts;
}
function proposals() {
  if (!EXTRAS) return pageHead('Propuestas', 'Lo que la fábrica propone mejorar.') + missingExtras('Memoria y Backlog');
  const tab = ['Memoria', 'Backlog'].includes(P('tab')) ? P('tab') : 'Resumen';
  const m = EXTRAS.memory, b = EXTRAS.backlog;
  const openN = b.items.filter(i => ['open', 'doing'].includes(i.status)).length;
  return pageHead('Propuestas', 'Lo que la fábrica aprendió construyendo y lo que hay que arreglar en ella misma. Aquí ves qué te toca y qué comando correr.', { eyebrow: factoryStamp() })
    + tabs([{ id: 'Resumen', icon: 'target', tone: 'pink' }, { id: 'Memoria', icon: 'bulb', tone: 'teal', badge: m.counts.open.promotions + proposalSignals(m).recurring.length }, { id: 'Backlog', icon: 'list', tone: 'blue', badge: openN }], tab, 'tab', 'Propuestas')
    + `<div role="tabpanel" aria-label="${tab}">${tab === 'Backlog' ? backlogView(b) : tab === 'Memoria' ? memoryView(m) : proposalsSummary(m, b)}</div>`;
}
/** Resumen: what needs the owner, in order, each with its one command; then what moves on its own. */
function proposalsSummary(m, b) {
  const acts = proposalActions();
  const mine = acts.filter(a => a.needsYou), auto = acts.filter(a => !a.needsYou);
  const open = b.items.filter(i => ['open', 'doing'].includes(i.status));
  const doing = open.filter(i => i.status === 'doing');
  const sig = proposalSignals(m);
  const cand = m.streams.find(s => s.key === 'candidates')?.items.length || 0;
  const promo = m.streams.find(s => s.key === 'promotions')?.items.length || 0;
  const pri = k => open.filter(i => i.priority === k && i.status === 'open').length;
  const act = (a, n) => `<li class="pa-row" data-tone="${a.tone}"><span class="pa-n" aria-hidden="true">${n}</span><div class="pa-main"><span class="pa-kind">${ico(a.icon, 'sm')}${esc(a.kind)}</span><strong>${esc(a.title)}</strong><p class="small muted">${inl(a.why)}</p>${a.cmd ? `<div class="pa-cmd">${cmd(a.cmd)}<span class="xs faint">Córrelo ${esc(a.where)}</span></div>` : ''}</div>${a.link ? `<a class="btn sm" href="${a.link}">${esc(a.linkLabel)}${ico('arrow', 'sm')}</a>` : ''}</li>`;
  return `<div class="stack lg">
    <section class="card pa-card" data-tone="amber" aria-labelledby="pa-title"><header class="row between wrap"><div><h2 id="pa-title" class="card-title"><span class="badge-icon sm">${ico('target', 'sm')}</span>Qué te toca, en orden</h2><p class="small muted">${mine.length ? `${plural(mine.length, 'cosa necesita', 'cosas necesitan')} tu decisión. Copia el comando, pégalo en Claude Code y vuelve.` : 'Nada necesita tu decisión ahora.'}</p></div>${chip(`${mine.length} para ti`, mine.length ? 'amber' : 'teal')}</header>
      <ol class="pa-list">${mine.map((a, k) => act(a, k + 1)).join('')}</ol>
      ${auto.map(a => `<div class="pa-auto">${ico(a.icon, 'sm')}<p class="small"><b>${esc(a.title)}.</b> <span class="muted">${inl(a.why)}</span></p></div>`).join('')}
    </section>
    <div class="grid-2">
      ${card('Memoria de la fábrica', `<p class="small muted">Lo que aprendió construyendo tus proyectos.</p><dl class="pa-facts"><div><dt>Reglas activas</dt><dd>${m.counts.byStatus.active}</dd></div><div><dt>Esperan tu decisión</dt><dd class="tone-text" data-tone="teal">${promo + sig.recurring.length}</dd></div><div><dt>Candidatas</dt><dd>${cand}</dd><dd class="xs faint">se corroboran solas</dd></div></dl><a class="link small" href="${href('propuestas', { tab: 'Memoria' })}">Ver cómo avanza una lección ${ico('arrow', 'sm')}</a>`, { icon: 'bulb', tone: 'teal' })}
      ${card('Backlog de la fábrica', `<p class="small muted">Fallos y mejoras de la propia fábrica (motor, plantillas, skills), no de tus proyectos.</p><dl class="pa-facts"><div><dt>Urgentes · P0</dt><dd class="tone-text" data-tone="coral">${pri('p0')}</dd></div><div><dt>Importantes · P1</dt><dd class="tone-text" data-tone="amber">${pri('p1')}</dd></div><div><dt>Cuando haya tiempo · P2</dt><dd>${pri('p2')}</dd></div></dl>${doing.length ? `<p class="xs faint">${plural(doing.length, 'ítem ya está', 'ítems ya están')} en curso.</p>` : ''}<a class="link small" href="${href('propuestas', { tab: 'Backlog' })}">Ver el backlog por tema ${ico('arrow', 'sm')}</a>`, { icon: 'list', tone: 'blue' })}
    </div>
    ${signalsCard(sig)}
  </div>`;
}
/** The factory's automatic signals, grouped; the usage-log one is flagged as unreliable when it flags almost every skill. */
function signalsCard(sig) {
  const total = sig.board.length + sig.recurring.length + sig.unused.length + sig.other.length;
  if (!total) return '';
  const skills = EXTRAS.config?.skills?.length || 0;
  const noisy = skills && sig.unused.length >= skills * 0.6;
  const grp = (tone, icon, title, note, items, render) => items.length ? `<details class="sig-group" data-tone="${tone}"><summary>${ico(icon, 'sm')}<b>${esc(title)}</b><span class="chip" data-tone="${tone}">${items.length}</span><span class="grow"></span>${ico('chevD', 'sm')}</summary><p class="xs muted">${note}</p><ul class="sig-list">${items.map(render).join('')}</ul></details>` : '';
  return card(`Señales automáticas <span class="chip" data-tone="slate">${total}</span>`, `<p class="small muted">Avisos que la fábrica genera sola. Ya están incluidos arriba cuando piden algo de ti.</p>
    ${grp('blue', 'columns', 'Columnas del tablero con muchas ideas', 'Una columna acumula ideas por encima del umbral. Las descubiertas se resuelven con <code>/pandacorp:recommend</code>; las descartadas no piden nada.', sig.board, s => `<li>${inl(s.summary || s.title)}</li>`)}
    ${grp('teal', 'rocket', 'Lecciones vistas en 2 proyectos', 'Se suman a «lecciones que esperan tu sí o no». Cada una se decide con su propio comando.', sig.recurring, s => `<li class="row between wrap"><span>${inl(s.summary || s.title)}</span><span class="ask-cmd">${ico('terminal', 'sm')}<code>${cmdWbr(`/pandacorp:learn ${s.target}`)}</code><button type="button" class="iconbtn" data-copy="/pandacorp:learn ${esc(s.target)}" aria-label="Copiar /pandacorp:learn ${esc(s.target)}">${ico('copy', 'sm')}</button></span></li>`)}
    ${grp('slate', 'activity', 'Skills sin uso registrado', noisy ? `<b>Señal poco fiable:</b> marca ${sig.unused.length} de ${skills} skills, incluidas algunas que se usan a diario. Solo mira las últimas 200 entradas del registro de uso; no pide ninguna acción.` : 'Skills sin eventos de uso en las últimas 200 entradas del registro. Revísalas si crees que deberías estar usándolas.', sig.unused, s => `<li><code>/pandacorp:${esc(s.target)}</code></li>`)}
    ${grp('slate', 'sparkles', 'Otras', '', sig.other, s => `<li>${inl(s.title)}</li>`)}`, { icon: 'sparkles', tone: 'slate' });
}
/** Memoria: the life of a lesson as a four-step flow, then the ones that need a decision. */
function memoryView(m) {
  const h = m.health;
  const stream = key => m.streams.find(s => s.key === key) || { items: [] };
  const promo = stream('promotions'), cand = stream('candidates'), prune = stream('prune');
  const sig = proposalSignals(m);
  const lessonRow = l => { const [tl, tt] = LESSON_TYPE[l.type] || [l.type || 'Lección', 'slate']; return `<button type="button" class="lrow" data-lesson="${esc(l.id)}"><span class="badge-icon sm" data-tone="${tt}">${ico('bulb', 'sm')}</span><div class="grow"><strong class="clamp-2">${inl(l.title)}</strong><small>${esc(l.id)}${l.domain ? ' · ' + esc(l.domain) : ''}${l.projects?.length ? ' · ' + esc(l.projects.join(', ')) : ''}</small></div>${chip(esc(tl), tt, 'outline')}</button>`; };
  const step = (tone, icon, n, label, sub) => `<div class="lf-step" data-tone="${tone}"><span class="lf-ico">${ico(icon, 'sm')}</span><b>${n}</b><span class="lf-label">${label}</span><span class="xs faint">${sub}</span></div>`;
  const arrow = (who, auto) => `<div class="lf-arrow ${auto ? 'is-auto' : 'is-you'}"><span aria-hidden="true">→</span><span class="xs">${who}</span></div>`;
  return `<div class="stack lg">
    <section class="card" data-tone="teal" aria-labelledby="lf-title"><div class="card-head"><h2 id="lf-title"><span class="badge-icon sm">${ico('activity', 'sm')}</span>Cómo avanza una lección</h2></div><p class="small muted">Cada build deja notas; la fábrica las convierte en lecciones y, cuando una se confirma en varios proyectos, te pide decidir si se vuelve regla para todos.</p>
      <div class="lf">${step('slate', 'inbox', h.rawNotes, 'Notas sin refinar', 'de los proyectos')}${arrow('rutina diaria', true)}${step('blue', 'bulb', cand.items.length, 'Candidatas', 'esperan confirmarse')}${arrow('2+ proyectos', true)}${step('teal', 'rocket', promo.items.length + sig.recurring.length, 'Esperan tu decisión', 'sí o no')}${arrow('tú decides', false)}${step('violet', 'shield', m.counts.byStatus.active, 'Reglas activas', 'para todos los proyectos')}</div>
      <p class="xs faint">Última revisión automática: ${esc(fmtDate(h.lastMemoryRunAt || h.lastSweepAt))}${h.staleDays ? ` · hace ${plural(h.staleDays, 'día', 'días')}` : ' · al día'}. ${prune.items.length ? `${plural(prune.items.length, 'lección obsoleta', 'lecciones obsoletas')} para podar.` : 'Ninguna lección obsoleta.'}</p></section>
    ${card(`Esperan tu decisión <span class="chip" data-tone="teal">${promo.items.length + sig.recurring.length}</span>`, `<p class="small muted card-intro">Abre una, lee qué propone y, si te convence, copia su comando. <code>/pandacorp:learn</code> la convierte en estándar, regla o skill; si no, la dejas como está.</p><div class="divided">${moreList('promo', promo.items, lessonRow, 8)}</div>${sig.recurring.length ? `<p class="band-sub">Recién detectadas en 2 proyectos</p><div class="divided">${sig.recurring.map(s => { const l = m.streams.flatMap(x => x.items).find(x => x.id === s.target); const [tl, tt] = LESSON_TYPE[l?.type] || ['Lección', 'teal']; const where = (s.summary.match(/\(([^()]*)\)\s*$/) || [])[1]; return `<div class="lrow"><span class="badge-icon sm" data-tone="${tt}">${ico('bulb', 'sm')}</span><div class="grow"><strong class="clamp-2">${inl(l?.title || s.title)}</strong><small>${esc(s.target)}${l?.domain ? ' · ' + esc(l.domain) : ''}${where ? ' · ' + esc(where) : ''}</small></div>${chip('Nueva', 'teal')}<span class="ask-cmd">${ico('terminal', 'sm')}<code>${cmdWbr(`/pandacorp:learn ${s.target}`)}</code><button type="button" class="iconbtn" data-copy="/pandacorp:learn ${esc(s.target)}" aria-label="Copiar /pandacorp:learn ${esc(s.target)}">${ico('copy', 'sm')}</button></span></div>`; }).join('')}</div>` : ''}`, { icon: 'rocket', tone: 'teal' })}
    <details class="card"><summary class="row between" style="cursor:pointer;list-style:none"><h2 class="row"><span class="badge-icon sm" data-tone="blue">${ico('bulb', 'sm')}</span>Candidatas <span class="chip" data-tone="blue">${cand.items.length}</span></h2><span class="row small muted"><span class="hide-sm">No piden nada</span>${ico('chevD', 'sm')}</span></summary><p class="small muted" style="margin:12px 0 8px">Se confirman solas cuando vuelven a aparecer en otro proyecto.</p><div class="divided">${moreList('cand', cand.items, lessonRow, 10)}</div></details>
    ${prune.items.length ? card(`Para podar <span class="chip" data-tone="slate">${prune.items.length}</span>`, `<div class="divided">${prune.items.map(lessonRow).join('')}</div>${cmd('/pandacorp:memory review')}`, { icon: 'trash', tone: 'slate' }) : ''}
  </div>`;
}
/** Backlog: priority at a glance, a by-area breakdown that filters, then the lists. */
function backlogView(b) {
  const pri = UI.backlogPri, ty = UI.backlogType, area = UI.backlogArea;
  const areaOf = it => BACKLOG_AREA[it.area || 'otros'] || it.area;
  const match = it => (!pri || it.priority === pri) && (!ty || it.type === ty) && (!area || areaOf(it) === area);
  const sortP = (a, c) => (a.priority || 'p9').localeCompare(c.priority || 'p9') || a.id.localeCompare(c.id);
  const openAll = b.items.filter(i => ['open', 'doing'].includes(i.status));
  const doing = openAll.filter(i => i.status === 'doing' && match(i)).sort(sortP);
  const open = openAll.filter(i => i.status === 'open' && match(i)).sort(sortP);
  const hist = b.items.filter(i => ['done', 'discarded'].includes(i.status) && match(i)).sort((a, c) => String(c.closed || c.date || '').localeCompare(String(a.closed || a.date || '')));
  const row = it => { const [pl, pt] = PRIORITY[it.priority] || ['—', 'slate']; return `<button type="button" class="lrow bl-row" data-backlog="${esc(it.id)}"><span class="mono faint bl-id" style="font-size:12px;min-width:70px">${esc(it.id)}</span><div class="grow"><strong class="clamp-2">${inl(it.title)}</strong><small>${esc(areaOf(it))} · ${esc(fmtDate(it.date))}</small></div>${chip(it.type === 'bug' ? 'Bug' : 'Mejora', it.type === 'bug' ? 'coral' : 'blue', 'outline')}${chip(pl, pt)}</button>`; };
  const prioTile = (k, label, hint) => { const [pl, pt] = PRIORITY[k]; const n = openAll.filter(i => i.priority === k && i.status === 'open').length; return `<button type="button" class="state-tile" data-tone="${pt}" data-bfilter="pri" data-val="${pri === k ? '' : k}" aria-pressed="${pri === k}"><span class="lbl"><span class="dot"></span>${pl} · ${label}</span><b>${n}</b><small class="faint">${hint}</small></button>`; };
  const areas = Object.entries(openAll.reduce((acc, i) => { const k = areaOf(i); acc[k] = (acc[k] || 0) + 1; return acc; }, {})).sort((x, y) => y[1] - x[1]);
  const maxA = areas[0]?.[1] || 1;
  const sec = (k, label) => { const list = open.filter(i => i.priority === k); return list.length ? `<p class="band-sub">${PRIORITY[k][0]} · ${label} <span class="faint">${list.length}</span></p><div class="divided">${moreList('bl-' + k, list, row, k === 'p2' ? 10 : 20)}</div>` : ''; };
  const filtered = pri || ty || area;
  return `<div class="stack lg">
    <div class="state-strip" role="group" aria-label="Filtrar por prioridad">${prioTile('p0', 'urgente', 'arréglalo primero')}${prioTile('p1', 'importante', 'pronto, de a uno')}${prioTile('p2', 'cuando haya tiempo', 'mejoras y detalles')}</div>
    <div class="grid-2">
      ${card('Por tema', `<p class="small muted card-intro">Dónde se concentran los arreglos. Clic para filtrar.</p><div class="area-bars" role="group" aria-label="Filtrar por tema">${areas.map(([k, n]) => `<button type="button" class="area-bar" data-barea="${esc(k)}" aria-pressed="${area === k}"><span class="area-name">${esc(k)}</span><span class="area-track"><span style="width:${Math.round((n / maxA) * 100)}%"></span></span><b>${n}</b></button>`).join('')}</div>`, { icon: 'layers', tone: 'blue' })}
      ${card('Cómo avanzar', `<div class="stack sm"><p class="small"><b>Todo de una vez.</b> <span class="muted">Lanza un agente por ítem (${openAll.length} ítems): consume mucho y conviene solo con la cola corta.</span></p>${cmd('/pandacorp:implement-backlog')}<p class="small" style="margin-top:8px"><b>Uno por uno.</b> <span class="muted">Abre un ítem y copia su comando; empieza por los P0 y P1.</span></p>${cmd(`/pandacorp:implement-backlog ${(openAll.filter(i => i.status === 'open').sort(sortP)[0] || { id: 'BL-NNNN' }).id}`)}<p class="xs faint">Se corren en la carpeta de la fábrica.</p></div>`, { icon: 'terminal', tone: 'violet' })}
    </div>
    <div class="toolbar"><div class="chipset" role="group" aria-label="Tipo">${[['', 'Todo tipo', 'slate'], ['bug', 'Bugs', 'coral'], ['change', 'Mejoras', 'blue']].map(([v, l, t]) => `<button type="button" class="chipbtn" data-tone="${t}" data-bfilter="type" data-val="${v}" aria-pressed="${ty === v}">${l}${v ? ` <span class="n">${openAll.filter(i => i.type === v).length}</span>` : ''}</button>`).join('')}</div><span class="grow"></span>${filtered ? `<button type="button" class="link small" data-action="backlog-clear">${ico('x', 'sm')}Quitar filtros</button>` : ''}<span class="small faint">${plural(open.length + doing.length, 'ítem', 'ítems')}</span></div>
    ${doing.length ? card(`En curso <span class="chip" data-tone="violet">${doing.length}</span>`, `<div class="divided">${doing.map(row).join('')}</div>`, { icon: 'bolt', tone: 'violet' }) : ''}
    ${card(`Abiertos <span class="chip" data-tone="blue">${open.length}</span>`, open.length ? `${sec('p0', 'urgente')}${sec('p1', 'importante')}${sec('p2', 'cuando haya tiempo')}` : empty('Nada abierto con este filtro.', 'check'), { icon: 'list', tone: 'blue' })}
    <details class="card"><summary class="row between" style="cursor:pointer;list-style:none"><h2 class="row"><span class="badge-icon sm" data-tone="green">${ico('archive', 'sm')}</span>Hechos y descartados <span class="chip" data-tone="green">${hist.length}</span></h2>${ico('chevD', 'sm')}</summary><div class="divided" style="margin-top:12px">${moreList('bl-hist', hist, row, 15)}</div></details>
    ${b.errors?.length ? `<div class="notice" data-tone="coral">${ico('alert')}<p>${b.errors.map(esc).join('<br>')}</p></div>` : ''}
  </div>`;
}
/** Plain-language names for the backlog's area codes. */
const BACKLOG_AREA = { 'build-engine': 'Motor de construcción', 'plugin-skill': 'Skills', templates: 'Plantillas de proyecto', hooks: 'Controles automáticos', 'plugin-hooks': 'Controles automáticos', standards: 'Estándares', 'mission-control': 'Mission Control', 'plugin-agent': 'Agentes', plugin: 'Plugin', otros: 'Otros' };

/* ================= Logros ================= */
const RARITY = { 'Común': 'slate', 'Poco común': 'teal', 'Raro': 'blue', 'Épico': 'violet', 'Leyenda': 'gold' };
const CATEGORY = { Discovery: 'Descubrimiento', Speed: 'Velocidad', Quality: 'Calidad', Consistency: 'Constancia', Mastery: 'Maestría', Production: 'Producción', Guild: 'Gremio', Resilience: 'Resiliencia', Secret: 'Secretos', grand: 'Todos los sellos' };
function achievements() {
  if (!EXTRAS?.guild) return pageHead('Logros', 'El progreso del gremio.') + missingExtras('el gremio');
  const g = EXTRAS.guild;
  const tab = ['Resumen', 'Misiones', 'Trofeos', 'Estadísticas', 'Rangos'].includes(P('tab')) ? P('tab') : 'Resumen';
  const unlocked = g.trophies.filter(t => t.unlocked);
  const regular = g.trophies.filter(t => !t.secret);
  const secrets = g.trophies.filter(t => t.secret);
  const body = { Resumen: guildSummary, Misiones: missionsView, Trofeos: trophiesView, 'Estadísticas': statsView, Rangos: ranksView }[tab](g);
  return pageHead('Logros', 'El progreso que ha construido tu gremio, con la evidencia detrás.', { eyebrow: factoryStamp() })
    + `<section class="guild-hero"><div class="crest-xl"><span><img src="assets/ranks/${esc(rankSprite(g))}.png" alt="" width="64" height="64" style="image-rendering:pixelated"></span></div>
      <div class="grid" style="gap:6px;min-width:0"><span class="eyebrow" style="color:var(--gold)">Gremio Pandacorp · nivel ${g.level}</span><h2 style="font-size:26px">${esc(g.rankName)}</h2><p class="small muted">${g.xp} XP · ${g.nextLevelXp - g.xp} para el nivel ${g.level + 1}</p><div style="max-width:420px;margin-top:6px">${bar(g.pctToNext, 'gold')}</div></div>
      <div class="row wrap" style="gap:20px"><div class="hero-stats"><div class="st"><b>${unlocked.filter(t => !t.secret).length}/${regular.length}</b><small>trofeos</small></div><div class="st"><b>${secrets.filter(t => t.unlocked).length}/${secrets.length}</b><small>secretos</small></div><div class="st"><b>${g.stats?.tiersReached ?? '—'}/${g.missions.reduce((n, m) => n + m.tiers.length, 0)}</b><small>niveles de misión</small></div></div></div></section>`
    + tabs([{ id: 'Resumen', icon: 'gauge', tone: 'gold' }, { id: 'Misiones', icon: 'flag', tone: 'gold' }, { id: 'Trofeos', icon: 'trophy', tone: 'gold', badge: unlocked.length }, { id: 'Estadísticas', icon: 'activity', tone: 'gold' }, { id: 'Rangos', icon: 'crown', tone: 'gold' }], tab, 'tab', 'Secciones de logros')
    + `<div role="tabpanel" aria-label="${tab}">${body}</div>`;
}
function trophyTile(t) {
  const tone = t.secret ? 'violet' : RARITY[t.rarity] || 'slate';
  return `<button type="button" class="trophy ${t.unlocked ? '' : 'locked'}" data-tone="${tone}" data-trophy="${esc(t.id)}"><span class="ticon" ${t.unlocked ? 'style="color:var(--gold);background:color-mix(in srgb,var(--gold) 18%,transparent)"' : ''}>${ico(t.unlocked ? 'trophy' : 'lock')}</span><b>${esc(t.title)}</b><small class="clamp-2">${esc(t.description || '')}</small><div class="row wrap">${t.rarity ? chip(esc(t.rarity), tone) : ''}${t.unlocked ? chip(`${ico('check', 'sm')}${esc(fmtDate(t.unlockedAt))}`, 'green') : chip('Bloqueado', '', 'plain')}</div></button>`;
}
function guildSummary(g) {
  const near = g.missions.filter(m => m.nextTier && m.pctToNext > 0).sort((a, b) => b.pctToNext - a.pctToNext).slice(0, 5);
  const recent = g.trophies.filter(t => t.unlocked && t.unlockedAt).sort((a, b) => Date.parse(b.unlockedAt) - Date.parse(a.unlockedAt)).slice(0, 4);
  return `<div class="grid-2"><div class="stack lg">
    ${card('Casi lo tienes', near.length ? `<div class="stack">${near.map(m => `<div><div class="row between"><strong>${esc(m.nextTier.name)}</strong><span class="small faint">${m.value} / ${m.nextTier.threshold}</span></div><p class="small muted">${esc(m.title)} · ${esc(m.saga)}</p><div style="margin-top:8px">${bar(m.pctToNext, 'gold')}</div></div>`).join('')}</div>` : empty('Ninguna misión cerca de su siguiente nivel.'), { icon: 'target', tone: 'gold' })}
    ${card('Sellos del gremio', `<div class="stack sm">${g.seals.map(s => `<div class="row"><span class="badge-icon sm" data-tone="${s.unlocked ? 'gold' : 'slate'}">${ico(s.unlocked ? 'shield' : 'lock', 'sm')}</span><div class="grow"><div class="row between"><b style="font-size:14px">${esc(s.name)}</b><span class="small faint">${s.earned}/${s.total}</span></div><div class="small faint">${esc(CATEGORY[s.axis] || s.axis)}</div><div style="margin-top:6px">${bar(pctOf(s.earned, s.total), s.unlocked ? 'gold' : 'slate')}</div></div></div>`).join('')}</div>`, { icon: 'shield', tone: 'gold' })}
  </div><div class="stack lg">${nextRankCard(g)}${card('Trofeos recientes', recent.length ? `<div class="trophies" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${recent.map(trophyTile).join('')}</div>` : empty('Aún no hay trofeos.', 'trophy'), { icon: 'trophy', tone: 'gold' })}${g.stats?.radar ? card('Atributos del gremio', `<div class="sum-radar">${radarSvg(g.stats.radar)}<div><p class="small muted">Tu forma como gremio: <b>${esc(radarStrong(g.stats.radar))}</b> es lo más fuerte; ${esc(radarWeak(g.stats.radar))}.</p><a class="link small" href="${href('logros', { tab: 'Estadísticas' })}">Ver todas las estadísticas ${ico('arrow', 'sm')}</a></div></div>`, { icon: 'radar', tone: 'gold' }) : ''}</div></div>`;
}
const RADAR_LABEL = { produccion: 'producción', velocidad: 'velocidad', calidad: 'calidad', constancia: 'constancia', ideacion: 'ideación', alcance: 'alcance' };
const radarStrong = r => RADAR_LABEL[Object.entries(r).sort((a, b) => b[1] - a[1])[0][0]];
const radarWeak = r => { const z = Object.entries(r).filter(([, v]) => v === 0).map(([k]) => RADAR_LABEL[k]); return z.length ? `${z.join(', ')} aún sin datos` : `${RADAR_LABEL[Object.entries(r).sort((a, b) => a[1] - b[1])[0][0]]} lo que más puede crecer`; };
/** The climb at a glance: current emblem → next emblem, XP left, and the two ranks after it. */
function nextRankCard(g) {
  const i = g.ranks.findIndex(r => r.current);
  const cur = g.ranks[i], next = g.ranks[i + 1];
  if (!cur || !next) return '';
  const left = Math.max(0, next.xp - g.xp);
  return card('Tu siguiente rango', `<div class="nr"><div class="nr-step"><span class="rank-emblem"><img src="assets/ranks/${esc(cur.sprite)}.png" alt="" width="56" height="56"></span><b>${esc(cur.name)}</b><span class="xs faint">ahora · Nv ${g.level}</span></div><span class="nr-arrow" aria-hidden="true">${ico('arrow')}</span><div class="nr-step next"><span class="rank-emblem"><img src="assets/ranks/${esc(next.sprite)}.png" alt="" width="56" height="56"></span><b>${esc(next.name)}</b><span class="xs faint">desde Nv ${next.minLevel}</span></div></div>
    <div class="mbar" role="progressbar" aria-label="XP hacia ${esc(next.name)}" aria-valuenow="${pctOf(g.xp - cur.xp, next.xp - cur.xp)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pctOf(g.xp - cur.xp, next.xp - cur.xp)}%"></span></div>
    <p class="small muted" style="margin-top:8px">Faltan <b>${left.toLocaleString('es')} XP</b>. Se gana XP construyendo: cada work order verificada, fase completada y lanzamiento suma.</p><a class="link small" href="${href('logros', { tab: 'Rangos' })}">Ver el escalafón ${ico('arrow', 'sm')}</a>`, { icon: 'crown', tone: 'gold' });
}

/** Unlocked trophies, newest first (secrets included once revealed). */
const unlockedByDate = g => g.trophies.filter(t => t.unlocked && t.unlockedAt).sort((a, b) => Date.parse(b.unlockedAt) - Date.parse(a.unlockedAt));
/** Fresh = flagged new by the app, or unlocked within 7 days of the capture. */
const freshAchievements = g => unlockedByDate(g).filter(t => t.isNew || Date.parse(EXTRAS.capturedAt) - Date.parse(t.unlockedAt) < 7 * 864e5);
function lastAchievement(g) {
  const t = unlockedByDate(g)[0];
  if (!t) return '';
  const fresh = freshAchievements(g).includes(t);
  return `<a class="last-ach ${fresh ? 'fresh' : ''}" href="${href('logros', { tab: 'Trofeos' })}"><span class="la-ico">${ico('trophy', 'sm')}</span><span class="grow"><span class="xs faint">${fresh ? 'Nuevo logro' : 'Último logro'} · ${esc(fmtDate(t.unlockedAt))}</span><b>${esc(t.title)}</b></span>${fresh ? chip('Nuevo', 'gold') : ico('chevR', 'sm')}</a>`;
}
/**
 * One notice per fresh achievement the viewer has not seen in this browser. `?achievement=preview` shows
 * the latest unlock as a sample so the notice can be reviewed while nothing is fresh.
 */
function achievementNotice() {
  const g = EXTRAS?.guild;
  if (!g) return;
  const preview = new URLSearchParams(location.search).get('achievement') === 'preview';
  const seen = (store.get('orbita-ach-seen') || '').split('|');
  const t = preview ? unlockedByDate(g)[0] : freshAchievements(g).find(x => !seen.includes(x.id));
  if (!t) return;
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="la-ico">${ico('trophy')}</span><div class="grow"><span class="xs">${preview ? 'Vista previa del aviso' : '¡Nuevo logro!'}</span><b>${esc(t.title)}</b><span class="small muted">${esc(t.description || '')}</span></div><a class="btn sm" href="${href('logros', { tab: 'Trofeos' })}" data-ach-close>Ver</a><button type="button" class="iconbtn" data-ach-close aria-label="Cerrar aviso">${ico('x', 'sm')}</button>`;
  document.body.appendChild(el);
  const close = () => { if (!preview) store.set('orbita-ach-seen', [...seen, t.id].filter(Boolean).join('|')); el.remove(); };
  el.querySelectorAll('[data-ach-close]').forEach(b => b.addEventListener('click', close));
  setTimeout(() => el.isConnected && close(), 9000);
}

/* ---------- Misiones: one card per chain, grouped by saga, the closest one in the spotlight (as in the app) ---------- */
const MISSION_ICON = { shipped: 'rocket', ideas: 'bulb', workorders: 'clipboard', phases: 'stairs', iterations: 'rotate', flawless: 'diamond', discarded: 'trash', prds: 'file', adrs: 'book', agents: 'users', streak: 'flame', speed: 'bolt', builds: 'factory', subagents: 'users', gates: 'shield', reviews: 'eye', findings: 'search', modes: 'layers', activedays: 'clock' };
const SAGA_ICON = { 'La Construcción': 'factory', 'Las Ideas': 'bulb', 'El Oficio': 'trophy', 'El Gremio': 'users', 'El Tiempo': 'clock' };
/** A chain's tier rarity, by tier index (the app's tier ladder: común → leyenda). */
const TIER_RARITY = ['Común', 'Poco común', 'Raro', 'Épico', 'Leyenda'];
const tierChip = m => m.currentTierIndex < 0 ? chip('Sin tier', '', 'plain') : chip(TIER_RARITY[Math.min(m.currentTierIndex, 4)], RARITY[TIER_RARITY[Math.min(m.currentTierIndex, 4)]]);
const nodeLadder = m => `<div class="nodes" aria-hidden="true">${m.tiers.map((t, i) => `<span class="node-dot ${t.reached ? 'on' : ''} ${i === m.currentTierIndex ? 'cur' : ''}"></span>`).join('<span class="node-line"></span>')}</div>`;
function missionCard(m, spot = false) {
  const title = m.currentTierIndex >= 0 ? m.currentTierName : m.tiers[0]?.name || m.title;
  const next = m.nextTier;
  const goal = next ? `${m.value} / ${next.threshold}` : 'cadena completa';
  const pct = next ? m.pctToNext : 100;
  return `<article class="mcard ${spot ? 'spot' : ''} ${!spot && m.value === 0 ? 'idle' : ''}" data-tone="gold"><header class="mhead"><span class="mslot">${ico(MISSION_ICON[m.id] || 'star', spot ? '' : 'sm')}</span><div class="grow"><div class="row wrap" style="gap:6px">${spot ? chip(`${ico('bolt', 'sm')}A un paso de subir`, 'blue') : ''}<b class="mtitle">${esc(title)}</b>${tierChip(m)}</div><span class="small muted">${esc(m.title)}${m.lowerIsBetter ? ' · menos es mejor' : ''}</span></div>${spot ? `<span class="mpct">${pct}<small>%</small></span>` : ''}</header>
    ${nodeLadder(m)}
    <div class="row between small"><span class="muted">${ico('arrow', 'sm')}${esc(next?.name || 'Todos los tiers')}</span><span class="nowrap">${goal}</span></div>
    <div class="mbar" role="progressbar" aria-label="${esc(m.title)}: ${pct}% hacia ${esc(next?.name || 'el final')}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    <p class="xs faint mfoot">${m.value} acumulado</p></article>`;
}
/** Closest to its next tier first; missions with no progress at all go last. */
const missionOrder = (a, b) => (b.value > 0) - (a.value > 0) || (b.nextTier ? b.pctToNext : -1) - (a.nextTier ? a.pctToNext : -1) || b.value - a.value;
function missionsView(g) {
  const sagas = [...new Set(g.missions.map(m => m.saga))];
  const spot = g.missions.filter(m => m.nextTier).sort((a, b) => b.pctToNext - a.pctToNext)[0];
  return `<p class="small muted card-intro">Misiones acumulativas, agrupadas por saga: cada tier alcanzado deja huella verificable en el tiempo.</p>
    ${spot ? missionCard(spot, true) : ''}
    ${sagas.map(sg => { const list = g.missions.filter(m => m.saga === sg).sort(missionOrder); return `<section class="saga"><h2 class="saga-head">${ico(SAGA_ICON[sg] || 'flag', 'sm')}<span>${esc(sg)}</span><span class="saga-line"></span><span class="xs faint">${plural(list.length, 'misión', 'misiones')}</span></h2><div class="mgrid">${list.map(m => missionCard(m)).join('')}</div></section>`; }).join('')}`;
}

/* ---------- Trofeos: progress, seals, then conquered / to conquer / secrets (as in the app) ---------- */
function trophiesView(g) {
  const cats = [...new Set(g.trophies.filter(t => !t.secret).map(t => t.category))];
  const cat = UI.trophyCat;
  const regular = g.trophies.filter(t => !t.secret);
  const inCat = t => !cat || t.category === cat;
  const won = regular.filter(t => t.unlocked && inCat(t));
  const RANK = ['Común', 'Poco común', 'Raro', 'Épico', 'Leyenda'];
  const byEase = (a, b) => RANK.indexOf(a.rarity) - RANK.indexOf(b.rarity);
  const locked = regular.filter(t => !t.unlocked && inCat(t)).sort(byEase);
  const seen = new Set();
  const near = (cat ? locked.slice(0, 3) : locked.filter(t => !seen.has(t.category) && seen.add(t.category)).slice(0, 6));
  const todo = locked.filter(t => !near.includes(t));
  const secrets = g.trophies.filter(t => t.secret);
  const total = regular.filter(t => t.unlocked).length;
  const head = (icon, title, n, tone) => `<h2 class="saga-head" data-tone="${tone}">${ico(icon, 'sm')}<span>${title}</span><span class="saga-line"></span><span class="xs faint">${n}</span></h2>`;
  return `<div class="tprog card" data-tone="gold"><div class="row between wrap"><b class="card-title">${`<span class="badge-icon sm">${ico('trophy', 'sm')}</span>`}${total} / ${regular.length} trofeos conquistados</b><span class="small muted">${pctOf(total, regular.length)}%</span></div>${bar(pctOf(total, regular.length), 'gold')}</div>
    <section class="saga">${head('shield', 'Sellos', `${g.seals.filter(s => s.unlocked).length} de ${g.seals.length}`, 'gold')}<div class="seal-grid">${g.seals.map(s => `<div class="seal ${s.unlocked ? 'on' : ''}"><span class="seal-ico">${ico(s.unlocked ? 'shield' : 'lock', 'sm')}</span><div class="grow"><b>${esc(s.name)}</b><span class="xs faint">${esc(CATEGORY[s.axis] || s.axis)} · ${s.earned}/${s.total}</span><div class="seal-bar"><span style="width:${pctOf(s.earned, s.total)}%"></span></div></div></div>`).join('')}</div></section>
    <div class="chipset scroll-sm" role="group" aria-label="Categoría" style="margin:var(--s5) 0 4px">${[['', 'Todos', regular.length], ...cats.map(c => [c, CATEGORY[c] || c, regular.filter(t => t.category === c).length])].map(([v, l, n]) => `<button type="button" class="chipbtn" data-tone="gold" data-trophy-cat="${esc(v)}" aria-pressed="${cat === v}">${esc(l)} <span class="n">${n}</span></button>`).join('')}</div>
    <section class="saga">${head('trophy', 'Conquistados', won.length, 'gold')}${won.length ? `<div class="tgrid won">${won.map(t => `<button type="button" class="tcard won" data-trophy="${esc(t.id)}" data-tone="${RARITY[t.rarity] || 'slate'}"><span class="tslot">${ico('trophy')}</span><div class="grow"><b>${esc(t.title)}</b><span class="small muted">${esc(t.description || '')}</span><span class="trar"><span class="dot"></span>${esc(t.rarity || '')}</span>${t.unlockedAt ? `<span class="xs faint">${ico('clock', 'sm')}${esc(fmtDate(t.unlockedAt))}${t.project ? ` · ${esc(t.project)}` : ''}</span>` : ''}</div></button>`).join('')}</div>` : empty('Ningún trofeo conquistado en esta categoría.', 'trophy')}</section>
    ${near.length ? `<section class="saga">${head('target', 'Los más alcanzables', `${near.length} de ${locked.length}`, 'green')}<p class="small muted era-tag">Los de rareza más baja${cat ? '' : ', uno por categoría'}: los primeros que conviene perseguir.</p><div class="tgrid near">${near.map(t => `<button type="button" class="tcard near" data-trophy="${esc(t.id)}" data-tone="${RARITY[t.rarity] || 'slate'}"><span class="tslot">${ico('target', 'sm')}</span><div class="grow"><b>${esc(t.title)}</b><span class="small muted">${esc(t.description || '')}</span><span class="trar"><span class="dot"></span>${esc(t.rarity || '')} · ${esc(CATEGORY[t.category] || t.category)}</span></div></button>`).join('')}</div></section>` : ''}
    <section class="saga">${head('lock', 'Por conquistar', todo.length, 'slate')}${todo.length ? `<div class="tgrid todo">${moreList('todo', todo, t => `<button type="button" class="tcard" data-trophy="${esc(t.id)}" data-tone="${RARITY[t.rarity] || 'slate'}"><span class="tslot">${ico('lock', 'sm')}</span><div class="grow"><b>${esc(t.title)}</b><span class="xs muted">${esc(t.description || '')}</span><span class="trar"><span class="dot"></span>${esc(t.rarity || '')}</span></div></button>`, 12)}</div>` : empty('Todo conquistado en esta categoría.', 'check')}</section>
    ${!cat ? `<section class="saga">${head('sparkles', 'Secretos', `${secrets.filter(t => t.unlocked).length} de ${secrets.length}`, 'violet')}<div class="secret-grid">${secrets.map(t => `<button type="button" class="secret ${t.unlocked ? 'on' : ''}" data-trophy="${esc(t.id)}"><span aria-hidden="true">${t.unlocked ? ico('sparkles', 'sm') : '?'}</span><span>${esc(t.unlocked ? t.title : t.description)}</span></button>`).join('')}</div></section>` : ''}`;
}

/* ---------- Estadísticas: the app's operator report and character sheet, as charts ---------- */
const STAT_ICON = { shipped: 'rocket', workorders: 'clipboard', phases: 'stairs', builds: 'factory', subagents: 'users', flawless: 'diamond', gates: 'shield', reviews: 'eye', findings: 'search', prds: 'file', adrs: 'book', streak: 'flame', activedays: 'clock', speed: 'bolt', ideas: 'bulb', agents: 'users', modes: 'layers', discarded: 'trash', iterations: 'rotate' };
const LEDGER = [
  ['Producción', 'factory', 'gold', [['stat', 'shipped'], ['stat', 'workorders'], ['stat', 'phases'], ['stat', 'builds'], ['stat', 'subagents'], ['scalar', 'frds', 'FRDs completados', 'layers'], ['scalar', 'commits', 'Commits', 'branch'], ['scalar', 'projects', 'Proyectos creados', 'folder']]],
  ['Calidad', 'shield', 'teal', [['stat', 'flawless'], ['stat', 'gates'], ['stat', 'reviews'], ['stat', 'findings'], ['stat', 'prds'], ['stat', 'adrs'], ['scalar', 'testsPassing', 'Tests en verde', 'check'], ['scalar', 'decisions', 'Decisiones (DR)', 'flag']]],
  ['Ritmo y alcance', 'activity', 'violet', [['stat', 'streak'], ['stat', 'activedays'], ['stat', 'speed'], ['stat', 'ideas'], ['stat', 'agents'], ['stat', 'modes'], ['stat', 'discarded'], ['stat', 'iterations']]],
];
const week = k => `sem ${String(k).split('-')[1] || k}`;
/** Counters fed by build/agent events. A 0 here means no such event has been recorded yet, not a measured zero. */
const EVENT_STATS = new Set(['agents', 'streak', 'speed', 'builds', 'subagents', 'gates', 'reviews', 'findings', 'modes', 'activedays', 'iterations', 'flawless']);
const noData = (key, v) => EVENT_STATS.has(key) && !Number(v);
/** Six-axis radar of the guild's attributes (0–100 each), drawn in SVG with token colours. */
function radarSvg(axes) {
  const keys = [['produccion', 'Producción'], ['velocidad', 'Velocidad'], ['calidad', 'Calidad'], ['constancia', 'Constancia'], ['ideacion', 'Ideación'], ['alcance', 'Alcance']];
  const c = 120, R = 82;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  const ring = f => keys.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const data = keys.map(([k], i) => pt(i, R * Math.max(0.04, (axes[k] || 0) / 100)));
  return `<svg class="radar" viewBox="-44 0 328 240" role="img" aria-label="Atributos del gremio: ${keys.map(([k, l]) => `${l} ${axes[k] || 0}`).join(', ')}">
    ${[0.25, 0.5, 0.75, 1].map(f => `<polygon class="r-ring" points="${ring(f)}"/>`).join('')}${keys.map((_, i) => `<line class="r-axis" x1="${c}" y1="${c}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}"/>`).join('')}
    <polygon class="r-data" points="${data.map(p => p.join(',')).join(' ')}"/>${data.map(p => `<circle class="r-dot" cx="${p[0]}" cy="${p[1]}" r="3.5"/>`).join('')}
    ${keys.map(([k, l], i) => { const [x, y] = pt(i, R + 22); return `<text class="r-label" x="${x}" y="${y}" text-anchor="${x < c - 5 ? 'end' : x > c + 5 ? 'start' : 'middle'}" dominant-baseline="middle">${l}</text>`; }).join('')}</svg>`;
}
/** Column chart for a weekly series (CSS bars, value on top). */
function columns(series, tone, unit) {
  const max = Math.max(1, ...series.map(b => b.count));
  return `<div class="cols" data-tone="${tone}" role="img" aria-label="${series.map(b => `${week(b.isoWeek)}: ${b.count} ${unit}`).join(', ')}">${series.map(b => `<div class="col"><span class="col-v">${b.count}</span><span class="col-bar" style="height:${Math.max(3, Math.round((b.count / max) * 100))}%"></span><span class="col-k">${week(b.isoWeek)}</span></div>`).join('')}</div>`;
}
/** Line chart for a weekly series (SVG polyline with dots and labels). */
function lineChart(series, tone, unit) {
  const max = Math.max(1, ...series.map(b => b.count));
  const W = 320, H = 120, px = 18, py = 20;
  const xy = series.map((b, i) => [px + (series.length > 1 ? i * (W - 2 * px) / (series.length - 1) : (W - 2 * px) / 2), H - py - (b.count / max) * (H - 2 * py)]);
  return `<div class="linechart" data-tone="${tone}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${series.map(b => `${week(b.isoWeek)}: ${b.count} ${unit}`).join(', ')}" preserveAspectRatio="none"><polyline class="l-area" points="${px},${H - py} ${xy.map(p => p.join(',')).join(' ')} ${W - px},${H - py}"/><polyline class="l-line" points="${xy.map(p => p.join(',')).join(' ')}"/>${xy.map((p, i) => `<circle class="l-dot" cx="${p[0]}" cy="${p[1]}" r="3.5"/><text class="l-val" x="${p[0]}" y="${p[1] - 9}" text-anchor="middle">${series[i].count}</text>`).join('')}</svg><div class="l-keys">${series.map(b => `<span>${week(b.isoWeek)}</span>`).join('')}</div></div>`;
}
const bandHead = (title, sub) => `<h2 class="saga-head"><span>${title}</span><span class="saga-line"></span><span class="xs faint">${sub}</span></h2>`;
const insight = text => `<p class="insight">${ico('arrow', 'sm')}${text}</p>`;
function statsView(g) {
  const st = g.stats || {};
  const inf = st.informe;
  if (!inf) return empty('La captura no incluye el informe de estadísticas. Regenera data/extras.js con el exportador de OPEN-MOCKUP.md.', 'chart');
  const rows = new Map((st.rows || []).map(r => [r.key, r]));
  const lvl = k => st.levels?.[k] || 0;
  const nv = k => lvl(k) ? `<span class="nv" data-tone="${lvl(k) >= 4 ? 'violet' : lvl(k) >= 2 ? 'teal' : 'slate'}">Nv ${lvl(k)}</span>` : '';
  const p = inf.pulse;
  const delta = p.woPerWeek - p.woPrevWeek;
  const kpi = (label, value, unit, foot, tone = '') => `<div class="kpi" ${tone ? `data-tone="${tone}"` : ''}><span class="kpi-l">${label}</span><b>${value}<small>${unit}</small></b><span class="xs muted">${foot}</span></div>`;
  const hero = (key, label, icon, value, sub) => noData(key, value) ? `<div class="hstat nodata"><div class="row between"><span class="hstat-l">${ico(icon, 'sm')}${label}</span></div><b>—</b><span class="xs faint">sin datos aún</span></div>` : `<div class="hstat"><div class="row between"><span class="hstat-l">${ico(icon, 'sm')}${label}</span>${key ? nv(key) : ''}</div><b>${value}</b><span class="xs faint">${sub}</span></div>`;
  const ledgerRow = ([kind, key, label, icon]) => { if (kind === 'stat') { const r = rows.get(key); const v = r?.value ?? 0; return noData(key, v) ? `<li class="nodata"><span class="lg-ico">${ico(STAT_ICON[key] || 'star', 'sm')}</span><span class="grow">${esc(r?.label || key)}</span><span class="xs faint">sin datos aún</span></li>` : `<li><span class="lg-ico">${ico(STAT_ICON[key] || 'star', 'sm')}</span><span class="grow">${esc(r?.label || key)}</span>${nv(key)}<span class="lg-dot ${v ? 'on' : ''}"></span><b>${v}</b></li>`; } const v = st.scalars?.[key]; return `<li><span class="lg-ico">${ico(icon, 'sm')}</span><span class="grow">${esc(label)}</span>${v == null ? '<span class="xs faint">no cableado</span>' : `<b>${v}</b>`}</li>`; };
  const wf = inf.weeklyFlow.ok ? inf.weeklyFlow.value : null;
  const f = inf.funnel;
  const alive = f.totalIdeas - (f.byStatus.discarded || 0);
  const fmax = Math.max(1, f.totalIdeas);
  const fbar = (n, label, tone) => `<div class="fn-row" data-tone="${tone}"><span class="fn-bar" style="width:${Math.max(4, Math.round((n / fmax) * 100))}%"></span><span class="small"><b>${n}</b> ${label}</span></div>`;
  const trans = inf.transitions.ok ? inf.transitions.value.slice(-12) : [];
  const usage = inf.usage.ok ? inf.usage.value : null;
  return `<div class="stack lg">
    ${bandHead('Resumen ejecutivo', 'El pulso de la fábrica')}
    <section class="card" data-tone="teal"><div class="card-head"><h3><span class="badge-icon sm">${ico('activity', 'sm')}</span>El pulso de la fábrica</h3></div><p class="verdict">${esc(inf.verdict)}</p>
      <div class="kpis">${kpi('Work orders verificados / semana', p.woPerWeek, ' últ. sem', `${delta >= 0 ? '↗' : '↘'} ${p.woPerWeek} vs ${p.woPrevWeek} la previa`, 'teal')}${kpi('Proyectos activos', p.wip, ' en curso', esc(p.wipLabel || ''), 'violet')}${kpi('Conversión', p.conversionPct, '% idea→lanzado', `${p.launched} lanzada de ${p.totalIdeas}`, 'blue')}${kpi('Lead time', '—', ' idea→release', 'no cableado')}</div></section>
    <div class="stats-top"><section class="card radar-card" data-tone="gold"><div class="card-head"><h3><span class="badge-icon sm">${ico('radar', 'sm')}</span>Atributos del gremio</h3></div>${radarSvg(st.radar || {})}</section>
      <div class="hstats">${hero('shipped', 'Productos lanzados', 'rocket', rows.get('shipped')?.value ?? 0, 'tu marca del gremio')}${hero('streak', 'Racha récord', 'flame', rows.get('streak')?.value ?? 0, 'semanas seguidas')}${hero('speed', 'Récord idea→launch', 'bolt', rows.get('speed')?.value || '—', 'días, lo más rápido')}${hero('', 'Pico semanal', 'trophy', st.records?.peakWeek ?? 0, 'work orders en la mejor semana')}${hero('', 'Lecciones', 'book', st.records?.capturedLessons ?? 0, 'capturadas en memoria')}${hero('subagents', 'Subagentes', 'users', st.records?.subagents ?? 0, 'coordinados en total')}</div></div>
    <p class="small muted row" style="gap:6px;margin:0">${ico('alert', 'sm')}«Sin datos aún»: la fábrica todavía no registra ese tipo de evento (gates, reviews, días activos…). No es un cero medido.</p>
    <div class="ledgers">${LEDGER.map(([title, icon, tone, items]) => `<section class="card ledger" data-tone="${tone}"><div class="card-head"><h3><span class="badge-icon sm">${ico(icon, 'sm')}</span>${title}</h3></div><ul>${items.map(ledgerRow).join('')}</ul></section>`).join('')}</div>
    ${bandHead('En el tiempo, de verdad', '¿Cómo voy semana a semana?')}
    ${wf ? `<div class="grid-2"><section class="card" data-tone="teal"><div class="card-head"><h3><span class="badge-icon sm">${ico('chart', 'sm')}</span>Work orders verificados por semana</h3></div>${columns(wf.woVerified, 'teal', 'work orders')}${insight(`Pico de ${wf.peakWeek} en una semana; la última semana con datos cerró ${wf.woVerified.at(-1)?.count ?? 0}.`)}</section><section class="card" data-tone="violet"><div class="card-head"><h3><span class="badge-icon sm">${ico('bulb', 'sm')}</span>Ideas capturadas por semana</h3></div>${lineChart(wf.ideasCaptured, 'violet', 'ideas')}${insight('Las ideas llegan a ráfagas, no de forma continua.')}</section></div>` : `<div class="notice" data-tone="coral">${ico('alert')}<p>No se pudo leer la serie semanal.</p></div>`}
    ${bandHead('Cómo usas la fábrica', '¿En qué me apoyo y a qué coste?')}
    <div class="grid-2"><section class="card" data-tone="violet"><div class="card-head"><h3><span class="badge-icon sm">${ico('layers', 'sm')}</span>Workflows y skills más usados</h3></div>${usage?.workflows?.length ? `<ul class="hbars">${usage.workflows.map(w => `<li><span>${esc(w.name || w.label)}</span><b>${esc(w.count)}</b></li>`).join('')}</ul>` : `<p class="small muted">Sin eventos de uso en el registro todavía: este bloque se llena cuando las skills emiten su evento.</p>`}</section><section class="card" data-tone="blue"><div class="card-head"><h3><span class="badge-icon sm">${ico('bolt', 'sm')}</span>Esfuerzo de los agentes</h3></div>${usage?.effort?.length ? `<ul class="hbars">${usage.effort.map(e => `<li><span>${esc(e.name || e.label)}</span><b>${esc(e.count)}</b></li>`).join('')}</ul>` : `<p class="small muted">Sin registro de esfuerzo por agente todavía.</p>`}</section></div>
    ${bandHead('Embudo y flujo', '¿Dónde se atascan las ideas y los proyectos?')}
    <div class="grid-2"><section class="card" data-tone="teal"><div class="card-head"><h3><span class="badge-icon sm">${ico('target', 'sm')}</span>Embudo ideas → lanzado</h3></div><div class="funnel-x">${fbar(f.totalIdeas, 'capturadas', 'teal')}${fbar(alive, 'vivas', 'blue')}${fbar(f.byStatus['in-pipeline'] || 0, 'en pipeline', 'violet')}${fbar(f.launched, f.launched === 1 ? 'lanzada' : 'lanzadas', 'green')}</div>${insight('El cuello está en decidir y arrancar: pocas ideas entran al pipeline.')}</section>
      <section class="card" data-tone="blue"><div class="card-head"><h3><span class="badge-icon sm">${ico('branch', 'sm')}</span>Transiciones de fase por proyecto</h3></div>${trans.length ? `<ul class="trans">${trans.slice(0, UI.more.trans || 10).map(t => `<li><span class="xs faint nowrap tr-d">${esc(fmtDate(t.date))}</span><span class="tr-p">${esc(t.project)}</span><span class="tr-f">${esc(phaseOf(t.from).label)} ${t.isReopen ? '↺' : '→'} <b>${esc(phaseOf(t.to).label)}</b></span>${t.isReopen ? chip('Reapertura', 'amber') : ''}</li>`).join('')}</ul>${moreList('trans', trans, () => '', 10)}` : '<p class="small muted">Sin transiciones registradas.</p>'}</section></div>
    ${bandHead('Estado y salud del proceso', '¿Qué proyectos hay y qué señales vigilar?')}
    <div class="grid-2"><section class="card" data-tone="blue"><div class="card-head"><h3><span class="badge-icon sm">${ico('folder', 'sm')}</span>Proyectos por estado</h3></div><ul class="kvlist">${inf.projectsByPhase.map(x => `<li><span class="mono small">${esc(x.project)}</span>${chip(esc(phaseOf(x.phase).label), phaseOf(x.phase).tone)}</li>`).join('')}</ul></section>
      <section class="card" data-tone="slate"><div class="card-head"><h3><span class="badge-icon sm">${ico('shield', 'sm')}</span>Señales del proceso</h3></div><ul class="kvlist"><li><span>Lecciones destiladas</span><b class="tone-text" data-tone="amber">${inf.signals.distilledLessons ?? '—'} / ${inf.signals.capturedLessons ?? '—'}</b></li><li><span>Relanzamientos de build</span><b>${inf.signals.relaunches}</b></li><li><span>Descartes sin razón estructurada</span><b class="tone-text" data-tone="${inf.signals.discardsWithoutReason ? 'coral' : 'green'}">${inf.signals.discardsWithoutReason}</b></li><li><span>Telemetría de calidad</span><span class="small faint">no cableado</span></li></ul></section></div>
    ${inf.actions?.length ? `${bandHead('Qué mover ahora', 'La conclusión, con su comando')}<section class="card">${inf.actions.map(a => `<div class="row between wrap" style="gap:12px"><p class="row" style="gap:8px">${ico('arrow', 'sm')}${esc(a.label)}</p>${cmd(a.command)}</div>`).join('')}</section>` : ''}
  </div>`;
}

/* ---------- Rangos: the 40 ranks in six eras, one row each (as in the app) ---------- */
const RANK_ERAS = [['El despertar', 'Los primeros pasos del gremio', 0, 3], ['Los portadores', 'Llevar la luz a la obra', 4, 6], ['Los guardianes', 'Custodios del juramento, los glifos y el éter', 7, 15], ['Los campeones', 'Esquirlas, espadas y reinos', 16, 24], ['Los ascendidos', 'Heraldos, tormentas y trascendencia', 25, 33], ['La trascendencia', 'Más allá de lo mortal: la cima', 34, 39]];
const RANK_FLAVOR = { human: 'El punto de partida: todo gremio empieza con una sola persona.', 'dawn-seeker': 'Buscas la primera luz; el camino apenas comienza.', lightbearer: 'Llevas la llama que guía a quienes vienen detrás.', oathkeeper: 'Tu palabra es ley; el juramento no se rompe.', glyphwarden: 'Custodias los glifos que dan forma a la obra.', 'aether-warden': 'Dominas la energía que fluye entre los mundos.', shardbearer: 'Portas una esquirla de poder puro.', 'knight-radiant': 'Tu espada brilla con la luz de mil victorias.', realmcaller: 'Invocas reinos enteros con una sola orden.', 'dawn-herald': 'Anuncias el amanecer de una nueva era.', stormlord: 'El trueno responde a tu llamada.', ascendant: 'Te elevas por encima de lo mortal.', 'phoenix-ascendant': 'Renaces de tus cenizas, más fuerte cada vez.', 'leviathan-lord': 'Las profundidades te obedecen.', 'crimson-dragonlord': 'El dragón carmesí vuela bajo tu estandarte.', 'celestial-warden': 'Vigilas el gremio desde las estrellas.', 'dawn-sovereign': 'Reinas sobre el alba eterna.', 'eternal-oathbearer': 'La cima: el juramento que nunca termina.' };
/** The rank ladder: one row per rank, grouped by era; the current rank shows the XP left to the next. */
function ranksView(g) {
  const roman = n => ['', 'I', 'II', 'III'][n] || '';
  const cur = g.ranks.findIndex(r => r.current);
  const next = g.ranks[cur + 1];
  const row = (r, i) => {
    const state = r.current ? 'current' : r.attained ? 'done' : 'locked';
    return `<li class="rank ${state}"><span class="rank-emblem"><img src="assets/ranks/${esc(r.sprite)}.png" alt="" width="56" height="56">${r.grade ? `<span class="rank-grade">${roman(r.grade)}</span>` : ''}</span>
      <div class="grow"><b>${esc(r.name)}</b><span class="small muted">${esc(RANK_FLAVOR[r.sprite] || '')}</span><span class="xs faint">Nv ${r.minLevel}${r.maxLevel ? `–${r.maxLevel}` : '+'}</span>
      ${r.current && next ? `<div class="rank-prog"><div class="mbar"><span style="width:${g.pctToNext}%"></span></div><span class="xs muted">Faltan ${Math.max(0, next.xp - g.xp)} XP para ${esc(next.name)}</span></div>` : ''}</div>
      <span class="rank-state">${r.current ? `<span class="chip" data-tone="gold">${ico('target', 'sm')}Estás aquí</span>` : r.attained ? `<span class="chip" data-tone="green">${ico('check', 'sm')}Conseguido</span>` : `<span class="xs faint row" style="gap:4px">${ico('lock', 'sm')}Nv ${r.minLevel}</span>`}<span class="xs faint">${r.xp.toLocaleString('es')} XP</span></span></li>`;
  };
  return `<p class="small muted card-intro">El escalafón del gremio: tu nivel sube con XP y cada rango cubre un tramo de niveles. Cada nivel cuesta más que el anterior; la cima está lejos a propósito.</p>
    ${RANK_ERAS.map(([name, tag, from, to], e) => { const list = g.ranks.slice(from, to + 1); const lv = `Nv ${list[0]?.minLevel}${list.at(-1)?.maxLevel ? `–${list.at(-1).maxLevel}` : '+'}`; const curEra = RANK_ERAS.findIndex(([, , f, t]) => cur >= f && cur <= t); const far = e > curEra + 1; const done = list.every(r => r.attained && !r.current);
      const body = `<p class="small muted era-tag">${esc(tag)}</p><ol class="ranks" start="${from + 1}">${list.map((r, k) => row(r, from + k)).join('')}</ol>`;
      return far ? `<details class="saga era far"><summary class="saga-head" data-tone="gold"><span>${esc(name)}</span><span class="saga-line"></span><span class="xs faint">${lv} · ${plural(list.length, 'rango', 'rangos')}</span>${ico('chevD', 'sm')}</summary>${body}</details>` : `<section class="saga era ${done ? 'done' : ''}"><h2 class="saga-head" data-tone="gold"><span>${esc(name)}</span><span class="saga-line"></span><span class="xs faint">${lv}${done ? ' · completa' : ''}</span></h2>${body}</section>`; }).join('')}`;
}

/* ================= Documentación (Manual) ================= */
/** The real Manual also has a reference catalog; here it points to the same captured catalogs in Configuración. */
const REFERENCE_PAGES = [{ slug: 'ref-comandos', title: 'Comandos', tab: 'Habilidades' }, { slug: 'ref-agentes', title: 'Agentes', tab: 'Agentes' }, { slug: 'ref-reglas', title: 'Reglas de decisión', tab: 'Reglas de decisión' }, { slug: 'ref-estandares', title: 'Estándares', tab: 'Estándares' }];
const MANUAL_GROUPS = [['tutorial', 'Tutorial', 'pink', 'sparkles'], ['guides', 'Guías', 'teal', 'flag'], ['concepts', 'Conceptos', 'blue', 'book'], ['workflows', 'Workflows', 'violet', 'bolt']];
/** Plain text of each manual page (rendered page when captured, else its markdown), for full-text search. */
let MANUAL_PLAIN = null;
const manualPlain = () => MANUAL_PLAIN ||= new Map(SNAP.manual.map(m => [m.slug, (LIVE?.pages?.[m.slug] || m.html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()]));
let MANUAL_TEXT = null;
const manualText = () => MANUAL_TEXT ||= new Map([...manualPlain()].map(([slug, t]) => [slug, `${SNAP.manual.find(m => m.slug === slug)?.title || ''} ${t}`.toLowerCase()]));
/** Manual home: a route-in page (start here, most useful guides, browse by group) with search across page text. */
function manualHome(pages) {
  const q = UI.manualQ.trim().toLowerCase();
  const text = manualText();
  const hits = q ? pages.filter(m => text.get(m.slug)?.includes(q)) : [];
  const snippet = m => { const t = manualPlain().get(m.slug) || ''; const i = t.toLowerCase().indexOf(q); return i < 0 ? '' : '…' + t.slice(Math.max(0, i - 50), i + 90).trim() + '…'; };
  const groupOf = m => MANUAL_GROUPS.find(g => g[0] === m.group) || ['', m.group, 'slate', 'book'];
  const tut = pages.filter(m => m.group === 'tutorial');
  const guides = pages.filter(m => m.group === 'guides');
  return pageHead('Documentación', 'El manual de la fábrica. Empieza por el tutorial, resuelve tareas con las guías y entiende el porqué con los conceptos.', { eyebrow: LIVE ? `<span class="stamp"><span class="dot"></span>Páginas renderizadas por la app servida en local · ${esc(fmtStamp(LIVE.capturedAt))}</span>` : projectStamp() })
    + `<div class="stack lg">
    <label class="field search docs-search">${ico('search', 'sm')}<input id="manual-search" type="search" placeholder="Buscar en ${pages.length} páginas…" aria-label="Buscar en todo el Manual" value="${esc(UI.manualQ)}"></label>
    ${q ? card(`Resultados <span class="chip" data-tone="slate">${hits.length}</span>`, hits.length ? `<div class="divided">${hits.map(m => { const [, gl, t, ic] = groupOf(m); return `<a class="lrow" href="${href('documentacion', { page: m.slug })}"><span class="badge-icon sm" data-tone="${t}">${ico(ic, 'sm')}</span><div class="grow"><strong>${esc(m.title)}</strong><small class="clamp-2">${esc(snippet(m))}</small></div>${chip(gl, t)}</a>`; }).join('')}</div>` : empty('Ninguna página habla de eso.', 'search'), { icon: 'search', tone: 'slate' }) : `
    <div class="grid-2 docs-pair">
      ${card('Empieza aquí', `<p class="small muted card-intro">Si es tu primera vez, el tutorial te lleva de cero a tu primer proyecto en ${plural(tut.length, 'paso', 'pasos')}.</p><ol class="docs-steps">${tut.map((m, i) => `<li><a href="${href('documentacion', { page: m.slug })}"><span class="docs-n">${i + 1}</span><span class="grow"><b>${esc(m.title)}</b><small class="muted clamp-2">${esc(firstSentence((manualPlain().get(m.slug) || '').replace(m.title, '').trim().slice(0, 220)))}</small></span>${ico('arrow', 'sm')}</a></li>`).join('')}</ol>
        <p class="docs-sub">Después, entiende lo esencial</p><div class="divided">${['el-pipeline', 'el-equipo', 'los-gates-humanos', 'estado-y-archivos'].map(slug => pages.find(m => m.slug === slug)).filter(Boolean).map(m => `<a class="lrow" href="${href('documentacion', { page: m.slug })}"><span class="badge-icon sm" data-tone="blue">${ico('book', 'sm')}</span><div class="grow"><strong>${esc(m.title)}</strong></div>${ico('chevR', 'sm')}</a>`).join('')}</div>`, { icon: 'sparkles', tone: 'pink' })}
      ${card('Guías para el día a día', `<div class="divided">${guides.slice(0, 6).map(m => `<a class="lrow" href="${href('documentacion', { page: m.slug })}"><span class="badge-icon sm" data-tone="teal">${ico('flag', 'sm')}</span><div class="grow"><strong>${esc(m.title)}</strong></div>${ico('chevR', 'sm')}</a>`).join('')}</div>${guides.length > 6 ? `<div class="card-foot"><span class="small faint">${guides.length} guías</span><a class="link" data-tone="teal" href="${href('documentacion', { page: guides[6].slug })}">Ver todas ${ico('arrow', 'sm')}</a></div>` : ''}`, { icon: 'flag', tone: 'teal' })}
    </div>
    <section aria-labelledby="docs-groups"><h2 id="docs-groups" class="saga-head"><span>Explorar por tipo</span><span class="saga-line"></span></h2>
      <div class="docs-groups">${MANUAL_GROUPS.map(([g, label, t, ic]) => { const list = pages.filter(m => m.group === g); if (!list.length) return ''; const what = { tutorial: 'Aprender haciendo, de principio a fin.', guides: 'Recetas para una tarea concreta.', concepts: 'Cómo funciona la fábrica y por qué.', workflows: 'Qué pasa por dentro de cada skill.' }[g] || ''; return `<a class="docs-group" data-tone="${t}" href="${href('documentacion', { page: list[0].slug })}"><span class="cfg-ico">${ico(ic)}</span><b>${label}</b><span class="xs muted">${what}</span><span class="docs-count">${plural(list.length, 'página', 'páginas')}</span></a>`; }).join('')}<a class="docs-group" data-tone="slate" href="${href('configuracion')}"><span class="cfg-ico">${ico('list')}</span><b>Referencia</b><span class="xs muted">Comandos, agentes, reglas y estándares.</span><span class="docs-count">En Configuración</span></a></div></section>`}
  </div>`;
}
function manual() {
  const pages = MANUAL_GROUPS.flatMap(([g]) => SNAP.manual.filter(m => m.group === g));
  if (!P('page')) return manualHome(pages);
  if (P('page') && !pages.some(m => m.slug === P('page')) && !REFERENCE_PAGES.some(r => r.slug === P('page'))) return pageHead('Documentación', '') + notFound('Esta página no existe', `El Manual no tiene una página «${esc(P('page'))}».`, '#documentacion', 'Ir al inicio del Manual');
  const sel = pages.find(m => m.slug === P('page')) || pages[0];
  const [, gl, tone, icon] = MANUAL_GROUPS.find(g => g[0] === sel.group) || ['', sel.group, 'slate', 'book'];
  const idx = pages.indexOf(sel);
  const live = LIVE?.pages?.[sel.slug];
  const q = UI.manualQ.trim().toLowerCase();
  const index = `<nav class="doc-index" id="doc-index" aria-label="Índice del Manual"><label class="field">${ico('search', 'sm')}<input id="manual-search" type="search" placeholder="Buscar en el Manual…" aria-label="Buscar en el Manual" value="${esc(UI.manualQ)}"></label>${MANUAL_GROUPS.map(([g, label, t, ic]) => { const list = pages.filter(m => m.group === g); return `<details class="dgroup" data-tone="${t}" data-doc-group open><summary>${ico('chevR', 'sm chev')}<span>${label}</span><span class="n">${list.length}</span></summary>${list.map(m => `<a class="ditem" data-tone="${t}" href="${href('documentacion', { page: m.slug })}" data-doc-text="${esc(manualText().get(m.slug) || m.title.toLowerCase())}" ${!q || (manualText().get(m.slug) || '').includes(q) ? '' : 'hidden'} ${m.slug === sel.slug ? 'aria-current="page"' : ''} style="text-decoration:none">${ico(ic)}<span>${esc(m.title)}</span></a>`).join('')}</details>`; }).join('')}<details class="dgroup" data-tone="slate" data-doc-group open><summary>${ico('chevR', 'sm chev')}<span>Referencia</span><span class="n">${REFERENCE_PAGES.length}</span></summary>${REFERENCE_PAGES.map(r => `<a class="ditem" data-tone="slate" href="${href('configuracion', { tab: r.tab })}" data-doc-text="${esc(r.title.toLowerCase())}" style="text-decoration:none">${ico('list')}<span>${esc(r.title)}</span></a>`).join('')}</details></nav>`;
  const inGroup = pages.filter(m => m.group === sel.group);
  const gi = inGroup.indexOf(sel);
  const neighbor = (m, dir) => m ? `<a class="lrow docs-nav" data-tone="${tone}" href="${href('documentacion', { page: m.slug })}" style="${dir === 'next' ? 'justify-content:flex-end;text-align:right' : ''}">${dir === 'prev' ? ico('back', 'sm') : ''}<div class="grow"><small>${dir === 'prev' ? 'Anterior' : 'Siguiente'} en ${esc(gl)}</small><strong>${esc(m.title)}</strong></div>${dir === 'next' ? ico('arrow', 'sm') : ''}</a>` : '<span style="flex:1"></span>';
  return pageHead('Documentación', 'El manual de la fábrica: empieza por el tutorial, sigue con las guías y profundiza en los conceptos.', { eyebrow: live ? `<span class="stamp"><span class="dot"></span>Páginas renderizadas por la app servida en local · ${esc(fmtStamp(LIVE.capturedAt))}</span>` : projectStamp() })
    + `<button type="button" class="btn index-toggle" data-action="doc-index" aria-controls="doc-index" aria-expanded="false" style="margin-bottom:12px"><span class="row">${ico('book', 'sm')}Índice · ${esc(sel.title)}</span>${ico('chevD', 'sm')}</button>
    <div class="reader"><article class="paper" data-tone="${tone}" id="paper"><div class="paper-head"><nav class="docs-crumbs" aria-label="Ruta"><a href="#documentacion">Documentación</a>${ico('chevR', 'sm')}<a href="${href('documentacion', { page: inGroup[0].slug })}" data-tone="${tone}" class="tone-text">${esc(gl)}</a>${ico('chevR', 'sm')}<span aria-current="page">${esc(sel.title)}</span></nav><span class="path">${sel.group === 'tutorial' ? `Paso ${gi + 1} de ${inGroup.length}` : `${gi + 1} de ${inGroup.length}`}</span></div>${sel.group === 'tutorial' ? `<div class="docs-progress" role="img" aria-label="Paso ${gi + 1} de ${inGroup.length} del tutorial">${inGroup.map((m, k) => `<span class="${k <= gi ? 'on' : ''}"></span>`).join('')}</div>` : ''}
      ${live ? `<div class="manual-live">${live}</div>` : `<div class="notice" data-tone="slate" style="margin-bottom:16px">${ico('alert')}<p>La versión compuesta de esta página no está en la captura; se muestra su markdown de índice.</p></div><div class="md" data-tone="${tone}">${sel.html}</div>`}
      <div class="row" style="margin-top:28px;gap:12px">${neighbor(inGroup[gi - 1], 'prev')}${neighbor(inGroup[gi + 1] || (gi === inGroup.length - 1 ? pages[idx + 1] : null), 'next')}</div></article>${index}</div>`;
}

/* ================= Configuración ================= */
/** Agents are blue everywhere; the model tier is told by its label, not by a second hue. */
const MODEL_TONE = { opus: 'blue', sonnet: 'blue', haiku: 'blue' };
const AGENT_SPRITES = new Set(['analytics', 'architect', 'backend-dev', 'copywriter', 'designer', 'devops', 'frontend-dev', 'product-manager', 'researcher', 'reviewer', 'security-auditor', 'test-writer']);
/* Configuración: one hue per kind everywhere (skills violet, agents blue, rules amber, standards teal),
   search first in every tab, and a Resumen hub that searches across all four. */
const CFG_KIND = { skill: ['Habilidad', 'violet', 'bolt', 'Habilidades'], agent: ['Agente', 'blue', 'users', 'Agentes'], rule: ['Regla', 'pink', 'shield', 'Reglas de decisión'], standard: ['Estándar', 'teal', 'book', 'Estándares'] };
const MODEL_INFO = { opus: ['Opus', 'blue', 'Juicio y diseño: decisiones difíciles, revisión y arquitectura.'], sonnet: ['Sonnet', 'blue', 'El caballo de batalla: construir, documentar, investigar.'], haiku: ['Haiku', 'blue', 'Trabajo mecánico y rápido.'], unknown: ['Modelo heredado', 'blue', 'Usa el modelo de la sesión que lo llama.'] };
const STD_DOMAIN = { Programming: ['Programación', 'blue'], Technology: ['Tecnología', 'blue'], Architecture: ['Arquitectura', 'amber'], Design: ['Diseño', 'pink'], 'Product/Docs': ['Producto y docs', 'violet'], Quality: ['Calidad', 'green'], Security: ['Seguridad', 'coral'], 'Data/Privacy': ['Datos y privacidad', 'coral'], Operation: ['Operación', 'teal'], Other: ['Otros', 'slate'] };
const cfgMatch = (q, ...fields) => !q || fields.join(' ').toLowerCase().includes(q);
const cfgSearch = (placeholder, n, total, noun) => `<div class="toolbar"><label class="field search">${ico('search', 'sm')}<input id="cfg-search" type="search" placeholder="${placeholder}" aria-label="${placeholder}" value="${esc(UI.cfgQ)}"></label><span class="grow"></span><span class="small faint">${n === total ? plural(total, noun[0], noun[1]) : `${n} de ${total}`}</span></div>`;
function configuration() {
  if (!EXTRAS?.config) return pageHead('Configuración', 'Las capacidades y reglas de tu fábrica.') + missingExtras('la configuración');
  const c = EXTRAS.config;
  const tabsList = ['Resumen', 'Habilidades', 'Agentes', 'Reglas de decisión', 'Estándares'];
  const tab = tabsList.includes(P('tab')) ? P('tab') : 'Resumen';
  const body = { Resumen: configHub, Habilidades: skillsView, Agentes: agentsView, 'Reglas de decisión': rulesView, 'Estándares': standardsView }[tab](c);
  return pageHead('Configuración', 'Las habilidades, el equipo y las reglas con las que trabaja tu fábrica, leídas de sus archivos.', { eyebrow: factoryStamp() })
    + tabs([{ id: 'Resumen', icon: 'gauge', tone: 'slate' }, { id: 'Habilidades', icon: 'bolt', tone: 'violet', badge: c.skills.length }, { id: 'Agentes', icon: 'users', tone: 'blue', badge: c.agents.length }, { id: 'Reglas de decisión', icon: 'shield', tone: 'amber', badge: c.rules.length }, { id: 'Estándares', icon: 'book', tone: 'teal', badge: c.standards.length }], tab, 'tab', 'Secciones de configuración')
    + `<div role="tabpanel" aria-label="${esc(tab)}">${body}</div>`;
}
/** Hub: what each catalog holds at a glance, the owner's commands to copy, and one search across all four. */
function configHub(c) {
  const q = UI.cfgQ.trim().toLowerCase();
  const own = c.skills.filter(k => k.userInvocable !== false);
  const hits = q ? [
    ...c.skills.filter(k => cfgMatch(q, k.name, k.description)).map(k => ({ kind: 'skill', id: k.slug, title: k.name, sub: k.description, attr: `data-skill="${esc(k.slug)}"` })),
    ...c.agents.filter(a => cfgMatch(q, a.name, a.description)).map(a => ({ kind: 'agent', id: a.id, title: a.name, sub: a.description, attr: `data-agent="${esc(a.id)}"` })),
    ...c.rules.filter(r => cfgMatch(q, r.id, r.title, r.default)).map(r => ({ kind: 'rule', id: r.id, title: `${r.id} · ${r.title}`, sub: r.default || '', href: href('configuracion', { tab: 'Reglas de decisión' }) })),
    ...c.standards.filter(x => cfgMatch(q, x.title, x.id)).map(x => ({ kind: 'standard', id: x.id, title: x.title, sub: `${x.severity} · ${x.id}`, attr: `data-standard="${esc(x.id)}"` })),
  ] : [];
  const tile = (kind, n, parts, tab) => { const [, tone, icon, label] = CFG_KIND[kind]; return `<a class="cfg-tile" data-tone="${tone}" href="${href('configuracion', { tab })}"><span class="cfg-ico">${ico(icon)}</span><span class="cfg-l">${label}</span><b>${n}</b><span class="xs muted">${parts}</span></a>`; };
  const models = Object.entries(c.agents.reduce((acc, a) => { acc[a.model] = (acc[a.model] || 0) + 1; return acc; }, {})).map(([m, n]) => `${n} ${(MODEL_INFO[m] || [m])[0].toLowerCase()}`).join(' · ');
  return `<div class="stack lg">
    <label class="field search cfg-global">${ico('search', 'sm')}<input id="cfg-search" type="search" placeholder="Buscar en habilidades, agentes, reglas y estándares…" aria-label="Buscar en toda la configuración" value="${esc(UI.cfgQ)}"></label>
    ${q ? card(`Resultados <span class="chip" data-tone="slate">${hits.length}</span>`, hits.length ? `<div class="divided">${hits.slice(0, 40).map(h => { const [kl, tone, icon] = CFG_KIND[h.kind]; return `<${h.href ? `a href="${h.href}"` : `button type="button" ${h.attr}`} class="lrow"><span class="badge-icon sm" data-tone="${tone}">${ico(icon, 'sm')}</span><div class="grow"><strong class="clamp-1">${esc(h.title)}</strong><small class="clamp-1">${esc(h.sub || '')}</small></div>${chip(kl, tone)}</${h.href ? 'a' : 'button'}>`; }).join('')}</div>` : empty('Nada coincide con la búsqueda.', 'search'), { icon: 'search', tone: 'slate' }) : `
    <div class="cfg-tiles">${tile('skill', c.skills.length, `${own.length} comandos tuyos · ${c.skills.length - own.length} motores internos`, 'Habilidades')}${tile('agent', c.agents.length, models, 'Agentes')}${tile('rule', c.rules.length, `${c.rules.filter(r => r.approval === 'human').length} requieren tu OK · ${c.rules.filter(r => r.approval !== 'human').length} automáticas`, 'Reglas de decisión')}${tile('standard', c.standards.length, `${c.standards.filter(x => x.severity === 'MUST').length} obligatorios · ${c.standards.filter(x => x.severity !== 'MUST').length} recomendados`, 'Estándares')}</div>
    ${card(`Tus comandos <span class="chip" data-tone="violet">${own.length}</span>`, `<p class="small muted card-intro">Las habilidades que corres tú. Clic en el comando para copiarlo; en el nombre de la fila para ver qué hace.</p><div class="cmd-grid">${own.map(k => `<div class="cmd-cell"><button type="button" class="copy-text mono small" data-copy="${esc(k.name)}" data-hint="Copiar" aria-label="Copiar ${esc(k.name)}">${esc(k.name)}</button><button type="button" class="cmd-desc clamp-2" data-skill="${esc(k.slug)}">${esc(firstSentence(k.description))}</button></div>`).join('')}</div>`, { icon: 'terminal', tone: 'violet' })}`}
  </div>`;
}
const firstSentence = t => { const s = String(t || '').split(/(?<=[.!?])\s/)[0]; return s.length > 110 ? s.slice(0, 107) + '…' : s; };
function skillsView(c) {
  const q = UI.cfgQ.trim().toLowerCase();
  const kind = P('kind');
  const list = c.skills.filter(k => cfgMatch(q, k.name, k.description) && (!kind || (kind === 'owner' ? k.userInvocable !== false : k.userInvocable === false)));
  const scopes = [['project', 'Dentro de un proyecto', 'Se corren en la carpeta del proyecto.'], ['factory', 'En la fábrica', 'Se corren en la carpeta de panda-corp.'], ['unknown', 'Otras', '']];
  const own = c.skills.filter(k => k.userInvocable !== false).length;
  return `${cfgSearch('Buscar habilidad…', list.length, c.skills.length, ['habilidad', 'habilidades'])}
    <div class="chipset" role="group" aria-label="Tipo de habilidad" style="margin:-4px 0 16px">${[['', 'Todas', c.skills.length], ['owner', 'Comandos tuyos', own], ['internal', 'Motores internos', c.skills.length - own]].map(([v, l, n]) => `<button type="button" class="chipbtn" data-tone="violet" data-cfg-kind="${v}" aria-pressed="${kind === v}">${l} <span class="n">${n}</span></button>`).join('')}</div>
    <div class="stack lg">${scopes.map(([sc, label, hint]) => { const rows = list.filter(k => (k.scope || 'unknown') === sc); return rows.length ? card(`${label} <span class="chip" data-tone="violet">${rows.length}</span>`, `${hint ? `<p class="small muted card-intro">${hint}</p>` : ''}<div class="divided">${rows.map(k => `<div class="lrow cfg-row"><span class="badge-icon sm" data-tone="violet">${ico('bolt', 'sm')}</span><div class="grow"><button type="button" class="link cfg-name mono" data-skill="${esc(k.slug)}">${esc(k.name)}</button><small class="clamp-1">${esc(firstSentence(k.description))}</small></div>${k.userInvocable === false ? chip('Motor interno', '', 'plain') : `<button type="button" class="copy-text xs" data-copy="${esc(k.name)}" data-hint="Copiar" aria-label="Copiar ${esc(k.name)}">copiar</button>`}</div>`).join('')}</div>`, { icon: sc === 'project' ? 'folder' : sc === 'factory' ? 'factory' : 'layers', tone: 'violet' }) : ''; }).join('') || empty('Ninguna habilidad coincide.', 'search')}</div>`;
}
function agentsView(c) {
  const q = UI.cfgQ.trim().toLowerCase();
  const list = c.agents.filter(a => cfgMatch(q, a.name, a.description, a.model));
  const tiers = ['opus', 'sonnet', 'haiku', 'unknown'];
  return `${cfgSearch('Buscar agente…', list.length, c.agents.length, ['agente', 'agentes'])}
    <div class="stack lg">${tiers.map(t => { const rows = list.filter(a => (MODEL_INFO[a.model] ? a.model : 'unknown') === t); const [label, tone, hint] = MODEL_INFO[t]; return rows.length ? `<section class="saga" style="margin-top:0"><h2 class="saga-head" data-tone="${tone}">${ico('users', 'sm')}<span>${label}</span><span class="saga-line"></span><span class="xs faint">${plural(rows.length, 'agente', 'agentes')}</span></h2><p class="small muted era-tag">${hint}</p><div class="agent-grid">${rows.map(a => `<button type="button" class="agent-card" data-tone="${tone}" data-agent="${esc(a.id)}">${AGENT_SPRITES.has(a.id) ? `<img src="assets/${esc(a.id)}.png" alt="" width="44" height="44">` : `<span class="pav md" data-tone="${tone}">${esc(a.id.slice(0, 2).toUpperCase())}</span>`}<span class="grow"><b>${esc(a.name)}</b>${a.effort ? `<span class="xs faint">esfuerzo ${esc(a.effort)}</span>` : ''}<small class="clamp-2 muted">${esc(firstSentence(a.description))}</small></span></button>`).join('')}</div></section>` : ''; }).join('') || empty('Ningún agente coincide.', 'search')}</div>`;
}
function rulesView(c) {
  const q = UI.ruleQ.trim().toLowerCase();
  const list = c.rules.filter(r => (!UI.ruleApproval || r.approval === UI.ruleApproval) && (!q || `${r.id} ${r.title} ${r.default || ''}`.toLowerCase().includes(q)));
  return `<div class="toolbar"><label class="field search">${ico('search', 'sm')}<input id="rule-search" type="search" placeholder="Buscar regla…" aria-label="Buscar regla" value="${esc(UI.ruleQ)}"></label><div class="chipset" role="group" aria-label="Aprobación">${[['', 'Todas', c.rules.length], ['auto', 'Automáticas', c.rules.filter(r => r.approval === 'auto').length], ['human', 'Requieren al owner', c.rules.filter(r => r.approval === 'human').length]].map(([v, l, n]) => `<button type="button" class="chipbtn" data-tone="${v === 'human' ? 'amber' : 'green'}" data-rule-approval="${v}" aria-pressed="${UI.ruleApproval === v}">${l} <span class="n">${n}</span></button>`).join('')}</div><span class="grow"></span><span class="small faint" id="rule-count">${plural(list.length, 'regla', 'reglas')}</span></div>
    <div class="card flush"><div class="divided" id="rule-list">${moreList('rules', list, r => `<details class="plan-row rule-row"><summary><span class="mono faint rule-id" style="font-size:12px;min-width:62px">${esc(r.id)}</span><span class="grow">${inl(r.title)}</span>${r.domain ? chip(esc(r.domain), '', 'plain') : ''}${chip(r.approval === 'human' ? 'Owner' : 'Auto', r.approval === 'human' ? 'amber' : 'green')}</summary><div><p class="small muted">${inl(r.default || 'Sin valor por defecto registrado.')}</p>${r.summary ? `<p class="small faint">${inl(r.summary)}</p>` : ''}</div></details>`, 30) || `<div style="padding:16px">${empty('Ninguna regla coincide.', 'search')}</div>`}</div></div>`;
}
function standardsView(c) {
  const q = UI.cfgQ.trim().toLowerCase();
  const sev = P('sev'), dom = P('dom');
  const list = c.standards.filter(x => cfgMatch(q, x.title, x.id, x.domain) && (!sev || x.severity === sev) && (!dom || x.domain === dom)).sort((a, b) => (a.severity === 'MUST' ? 0 : 1) - (b.severity === 'MUST' ? 0 : 1) || a.title.localeCompare(b.title, 'es'));
  const domains = [...new Set(c.standards.map(x => x.domain))].sort((a, b) => (STD_DOMAIN[a]?.[0] || a).localeCompare(STD_DOMAIN[b]?.[0] || b, 'es'));
  return `${cfgSearch('Buscar estándar…', list.length, c.standards.length, ['estándar', 'estándares'])}
    <div class="row wrap" style="gap:10px;margin:-4px 0 16px"><div class="chipset" role="group" aria-label="Severidad">${[['', 'Todos', c.standards.length, 'teal'], ['MUST', 'Obligatorios', c.standards.filter(x => x.severity === 'MUST').length, 'coral'], ['SHOULD', 'Recomendados', c.standards.filter(x => x.severity === 'SHOULD').length, 'amber']].map(([v, l, n, t]) => `<button type="button" class="chipbtn" data-tone="${t}" data-cfg-sev="${v}" aria-pressed="${sev === v}">${l} <span class="n">${n}</span></button>`).join('')}</div>
    <label class="field"><span class="sr-only">Dominio</span><select id="std-domain" aria-label="Filtrar por dominio"><option value="">Todos los dominios</option>${domains.map(d => `<option value="${esc(d)}" ${d === dom ? 'selected' : ''}>${esc(STD_DOMAIN[d]?.[0] || d)} (${c.standards.filter(x => x.domain === d).length})</option>`).join('')}</select>${ico('chevD', 'sm')}</label></div>
    ${card(`Estándares <span class="chip" data-tone="teal">${list.length}</span>`, list.length ? `<div class="divided">${list.map(x => { const [dl, dt] = STD_DOMAIN[x.domain] || [x.domain, 'slate']; return `<button type="button" class="lrow" data-standard="${esc(x.id)}"><span class="badge-icon sm" data-tone="${x.severity === 'MUST' ? 'coral' : 'amber'}">${ico('book', 'sm')}</span><div class="grow"><strong>${esc(x.title)}</strong><small>${esc(x.id)}${x.enforcement ? ' · ' + esc(x.enforcement) : ''}</small></div>${chip(esc(dl), '', 'plain')}${chip(x.severity === 'MUST' ? 'Obligatorio' : 'Recomendado', x.severity === 'MUST' ? 'coral' : 'amber')}${ico('chevR', 'sm')}</button>`; }).join('')}</div>` : empty('Ningún estándar coincide.', 'search'), { icon: 'book', tone: 'teal' })}`;
}

/* ================= Render ================= */
const SCREENS = { inicio: home, tablero: board, idea: ideaScreen, portfolio, propuestas: proposals, logros: achievements, documentacion: manual, configuracion: configuration };
const TITLES = { inicio: 'Inicio', tablero: 'Tablero', idea: 'Idea', portfolio: 'Portafolio', propuestas: 'Propuestas', logros: 'Logros', documentacion: 'Documentación', configuracion: 'Configuración' };
function currentProject() {
  if (state.screen === 'portfolio') return projectById(P('project')) || null;
  if (state.screen === 'idea') return ideaProject(IDEAS.find(i => i.slug === P('idea')) || {}) || null;
  return null;
}
function render() {
  MODALS.length = 0;
  renderSidebar();
  renderBottomNav();
  const content = $('#content');
  content.dataset.screen = state.screen;
  content.innerHTML = SCREENS[state.screen]();
  const p = currentProject();
  const title = state.screen === 'idea' ? (IDEAS.find(i => i.slug === P('idea'))?.title || 'Idea') : state.screen === 'portfolio' && p ? p.short : TITLES[state.screen];
  $('#where').innerHTML = `${esc(title)}<small>${state.screen === 'portfolio' && p ? esc(P('tab') || 'Resumen') : 'Mission Control'}</small>`;
  document.title = `${title} · Órbita · Ronda 5`;
  $('#foot-stamp').textContent = `Proyectos capturados ${fmtStamp(SNAP.capturedAt)}${EXTRAS ? ` · fábrica ${fmtStamp(EXTRAS.capturedAt)}` : ''}`;
  afterRender();
  if (parent !== window) parent.postMessage({ source: 'mc-prototype', screen: state.screen }, location.protocol === 'file:' ? '*' : location.origin);
}
function afterRender() {
  if (state.screen === 'tablero') { filterBoard(); syncPhaseNav(); }
  startRoam();
  startForgeSim();
  $$('.tabs-wrap').forEach(wrap => {
    const bar = $('.tabs', wrap);
    const active = $('[aria-selected="true"]', bar);
    if (active) bar.scrollLeft = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
    const update = () => { wrap.dataset.moreLeft = String(bar.scrollLeft > 4); wrap.dataset.moreRight = String(bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4); };
    update();
    bar.addEventListener('scroll', update, { passive: true });
  });
  $$('.md h1').forEach(h => { const h2 = document.createElement('h2'); h2.innerHTML = h.innerHTML; h.replaceWith(h2); });
  markScrollables();
  $$('.manual-live h1').forEach(h => { const h2 = document.createElement('h2'); h2.innerHTML = h.innerHTML; h2.style.fontSize = '26px'; h.replaceWith(h2); });
  // The captured Manual carries the app's own inline 10–11 px labels; the study keeps the 12 px reading floor.
  $$('.manual-live [style*="font-size"]').forEach(el => { if (parseFloat(getComputedStyle(el).fontSize) < 12) el.style.fontSize = '12px'; });
  requestAnimationFrame(layoutDiagram);
}

/** Anything that scrolls sideways says so: keyboard-reachable region plus a visible hint under it. */
function markScrollables() {
  $$('.md table, .md pre, .manual-live table, .table-wrap, .scroll-x, .schema-list pre').forEach(el => {
    if (!el.clientWidth || el.scrollWidth <= el.clientWidth + 2) return;
    const isTable = el.tagName === 'TABLE' || !!el.querySelector('table');
    if (!el.hasAttribute('tabindex')) { el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', isTable ? 'Tabla desplazable' : 'Código desplazable'); }
    if (el.tagName !== 'PRE' || el.closest('.schema-list')) {
      if (!el.nextElementSibling?.classList.contains('tbl-hint')) el.insertAdjacentHTML('afterend', `<p class="tbl-hint">${ico('arrow', 'sm')}${isTable ? 'Desliza la tabla para ver todas las columnas' : 'Desliza para ver cada línea completa'}</p>`);
    }
  });
}
document.addEventListener('toggle', e => { if (e.target.matches?.('.schema-list details')) markScrollables(); }, true);
/** Explicit not-found state: never substitute another item for one that does not exist. */
function notFound(title, text, back, verb) {
  return `<section class="card" style="margin-top:16px"><div class="empty" style="border:0">${ico('search', 'lg')}<strong style="color:var(--text);font-size:var(--fs-lg)">${title}</strong><span>${text}</span><a class="btn" href="${back}">${ico('back', 'sm')}${verb}</a></div></section>`;
}

/* ================= Dialogs ================= */
let dialogTrigger = null;
/** Opens the shared dialog. `opts.tone` tints its head like the tab it came from; `opts.kicker` is the small coloured label above the title. */
function dialog(title, html, opts = {}) {
  dialogTrigger = document.activeElement;
  $('#dlg').dataset.tone = opts.tone || 'slate';
  $('#dlg-kicker').innerHTML = opts.kicker || '';
  $('#dlg-kicker').hidden = !opts.kicker;
  $('#dlg-title').innerHTML = title;
  $('#dlg-body').innerHTML = html;
  if (!$('#dlg').open) $('#dlg').showModal();
  $('#dlg-close').focus();
  $$('#dlg-body .md h1').forEach(h => { const h2 = document.createElement('h2'); h2.innerHTML = h.innerHTML; h.replaceWith(h2); });
}
function confirmDialog(title, text, verb, onConfirm) {
  confirmDialog.previous = $('#dlg').open ? { title: $('#dlg-title').innerHTML, body: $('#dlg-body').innerHTML } : null;
  dialog(title, `<p class="muted">${text}</p><div><label class="lbl" for="reason">Motivo (opcional)</label><div class="field"><textarea id="reason" placeholder="Por qué…"></textarea></div></div><div class="notice" data-tone="slate">${ico('alert')}<p class="small">Esta maqueta no modifica archivos de la fábrica. En la app real esta acción escribe solo el campo acotado de su tarjeta.</p></div><div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-action="close-dialog">Cancelar</button><button type="button" class="btn danger" data-action="confirm">${verb}</button></div>`, { tone: 'coral', kicker: 'Confirmar' });
  confirmDialog.pending = onConfirm;
}
function toast(text) { const t = $('#toast'); t.innerHTML = `${ico('check', 'sm')}${esc(text)}`; t.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600); }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiado al portapapeles'); }
  catch { toast('El navegador bloqueó el portapapeles: selecciona y copia el texto'); }
}
const findProject = id => projectById(id) || currentProject();
function openDoc(id, ctxScreen) {
  if (ctxScreen === 'idea') patch({ tab: 'Documentos', doc: id });
  else { const p = currentProject() || PROJECTS.find(x => x.docs.some(d => d.id === id)); go('portfolio', { project: p.id, tab: 'Documentos', doc: id }); }
}
function openWo(id, projectId) {
  const p = findProject(projectId);
  if (!p?.orders.some(w => w.id === id)) { toast('Esa orden no está publicada en la captura'); return; }
  go('portfolio', { project: p.id, tab: 'Observabilidad', wo: id, frd: state.screen === 'portfolio' ? P('frd') : '', view: state.screen === 'portfolio' ? P('view') : '', state: state.screen === 'portfolio' ? P('state') : '' });
}

/* ================= Events ================= */
document.addEventListener('click', async event => {
  const el = event.target.closest('a, button, summary');
  if (!el) return;
  const d = el.dataset;

  // Links inside rendered markdown: resolve project-relative documents, keep anchors in-page.
  const mdRoot = el.closest('.md');
  if (el.tagName === 'A' && mdRoot) {
    const raw = el.dataset.docRelPath || el.getAttribute('href') || '';
    if (raw.startsWith('#') && !raw.startsWith('#doc:')) { event.preventDefault(); const slug = raw.slice(1); const target = $$('h2,h3,h4', mdRoot).find(h => h.id === slug || h.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/\s+/g, '-') === slug); target?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (!/^(https?:|mailto:)/.test(raw)) {
      event.preventDefault();
      const p = currentProject();
      if (!p) { toast('Este enlace apunta a un archivo fuera de la captura'); return; }
      const base = (mdRoot.dataset.docBase || 'docs/x.md').split('/').slice(0, -1);
      let path = raw.replace(/^#doc:/, '').split('#')[0];
      path = decodeURIComponent(path);
      if (path.startsWith('/')) path = path.slice(1); else { const parts = [...base]; for (const part of path.split('/')) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); } path = parts.join('/'); }
      const doc = p.docs.find(x => x.relPath === path) || p.docs.find(x => x.relPath.endsWith('/' + path.split('/').pop()));
      if (doc) openDoc(doc.id, state.screen); else toast('El enlace apunta a un archivo que no está en la captura');
      return;
    }
    el.target = '_blank'; el.rel = 'noopener noreferrer';
    return;
  }
  if (el.matches('[data-ext]')) { event.preventDefault(); toast('Enlace interno del Manual de la app'); return; }

  if (d.tabsScroll) { const bar = $('.tabs', el.closest('.tabs-wrap')); bar.scrollBy({ left: Number(d.tabsScroll) * bar.clientWidth * 0.6 }); return; }
  if (d.idoc) { patch({ doc: d.idoc === 'resumen' ? '' : d.idoc }); return; }
  if (d.phase !== undefined && (el.classList.contains('room') || el.classList.contains('ps-step'))) { patch({ phase: d.phase }); return; }
  if (d.modal !== undefined) { const m = MODALS[Number(d.modal)]; if (m) dialog(m.title, m.html, m.opts); return; }
  if (d.wtRepo) { worktreeDetail(d.wtRepo); return; }
  if (d.turn !== undefined) { const a = TURN_INDEX[Number(d.turn)]; if (a) turnDetail(a); return; }
  if (d.phaseJump) { const col = document.getElementById('col-' + d.phaseJump); const sc = $('#board-scroller'); if (col && sc) sc.scrollTo({ left: col.offsetLeft - sc.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  if (d.scroll) { event.preventDefault(); document.getElementById(d.scroll)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
  if (el.hasAttribute('data-close-dialog')) { $('#dlg').close(); return; }
  if (d.tabkey) { const key = d.tabkey; const extra = key === 'tab' ? { doc: '', wo: '', frd: '', state: '', view: '', obs: '', model: '', target: '', focus: '' } : {}; patch({ ...extra, [key]: d.tabval === 'Resumen' && key === 'woview' ? '' : d.tabval }); return; }
  if (d.segkey) { patch({ [d.segkey]: d.segval }); return; }
  if (d.openDoc) { if ($('#dlg').open) $('#dlg').close(); openDoc(d.openDoc, d.ctx); return; }
  if (d.wo) { openWo(d.wo, d.project); return; }
  if (d.focus !== undefined && el.matches('[data-focus]')) { patch({ focus: d.focus }); if (matchMedia('(max-width: 899px)').matches) setTimeout(() => $('.dag-side')?.scrollIntoView({ block: 'start' }), 80); return; }
  if (d.stateFilter) { patch({ state: P('state') === d.stateFilter ? '' : d.stateFilter }); return; }
  if (d.woMore) { UI.woExpanded.has(d.woMore) ? UI.woExpanded.delete(d.woMore) : UI.woExpanded.add(d.woMore); render(); return; }
  if (d.frdJump) { if ($('#dlg').open) $('#dlg').close(); const pid = d.project || currentProject()?.id; go('portfolio', { project: pid, tab: 'Observabilidad', frd: d.frdJump }); return; }
  if (d.cfgKind !== undefined) { patch({ kind: d.cfgKind }); return; }
  if (d.cfgSev !== undefined) { patch({ sev: d.cfgSev }); return; }
  if (d.dagFrd) { patch({ dag: 'wo', frd: d.dagFrd, focus: '' }); return; }
  if (d.sceneMode) { patch({ scene: d.sceneMode === 'real' ? '' : d.sceneMode }); return; }
  if (d.tabJump) { patch({ tab: d.tabJump, doc: '', wo: '' }); return; }
  if (d.catFilter !== undefined) { UI.boardCat = d.catFilter; $$('[data-cat-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.catFilter === UI.boardCat))); filterBoard(); return; }
  if (d.star) { const idea = IDEAS.find(i => i.slug === d.star); idea.favorite = !idea.favorite; render(); toast(idea.favorite ? 'Marcada como favorita en esta maqueta' : 'Quitada de favoritas en esta maqueta'); return; }
  if (d.selectEntity) { UI.modelSel = UI.modelSel === d.selectEntity ? '' : d.selectEntity; $$('[data-select-entity]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.selectEntity === UI.modelSel))); layoutDiagram(); return; }
  if (d.graph) { await graphAction(d.graph); return; }
  if (d.mode !== undefined) { store.set('orbita-mode-' + d.project, d.mode); $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === d.mode))); $$('#mode-cmd').forEach(x => { x.innerHTML = cmd(('/pandacorp:implement ' + d.mode).trim()); }); return; }
  if (d.copy !== undefined) { await copy(d.copy); return; }
  if (d.more) { UI.more[d.more] = (UI.more[d.more] || +d.step) + (+d.step) * 2; const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  if (d.doctype !== undefined) { UI.docType = d.doctype; render(); return; }
  if (d.bfilter) { if (d.bfilter === 'pri') UI.backlogPri = d.val; else UI.backlogType = d.val; render(); return; }
  if (d.barea !== undefined) { UI.backlogArea = UI.backlogArea === d.barea ? '' : d.barea; render(); return; }
  if (d.trophyCat !== undefined) { UI.trophyCat = d.trophyCat; render(); return; }
  if (d.ruleApproval !== undefined) { UI.ruleApproval = d.ruleApproval; render(); return; }
  if (el.hasAttribute('data-dismiss')) { const row = el.closest('.lrow'); row.hidden = true; toast('Oculta solo en este navegador'); return; }
  if (d.decision) { const [pid, id] = d.decision.split('|'); const p = projectById(pid); const dec = p.decisions.find(x => x.id === id); dialog(inl(dec.title.replace(/^·\s*/, '')), `<div class="row wrap">${chip(dec.resolved ? 'Resuelta' : 'Pendiente', dec.resolved ? 'green' : 'amber')}${chip(esc(p.short), p.tone)}${chip(esc(fmtDate(dec.date)), '', 'plain')}</div>${dec.recommendation ? `<div class="notice" data-tone="blue">${ico('bulb')}<div><strong>Recomendación del agente</strong><p class="small" style="margin-top:4px">${inl(dec.recommendation)}</p></div></div>` : ''}<p class="small faint">La captura guarda el título, la fecha, el estado y la recomendación; el razonamiento y las opciones completas están en <code>.pandacorp/inbox/decisions.md</code> del proyecto.</p><p class="small muted">Las decisiones se responden en el proyecto con:</p>${cmd('/pandacorp:decide')}<a class="btn" data-close-dialog href="${href('portfolio', { project: p.id })}">Abrir ${esc(p.short)}${ico('arrow', 'sm')}</a>`, { tone: 'amber', kicker: `Decisión · ${esc(p.short)}` }); return; }
  if (d.change) { const [pid, id] = d.change.split('|'); const p = projectById(pid); const c = p.changesList.find(x => x.id === id); const [label, tone] = CHANGE_STATES[c.status] || [c.status, 'slate']; const canDiscard = ['ready', 'draft'].includes(c.status); dialog(inl(c.title), `<div class="row wrap">${chip(esc(label), tone)}${chip(c.type === 'bug' ? 'Bug' : 'Cambio', c.type === 'bug' ? 'coral' : 'pink', 'outline')}${chip(esc(c.id), '', 'plain')}${c.frd ? chip(esc(c.frd), 'violet') : ''}</div><div class="md compact" data-tone="pink">${c.html}</div>${['ready', 'draft', 'building'].includes(c.status) ? `<p class="small muted">Construir solo este cambio:</p>${cmd(`/pandacorp:implement change:${c.id}`)}` : ''}${canDiscard ? `<div class="row" style="justify-content:flex-end"><button type="button" class="btn danger" data-action="discard-change">${ico('trash', 'sm')}Descartar cambio</button></div>` : ''}`, { tone: c.type === 'bug' ? 'coral' : 'pink', kicker: `${c.type === 'bug' ? 'Bug' : 'Cambio'} · ${esc(c.id)}` }); return; }
  if (d.adr) { const p = currentProject(); const adr = p?.adrs.find(a => String(a.id) === d.adr); if (adr) dialog(esc(adr.title || adr.id), `<div class="md" data-tone="amber">${adr.html}</div>`, { tone: 'amber', kicker: esc(String(adr.id).replace(/^ADR-?/i, 'ADR-')) }); return; }
  if (d.lesson) { const all = EXTRAS.memory.streams.flatMap(s => s.items); const l = all.find(x => x.id === d.lesson); const [tl, tt] = LESSON_TYPE[l.type] || [l.type, 'slate']; dialog(esc(l.id), `<div class="row wrap">${chip(esc(tl), tt)}${l.domain ? chip(esc(l.domain), '', 'plain') : ''}${l.promotion ? chip(`Promoción: ${esc(l.promotion)}`, 'green') : ''}${l.evalGate ? chip(esc(l.evalGate), 'blue', 'outline') : ''}</div><p><strong>${inl(l.title)}</strong></p>${l.summary ? `<div class="notice" data-tone="blue">${ico('target')}<p class="small">${inl(l.summary)}</p></div>` : ''}${l.html ? `<div class="md compact">${l.html}</div>` : ''}${l.appliedIn?.length ? `<p class="small faint">Aplicada en: ${esc(l.appliedIn.join(', '))}</p>` : ''}${l.promotion === 'proposed' ? `<p class="small muted">Promoverla a estándar, regla o skill:</p>${cmd(`/pandacorp:learn ${l.id}`)}` : ''}`, { tone: tt, kicker: `Lección · ${esc(tl)}` }); return; }
  if (d.backlog) { const it = EXTRAS.backlog.items.find(x => x.id === d.backlog); const [pl, pt] = PRIORITY[it.priority] || ['—', 'slate']; dialog(`${esc(it.id)} · ${inl(it.title)}`, `<div class="row wrap">${chip(pl, pt)}${chip(it.type === 'bug' ? 'Bug' : 'Cambio', it.type === 'bug' ? 'coral' : 'blue', 'outline')}${chip(esc(it.status), it.status === 'done' ? 'green' : it.status === 'doing' ? 'violet' : 'blue')}${it.area ? chip(esc(it.area), '', 'plain') : ''}</div><div class="md compact">${it.html}</div>${['open', 'doing'].includes(it.status) ? `${cmd(`/pandacorp:implement-backlog ${it.id}`)}${['open', 'doing'].includes(it.status) ? `<div class="row" style="justify-content:flex-end"><button type="button" class="btn danger" data-action="discard-backlog">${ico('trash', 'sm')}Descartar</button></div>` : ''}` : ''}`, { tone: it.type === 'bug' ? 'coral' : 'blue', kicker: `Backlog · ${pl}` }); return; }
  if (d.trophy) { const t = EXTRAS.guild.trophies.find(x => x.id === d.trophy); dialog(esc(t.title), `<div class="row wrap">${t.rarity ? chip(esc(t.rarity), RARITY[t.rarity] || 'slate') : ''}${chip(esc(CATEGORY[t.category] || t.category), '', 'plain')}${t.unlocked ? chip(`${ico('check', 'sm')}Desbloqueado ${esc(fmtDate(t.unlockedAt))}`, 'green') : chip(`${ico('lock', 'sm')}Bloqueado`, '', 'plain')}</div><p>${esc(t.description || 'Sin condición publicada.')}</p>${t.project ? `<p class="small faint">Proyecto: ${esc(t.project)}</p>` : ''}`, { tone: 'gold', kicker: 'Trofeo' }); return; }
  if (d.skill) { const k = EXTRAS.config.skills.find(x => x.slug === d.skill); dialog(`<span class="mono">${esc(k.name)}</span>`, `<div class="row wrap">${chip(esc(k.scope || 'sin ámbito'), 'violet')}${k.userInvocable === false ? chip('Motor interno', '', 'plain') : chip('Comando del owner', 'green')}</div><p class="muted">${esc(k.description)}</p>${k.agents?.length ? `<div class="row wrap"><span class="small faint">Agentes:</span>${k.agents.map(a => `<button type="button" class="chipbtn" data-agent="${esc(a)}">${esc(a)}</button>`).join('')}</div>` : ''}${k.userInvocable !== false ? cmd(k.name) : ''}<details><summary class="link">Definición completa</summary><div class="md compact" style="margin-top:12px">${k.html}</div></details>`, { tone: 'violet', kicker: 'Skill' }); return; }
  if (d.agent) { const a = EXTRAS.config.agents.find(x => x.id === d.agent || x.name === d.agent); if (!a) { toast('Ese agente no está en la captura'); return; } const skills = EXTRAS.config.skills.filter(k => (k.agents || []).includes(a.id)); dialog(esc(a.name), `<div class="row wrap">${chip(esc(a.model), MODEL_TONE[a.model] || 'slate')}${a.effort ? chip(`esfuerzo ${esc(a.effort)}`, '', 'plain') : ''}</div><p class="muted">${esc(a.description)}</p>${a.tools?.length ? `<div class="row wrap"><span class="small faint">Herramientas:</span>${a.tools.map(t => chip(esc(t), '', 'plain')).join('')}</div>` : ''}${skills.length ? `<div class="row wrap"><span class="small faint">Lo usan:</span>${skills.map(k => `<button type="button" class="chipbtn" data-skill="${esc(k.slug)}">${esc(k.name)}</button>`).join('')}</div>` : ''}<details><summary class="link">Definición completa</summary><div class="md compact" style="margin-top:12px">${a.html}</div></details>`, { tone: MODEL_TONE[a.model] || 'slate', kicker: 'Agente' }); return; }
  if (d.standard) { const s = EXTRAS.config.standards.find(x => x.id === d.standard); dialog(esc(s.title), `<div class="row wrap">${chip(esc(s.severity), s.severity === 'MUST' ? 'coral' : 'amber')}${chip(esc(s.domain), 'teal')}${chip(esc(s.enforcement || ''), '', 'plain')}</div><div class="md compact">${s.html}</div>`, { tone: 'teal', kicker: `Estándar · ${esc(s.domain)}` }); return; }

  const action = d.action;
  if (!action) return;
  if (action === 'drawer') { openDrawer(); return; }
  if (action === 'toggle-empty') { store.set('orbita-hide-empty', String(!hideEmpty())); render(); $('[data-action="toggle-empty"]')?.focus(); return; }
  if (action === 'toggle-sidebar') { store.set('orbita-sidebar', sidebarCollapsed() ? 'expanded' : 'collapsed'); renderSidebar(); $('[data-action="toggle-sidebar"]').focus(); return; }
  if (action === 'toggle-projects') { store.set('orbita-projects-open', String(!projectsOpen())); renderSidebar(); $('[data-action="toggle-projects"]').focus(); return; }
  if (action === 'projects') { openPicker(); return; }
  if (action === 'close-dialog') { const prev = confirmDialog.previous; confirmDialog.previous = null; if (prev) { $('#dlg-title').innerHTML = prev.title; $('#dlg-body').innerHTML = prev.body; $('#dlg-close').focus(); } else $('#dlg').close(); return; }
  if (action === 'confirm') { confirmDialog.previous = null; $('#dlg').close(); confirmDialog.pending?.(); return; }
  if (action === 'toggle-sub') { UI.subtitleOpen = !UI.subtitleOpen; render(); return; }
  if (action === 'doc-index') { const nav = $('#doc-index'); const open = nav.dataset.open !== 'true'; nav.dataset.open = String(open); el.setAttribute('aria-expanded', String(open)); return; }
  if (action === 'clear-board') { UI.boardQ = ''; UI.boardCat = ''; $('#idea-search').value = ''; $$('[data-cat-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.catFilter === ''))); filterBoard(); return; }
  if (action === 'capture') { dialog('Capturar ideas', `<p class="muted">Copia el comando según lo que quieras hacer y pégalo en Claude Code.</p>${[['Explorar una idea difusa conversando', '/pandacorp:explore'], ['Capturar una idea que ya tienes clara', '/pandacorp:new-idea'], ['Que la fábrica busque oportunidades', '/pandacorp:discover'], ['Pedir una recomendación de cartera', '/pandacorp:recommend']].map(([t, c]) => `<div class="stack sm"><span class="small muted">${t}</span>${cmd(c)}</div>`).join('')}`, { tone: 'violet', kicker: 'Ideas' }); return; }
  if (action === 'frd-toggle-all') { UI.frdAllOpen = !UI.frdAllOpen; render(); $('[data-action="frd-toggle-all"]').focus(); return; }
  if (action === 'backlog-clear') { UI.backlogPri = ''; UI.backlogType = ''; UI.backlogArea = ''; render(); return; }
  if (action === 'discarded') { const list = IDEAS.filter(i => i.status === 'discarded'); dialog(`Ideas descartadas · ${list.length}`, `<div class="divided">${list.map(i => `<a class="lrow" data-close-dialog href="${href('idea', { idea: i.slug })}"><span class="badge-icon sm" data-tone="slate">${ico('archive', 'sm')}</span><div class="grow"><strong>${esc(i.title)}</strong><small>${esc(i.category || '')} · leer propuesta y restaurar</small></div>${ico('chevR', 'sm')}</a>`).join('')}</div>`, { tone: 'slate', kicker: 'Ideas' }); return; }
  if (action === 'discard-idea' || action === 'restore-idea') { const i = IDEAS.find(x => x.slug === d.slug); const discard = action === 'discard-idea'; confirmDialog(discard ? 'Descartar idea' : 'Restaurar idea', discard ? `«${esc(i.title)}» pasará a la lista de descartadas. Podrás restaurarla después.` : `«${esc(i.title)}» volverá a su columna del tablero.`, discard ? 'Descartar' : 'Restaurar', () => toast(discard ? 'Simulado: la maqueta no descarta ideas' : 'Simulado: la maqueta no restaura ideas')); return; }
  if (action === 'discard-change') { confirmDialog('Descartar cambio', 'El cambio saldrá de la cola y quedará en el historial como descartado.', 'Descartar', () => toast('Simulado: la maqueta no modifica la cola')); return; }
  if (action === 'discard-backlog') { confirmDialog('Descartar del backlog', 'El ítem pasará a descartados con el motivo indicado.', 'Descartar', () => toast('Simulado: la maqueta no modifica el backlog')); return; }
});

async function graphAction(kind) {
  const frame = $('#diagram');
  const scroller = $('#diagram-scroll');
  if (kind === 'expand') {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    try { await frame.requestFullscreen(); } catch { frame.classList.toggle('is-expanded'); }
    return;
  }
  if (kind === 'fit') { const w = $('#canvas').offsetWidth; UI.modelScale = Math.max(0.55, Math.min(1, (scroller.clientWidth - 16) / w)); }
  else if (kind === 'reset') UI.modelScale = 1;
  else UI.modelScale = Math.max(0.3, Math.min(2, UI.modelScale + (kind === 'in' ? 0.15 : -0.15)));
  layoutDiagram();
}

document.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'idea-search') { UI.boardQ = el.value; filterBoard(); }
  if (el.id === 'project-search') $$('[data-project-match]').forEach(x => { x.hidden = !x.dataset.projectMatch.includes(el.value.toLowerCase()); });
  if (el.id === 'manual-search' && state.screen === 'documentacion' && !P('page')) { UI.manualQ = el.value; const pos = el.selectionStart; render(); const again = $('#manual-search'); again.focus(); again.setSelectionRange(pos, pos); return; }
  if (el.id === 'doc-search' || el.id === 'manual-search') {
    const q = el.value.trim().toLowerCase();
    if (el.id === 'doc-search') UI.docQ = el.value; else UI.manualQ = el.value;
    $$('[data-doc-text]').forEach(x => { x.hidden = !!q && !x.dataset.docText.includes(q); });
    $$('[data-doc-group]').forEach(g => { const any = $$('[data-doc-text]', g).some(x => !x.hidden); g.hidden = !any; if (q && any) g.open = true; });
  }
  if (el.id === 'model-search') {
    UI.modelQ = el.value;
    const p = currentProject();
    $('#model-body').innerHTML = P('model') === 'Esquema' ? schemaHtml(p.model.model) : diagramHtml(p.model.model);
    layoutDiagram();
  }
  if (el.id === 'cfg-search') { UI.cfgQ = el.value; const pos = el.selectionStart; render(); const again = $('#cfg-search'); again.focus(); again.setSelectionRange(pos, pos); }
  if (el.id === 'std-domain') patch({ dom: el.value });
  if (el.id === 'rule-search') { UI.ruleQ = el.value; const pos = el.selectionStart; render(); const again = $('#rule-search'); again.focus(); again.setSelectionRange(pos, pos); }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.id === 'wo-frd') patch({ frd: el.value });
  if (el.id === 'dag-frd') patch({ frd: el.value, focus: '' });
  if (el.id === 'cmd-target') patch({ target: el.value });
});
document.addEventListener('toggle', event => {
  const d = event.target;
  if (d.matches?.('details[data-schema]') && d.open) $$('details[data-schema]').forEach(o => { if (o !== d) o.open = false; });
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' && isPhone() && $('#sidebar').dataset.open === 'true') {
    const items = $$('#sidebar a, #sidebar button');
    const first = items[0], last = items[items.length - 1];
    if (!$('#sidebar').contains(document.activeElement)) { first.focus(); event.preventDefault(); }
    else if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
    else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
  }
  if (event.key === 'Escape') {
    if (closeDrawer()) { $('#menu').focus(); return; }
    $('#diagram.is-expanded')?.classList.remove('is-expanded');
  }
  const tab = event.target.closest?.('[role="tab"]');
  if (tab && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
    const list = $$('[role="tab"]', tab.parentElement);
    const i = list.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    list[next].focus();
    event.preventDefault();
  }
});
// Drag to pan the model diagram (the scrollbars and keyboard remain available).
let pan = null;
document.addEventListener('pointerdown', e => { const sc = e.target.closest('#diagram-scroll'); if (!sc || e.target.closest('button') || e.button !== 0) return; pan = { sc, x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; sc.style.cursor = 'grabbing'; });
document.addEventListener('pointermove', e => { if (!pan) return; pan.sc.scrollLeft = pan.l - (e.clientX - pan.x); pan.sc.scrollTop = pan.t - (e.clientY - pan.y); });
document.addEventListener('pointerup', () => { if (pan) pan.sc.style.cursor = ''; pan = null; });

$('#dlg-close').innerHTML = ico('x');
$('#menu').innerHTML = ico('menu');
$('#dlg-close').onclick = () => $('#dlg').close();
$('#dlg').addEventListener('close', () => { if (dialogTrigger?.isConnected) dialogTrigger.focus(); });
$('#dlg').addEventListener('click', e => { if (e.target === $('#dlg')) $('#dlg').close(); });
$('#menu').onclick = () => openDrawer();
$('#scrim').onclick = () => closeDrawer();
matchMedia('(max-width: 759px)').addEventListener('change', syncDrawerA11y);

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme').textContent = theme === 'dark' ? 'Tema claro' : 'Tema oscuro';
  store.set('orbita-theme', theme);
}
$('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
window.addEventListener('message', event => {
  if (parent === window || event.source !== parent || event.data?.source !== 'mc-preview') return;
  const { kind, value } = event.data;
  if (kind === 'theme' && ['light', 'dark'].includes(value)) setTheme(value);
  if (kind === 'screen' && SCREENS[value]) go(value, value === 'idea' ? { idea: 'book-memory-without-spoilers', tab: 'Spec' } : value === 'portfolio' ? { project: 'pandasaga' } : {});
});
window.addEventListener('hashchange', route);

const qs = new URLSearchParams(location.search);
const startTheme = ['light', 'dark'].includes(qs.get('theme')) ? qs.get('theme') : store.get('orbita-theme');
if (startTheme) setTheme(startTheme);
if (qs.get('demo') === 'off') $$('[data-demo-only]').forEach(x => { x.hidden = true; });
achievementNotice();
syncDrawerA11y();
route();
document.fonts?.ready.then(() => layoutDiagram());
