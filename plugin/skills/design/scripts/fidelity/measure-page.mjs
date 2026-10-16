/**
 * Page-side functions of the measure stage, serialised into the page with page.evaluate (each is self-contained).
 * Target specs: "$" the measured root, "$ sel" inside it, "doc:sel" anywhere in the document, "tile:$" the root's
 * closest .tile, anything else a document selector.
 */

/** The 44 recorded properties (size is added: the bounding box). `translate` keeps hover lifts and entrance end frames. */
export const PROPS = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'color', 'background-color', 'background-image',
  'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'padding', 'margin', 'gap', 'box-shadow', 'min-height', 'width', 'height', 'display',
  'grid-template-columns', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'opacity', 'visibility', 'transform', 'filter', 'outline', 'outline-offset', 'transition',
  'cursor', 'mix-blend-mode', 'object-fit', 'text-overflow', 'white-space', 'translate'];

/** The colour-bearing subset recorded for the non-primary themes under the pareto scope. */
export const COLOR_PROPS = ['color', 'background-color', 'background-image', 'border-top', 'border-right', 'border-bottom', 'border-left', 'box-shadow', 'outline', 'filter'];

/** Tags the first visible match of rootSel (else the first match) as data-ms-root; false when nothing matches. */
export function pageResolve({ rootSel }) {
  document.querySelectorAll('[data-ms-root]').forEach((e) => e.removeAttribute('data-ms-root'));
  const all = [...document.querySelectorAll(rootSel)];
  const vis = all.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const el = vis || all[0];
  if (!el) return false;
  el.setAttribute('data-ms-root', '');
  return true;
}

/** Tags each target spec's element data-ms-t<i>; returns which resolved. */
export function pageTag({ specs }) {
  const root = document.querySelector('[data-ms-root]');
  const res = (s) => {
    if (s === '$') return root;
    if (s.startsWith('$ ')) return root.querySelector(s.slice(2));
    if (s === 'tile:$') return root.closest('.tile');
    if (s.startsWith('doc:')) return document.querySelector(s.slice(4));
    return document.querySelector(s);
  };
  return specs.map((s, i) => { const el = res(s); if (el) el.setAttribute(`data-ms-t${i}`, ''); return !!el; });
}

/**
 * Computed styles of the root and its children. Infinite animations are paused at currentTime 0 while reading (a record
 * whose own property one drives is flagged animated: 'infinite' + animatedProps) and resumed after; finite ones are finished.
 */
export function pageMeasure({ props, children }) {
  const root = document.querySelector('[data-ms-root]');
  const infinite = (list) => list.filter((a) => a.effect && a.effect.getTiming().iterations === Infinity);
  for (const a of document.getAnimations()) { try { if (a.effect && a.effect.getTiming().iterations !== Infinity && a.playState === 'running') a.finish(); } catch { /* no finite end */ } }
  const frozen = infinite(document.getAnimations()).map((a) => [a, a.currentTime, a.playState]);
  for (const [a] of frozen) { a.pause(); a.currentTime = 0; }
  const drivenBy = (el) => {
    const driven = new Set();
    for (const a of infinite(el.getAnimations())) for (const kf of a.effect.getKeyframes()) for (const k of Object.keys(kf)) {
      if (['offset', 'easing', 'composite', 'computedOffset'].includes(k)) continue;
      const css = k === 'cssFloat' ? 'float' : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      if (props.includes(css)) driven.add(css);
    }
    return [...driven].sort();
  };
  const pick = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const o = {};
    for (const p of props) o[p] = cs.getPropertyValue(p).slice(0, 240);
    o.size = `${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}`;
    const driven = drivenBy(el);
    if (driven.length) { o.animated = 'infinite'; o.animatedProps = driven; }
    return o;
  };
  let kids = children;
  if (!kids) {
    const seen = new Set();
    kids = [];
    for (const d of root.querySelectorAll('[class]')) {
      const c = typeof d.className === 'string' ? d.className.trim().split(/\s+/)[0] : null;
      if (!c || seen.has(c) || c.startsWith('ms-')) continue;
      seen.add(c);
      kids.push(`.${c}`);
      if (kids.length === 6) break;
    }
  }
  const ch = {};
  for (const k of kids) {
    let el;
    if (k.startsWith('doc:')) el = document.querySelector(k.slice(4));
    else { try { el = root.querySelector(k); } catch { el = null; } }
    ch[k] = pick(el);
  }
  const result = { root: pick(root), children: ch, childSelectors: kids };
  for (const [a, t, st] of frozen) { a.currentTime = t; if (st === 'running') a.play(); }
  return result;
}

/** The panel box relative to its anchor box, viewport pixels (scroll-independent); an unrendered panel is absent. */
export function pageAnchor({ panel, anchor }) {
  const root = document.querySelector('[data-ms-root]');
  const res = (t) => (t === '$' ? root : t.startsWith('$ ') ? root.querySelector(t.slice(2)) : t.startsWith('doc:') ? document.querySelector(t.slice(4)) : document.querySelector(t));
  const p = res(panel);
  const a = res(anchor);
  if (!a) return { error: `anchor not found: ${anchor}` };
  if (!p) return { absent: true, reason: 'panel not in the DOM' };
  const pr = p.getBoundingClientRect();
  const ar = a.getBoundingClientRect();
  if (getComputedStyle(p).display === 'none' || !pr.width || !pr.height) return { absent: true, reason: 'panel has no box (display:none)' };
  const q = (n) => Math.round(n * 10) / 10;
  return {
    panel_size: [q(pr.width), q(pr.height)],
    anchor_size: [q(ar.width), q(ar.height)],
    top_left: { dx: q(pr.left - ar.left), dy: q(pr.top - ar.top) },
    top_right: { dx: q(pr.right - ar.right), dy: q(pr.top - ar.top) },
  };
}

/**
 * The shown element's markup in its current state plus its ancestor chain (the catalogue renders the chain as
 * display:contents so context selectors keep matching); forced pseudo-classes and real focus become data-st.
 */
export function pageSnapshot({ forcedMap, show }) {
  const root = document.querySelector('[data-ms-root]');
  const el = show ? root.closest(show) || root : root;
  for (const [i, pcs] of forcedMap) { const t = document.querySelector(`[data-ms-t${i}]`); if (t) t.setAttribute('data-st', pcs.join(' ')); }
  const ae = document.activeElement;
  if (ae && ae !== document.body && el.contains(ae)) {
    const add = (n, v) => n.setAttribute('data-st', `${n.getAttribute('data-st') || ''} ${v}`.trim());
    add(ae, `focus${ae.matches(':focus-visible') ? ' focus-visible' : ''}`);
    for (let a = ae; a; a = a.parentElement) { add(a, 'focus-within'); if (a === el) break; }
  }
  for (const i of [el, ...el.querySelectorAll('input')]) if (i.tagName === 'INPUT' && (i.type === 'checkbox' || i.type === 'radio')) { if (i.checked) i.setAttribute('checked', ''); else i.removeAttribute('checked'); }
  if (el !== root) root.setAttribute('data-cat-measured', '');
  const clone = el.cloneNode(true);
  root.removeAttribute('data-cat-measured');
  for (const n of [clone, ...clone.querySelectorAll('*')]) { n.removeAttribute('data-ms-root'); for (let k = 0; k < 12; k++) n.removeAttribute(`data-ms-t${k}`); }
  const html = clone.outerHTML;
  const chain = [];
  for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
    const attrs = {};
    for (const at of a.attributes) if (!['hidden', 'aria-hidden', 'inert'].includes(at.name) && !at.name.startsWith('data-ms-')) attrs[at.name] = at.value;
    chain.unshift({ tag: a.tagName.toLowerCase(), attrs });
  }
  document.querySelectorAll('[data-st]').forEach((e) => e.removeAttribute('data-st'));
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { html, chain, size: [Math.round(r.width), Math.round(r.height)], position: cs.position, display: cs.display };
}

/** Applies attribute and class toggles to tagged targets; returns the undo list. */
export function pageToggle({ attr, cls, base }) {
  const u = [];
  attr.forEach(([, name, val], k) => { const el = document.querySelector(`[data-ms-t${base + k}]`); u.push(['a', base + k, name, el.getAttribute(name)]); if (val === null) el.removeAttribute(name); else el.setAttribute(name, val); });
  cls.forEach(([, c, on], k) => { const el = document.querySelector(`[data-ms-t${base + attr.length + k}]`); u.push(['c', base + attr.length + k, c, el.classList.contains(c)]); el.classList.toggle(c, on); });
  return u;
}

/** Reverts pageToggle's undo list and clears the target tags. */
export function pageUndo(undo) {
  for (const [k, idx, name, prev] of undo) {
    const el = document.querySelector(`[data-ms-t${idx}]`);
    if (!el) continue;
    if (k === 'a') { if (prev === null) el.removeAttribute(name); else el.setAttribute(name, prev); } else el.classList.toggle(name, prev);
  }
  for (let n = 0; n < 12; n++) document.querySelectorAll(`[data-ms-t${n}]`).forEach((e) => e.removeAttribute(`data-ms-t${n}`));
}

/** The root plus any open popover hanging from it (absolutely positioned, visible, >= 40 px descendants). */
export function pageCropBox() {
  const e = document.querySelector('[data-ms-root]');
  const b = e.getBoundingClientRect();
  let x1 = b.left;
  let y1 = b.top;
  let x2 = b.right;
  let y2 = b.bottom;
  for (const d of e.querySelectorAll('*')) {
    const cs = getComputedStyle(d);
    if (!/absolute|fixed/.test(cs.position) || cs.display === 'none' || cs.visibility === 'hidden' || d.closest('[hidden]')) continue;
    const q = d.getBoundingClientRect();
    if (q.width < 40 || q.height < 40) continue;
    x1 = Math.min(x1, q.left); y1 = Math.min(y1, q.top); x2 = Math.max(x2, q.right); y2 = Math.max(y2, q.bottom);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
