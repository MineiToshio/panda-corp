#!/usr/bin/env node
/**
 * Splits the prototype's main <style> into portable per-family files (reference/css/), rules verbatim, each keeping its
 * @media/@container wrapper; relative url()s are rebased for the new folder. Families come from the config's component
 * map (css.families + css.rules + css.overrides); a rule nothing claims is filed by the heuristic (its key selector's
 * first class stem) unless css.unmatched is "fail". Fail-closed: the files are built in memory and written only when
 * the multiset of normalised rules of the files equals the prototype's (0 missing, 0 extra).
 * Writes reference/css/*.css + README.md (load order, verification, per-file table) and freeze/split-report.json
 * (order, families, counts, idRules: the id-selector rules the mocks and the catalogue repeat for prefixed ids), then
 * extracts the tokens into docs/design/design-tokens.json (+ design-tokens-history.json when they changed; tokens.mjs).
 * Usage: node split-css.mjs   (from the project root, or FIDELITY_ROOT)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.mjs';
import { flatRules, multisetDiff, normWs, units } from './cssparse.mjs';
import { relPosix } from './lib.mjs';
import { writeIfChanged } from './pool.mjs';
import { writeTokens } from './tokens.mjs';

/**
 * Locates the main <style> block (the largest one).
 * @param {string} html prototype source
 * @returns {{start: number, end: number, css: string, baseLine: number, count: number}} content offsets
 */
export function mainStyle(html) {
  const blocks = [...html.matchAll(/<style(\s[^>]*)?>/g)].map((m) => {
    const start = m.index + m[0].length;
    const end = html.indexOf('</style>', start);
    return { start, end, open: m.index };
  });
  if (!blocks.length) throw new Error('the prototype has no <style> block');
  const b = blocks.reduce((x, y) => (y.end - y.start > x.end - x.start ? y : x));
  const css = html.slice(b.start, b.end);
  return { ...b, css, baseLine: html.slice(0, b.start).split('\n').length, count: blocks.length };
}

const unitKey = (u) => {
  let k = normWs(u.prelude);
  if (u.children) { const first = u.children.find((c) => c.kind !== 'comment'); k += ` { ${first ? normWs(first.prelude) : ''}`; }
  return k;
};

/** The heuristic family of a rule: fonts / motion / tokens / base, else the stem of its key selector's first class. */
function heuristicFamily(prelude, key) {
  if (prelude.startsWith('@font-face')) return 'fonts';
  if (prelude.startsWith('@keyframes')) return 'motion';
  if (prelude.startsWith('@')) return 'at-rules';
  if (!key) return 'tokens';
  const m = key.match(/^([.#]?)([A-Za-z_][\w-]*)/);
  if (!m || !m[1]) return 'base';
  return m[1] === '#' ? 'ids' : m[2].split(/[-_]/)[0].toLowerCase() || 'base';
}

/**
 * Builds the split in memory.
 * @param {object} cfg normalised config
 * @returns {{files: {name: string, content: string, rules: number}[], report: object}} files in load order + report
 * @throws {Error} on unmatched rules in fail mode, or a rule-count mismatch
 */
export function buildSplit(cfg) {
  const html = fs.readFileSync(cfg.paths.prototype, 'utf8');
  const { css, baseLine } = mainStyle(html);
  const lines = html.split('\n');
  const us = units(css, baseLine);
  const urlPrefix = `${relPosix(cfg.paths.css, cfg.paths.protoDir)}/`;
  const rebase = (t) => t.replace(/url\((['"]?)(?![a-z]+:|\/|#|data:)([^'")]+)\1\)/g, (m, q, u) => `url(${q}${urlPrefix}${u}${q})`);
  const prefix = new RegExp(cfg.css.prefixStrip);
  const rules = cfg.css.rules.map((r) => ({ family: r.family, re: new RegExp(r.match) }));
  const keyOf = (p) => {
    let first = p.split(',')[0].trim();
    for (let prev = null; prev !== first;) { prev = first; first = first.replace(prefix, ''); }
    return first;
  };
  const unmatched = [];
  const heuristic = [];
  const classify = (u) => {
    const uk = unitKey(u);
    if (cfg.css.overrides[uk]) return cfg.css.overrides[uk];
    const p = normWs(u.prelude);
    const k = p.startsWith('@keyframes') ? p : keyOf(p);
    for (const r of rules) if (r.re.test(k)) return r.family;
    unmatched.push(`line ${u.la}: ${p.slice(0, 120)}`);
    const fam = heuristicFamily(p, keyOf(p));
    if (!heuristic.includes(fam)) heuristic.push(fam);
    return fam;
  };
  const chunks = new Map();
  const ranges = new Map();
  const selmap = new Map();
  const emit = (fam, text, la, lb, sel) => {
    if (!chunks.has(fam)) { chunks.set(fam, []); ranges.set(fam, []); selmap.set(fam, []); }
    chunks.get(fam).push(text);
    ranges.get(fam).push([la, lb]);
    if (sel) selmap.get(fam).push(sel);
  };
  const verbatim = cfg.css.verbatim.map((v) => {
    const a = us.find((u) => u.kind === 'comment' && u.text.includes(v.begin));
    const b = us.find((u) => u.kind === 'comment' && u.text.includes(v.end));
    if (!a || !b) throw new Error(`css.verbatim: markers "${v.begin}" / "${v.end}" not found in the prototype <style>`);
    return { ...v, la: a.la, lb: b.lb };
  });
  let pending = [];
  const flush = (fam) => { for (const c of pending) emit(fam, c.text, c.la, c.lb); pending = []; };
  for (const u of us) {
    const vb = verbatim.find((v) => v.la <= u.la && u.la <= v.lb);
    if (vb) {
      if (pending.length) flush(vb.pendingCommentsTo || vb.family);
      emit(vb.family, u.text, u.la, u.lb, u.kind === 'comment' ? null : normWs(u.prelude));
      continue;
    }
    if (u.kind === 'comment') {
      const closing = cfg.css.closingComments.find((c) => u.text.includes(c.contains));
      if (closing) emit(closing.family, u.text, u.la, u.lb); else pending.push(u);
      continue;
    }
    if (u.children && !cfg.css.overrides[unitKey(u)]) {
      const groups = [];
      let inner = [];
      for (const c of u.children) {
        if (c.kind === 'comment') { inner.push(c); continue; }
        const fam = classify(c);
        if (groups.length && groups[groups.length - 1][0] === fam) groups[groups.length - 1][1].push(...inner, c);
        else groups.push([fam, [...inner, c]]);
        inner = [];
      }
      if (inner.length && groups.length) groups[groups.length - 1][1].push(...inner);
      if (!groups.length) { pending.push({ ...u, kind: 'comment' }); continue; }
      groups.forEach(([fam, items], gi) => {
        if (gi === 0) flush(fam);
        const body = items.map((it) => `  ${it.text.trim()}`).join('\n');
        const sel = `${normWs(u.prelude)} ${items.filter((it) => it.kind !== 'comment').map((it) => normWs(it.prelude)).join(' | ')}`;
        emit(fam, `${u.prelude}{\n${body}\n}`, groups.length > 1 ? items[0].la : u.la, groups.length > 1 ? items[items.length - 1].lb : u.lb, sel);
      });
      continue;
    }
    const fam = classify(u);
    flush(fam);
    emit(fam, u.text.trim(), u.la, u.lb, normWs(u.prelude));
  }
  if (pending.length) {
    const last = [...chunks.keys()].pop();
    if (!last) throw new Error('the prototype <style> holds only comments');
    flush(last);
  }
  if (unmatched.length && cfg.css.unmatched === 'fail') throw new Error(`css: ${unmatched.length} rule(s) match no family (css.unmatched is "fail"):\n  ${unmatched.slice(0, 20).join('\n  ')}`);

  const configured = cfg.css.families.map((f) => f.name);
  const first = ['fonts', 'tokens', 'base'].filter((f) => heuristic.includes(f) && !configured.includes(f));
  const order = [...configured, ...first, ...heuristic.filter((f) => !first.includes(f) && !configured.includes(f))].filter((f) => chunks.has(f));
  const meta = new Map(cfg.css.families.map((f) => [f.name, f]));
  const relProto = relPosix(cfg.root, cfg.paths.prototype);
  const files = order.map((fam, idx) => {
    const name = cfg.css.numbered && !/^\d\d-/.test(fam) ? `${String(idx).padStart(2, '0')}-${fam}` : fam;
    const f = meta.get(fam) || { description: `Rules whose key selector the heuristic files under "${fam}" (no css.families entry claims them)` };
    const merged = [];
    for (const [la, lb] of [...ranges.get(fam)].sort((x, y) => x[0] - y[0] || x[1] - y[1])) {
      if (merged.length && la <= merged[merged.length - 1][1] + 1) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], lb);
      else merged.push([la, lb]);
    }
    const rtxt = merged.map(([x, y]) => (x !== y ? `${x}-${y}` : `${x}`)).join(', ');
    const vb = verbatim.find((v) => v.family === fam);
    const body = vb ? lines.slice(vb.la - 1, vb.lb).join('\n') : chunks.get(fam).join('\n');
    const head = `/* ${name}.css: ${f.description || fam}.${f.note ? `\n   ${f.note}` : ''}\n   Source: ${relProto} <style>, lines ${rtxt}.\n   Generated by splitting the prototype; rules are verbatim, each keeps its @media/@container wrapper. */\n`;
    const content = `${head}${rebase(body)}\n`;
    return { name, family: fam, content, rules: flatRules(units(content)).length, lines: rtxt, selectors: selmap.get(fam), description: f.description || '', component: f.component || '' };
  });
  const orig = flatRules(units(rebase(css), baseLine));
  const split = flatRules(units(files.map((f) => f.content).join('')));
  const { missing, extra } = multisetDiff(orig, split);
  const counts = { original: orig.length, split: split.length, missing: missing.length, extra: extra.length };
  if (missing.length || extra.length) throw new Error(`css split is not complete: ${JSON.stringify(counts)}\n  missing: ${missing.slice(0, 5).join('\n  ')}\n  extra: ${extra.slice(0, 5).join('\n  ')}`);
  const empty = configured.filter((f) => !chunks.has(f));
  return { files, report: { order: files.map((f) => f.name), counts, heuristic: { families: heuristic, rules: unmatched.length, examples: unmatched.slice(0, 20) }, empty, families: Object.fromEntries(files.map((f) => [f.name, { family: f.family, description: f.description, lines: f.lines, rules: f.rules, selectors: f.selectors }])), idRules: idRules(files) } };
}

/** The rules with id selectors, which the mocks and the catalogue repeat for their prefixed ids. */
function idRules(files) {
  const out = [];
  const walk = (us, wrap) => {
    for (const u of us) {
      if (u.kind === 'comment') continue;
      if (u.children) { walk(u.children, [...wrap, u.prelude.trim()]); continue; }
      if (u.kind !== 'rule') continue;
      const ids = [...u.prelude.replace(/\[[^\]]*\]/g, '').matchAll(/#([A-Za-z][-\w]*)/g)].map((m) => m[1]);
      if (ids.length) out.push({ wrap, prelude: u.prelude.trim(), body: u.body.trim(), ids: [...new Set(ids)].sort() });
    }
  };
  for (const f of files) walk(units(f.content), []);
  return out;
}

function readme(cfg, files, report) {
  const relProto = relPosix(cfg.root, cfg.paths.prototype);
  const out = [
    '# Portable prototype CSS',
    '',
    `The approved prototype's main \`<style>\` block (\`${relProto}\`), split into standalone files by component family so the build can lift a component's exact rules without reading the whole prototype. Every rule is verbatim and keeps its \`@media\` / \`@container\` wrapper; the one rewrite is relative \`url()\`s, rebased for this folder. Each file's header lists the prototype lines it came from. Generated by the design-freeze fidelity tools (\`split\` stage): edit the prototype, not these files.`,
    '',
    '## Load order',
    '',
    'Link the files **in this order**: where two rules of equal specificity touch the same element, the later file wins, exactly as the later line won in the prototype.',
    '',
    '```html',
    ...files.map((f) => `<link rel="stylesheet" href="css/${f.name}.css">`),
    '```',
    '',
    '## Verification',
    '',
    `- **Completeness (mechanical):** the prototype's rules and the concatenation of these files, parsed into normalised \`(wrapper chain, selector, declarations)\` triples and compared as multisets: **${report.counts.original} rules in the prototype, ${report.counts.split} in the files, ${report.counts.missing} missing, ${report.counts.extra} extra.**`,
    `- **Render identity:** the \`identity\` stage renders a copy of the prototype whose \`<style>\` is replaced by \`<link>\`s to these files in this order, and requires every capture to be pixel-identical (\`docs/design/freeze/state.json\` records the last result).`,
    report.heuristic.rules ? `- **Heuristic families:** ${report.heuristic.rules} rule(s) no configured family claims were filed by selector stem (${report.heuristic.families.join(', ')}). Claim them in \`css.rules\` to name their files.` : '- Every rule was filed by the configured component map.',
    '',
    '## Files',
    '',
    '| File | Component | What | Prototype lines | Rules |',
    '|---|---|---|---|---|',
    ...files.map((f) => `| \`${f.name}.css\` | ${f.component} | ${f.description.replace(/\|/g, '\\|')} | ${f.lines} | ${f.rules} |`),
    '',
  ];
  return out.join('\n');
}

/**
 * The split stage: builds, verifies and writes the files (only when complete).
 * @param {{cfg: object}} ctx
 * @returns {Promise<object>} summary {files, counts, heuristic}
 */
export async function run({ cfg }) {
  const { files, report } = buildSplit(cfg);
  fs.mkdirSync(cfg.paths.css, { recursive: true });
  const keep = new Set(files.map((f) => `${f.name}.css`));
  for (const f of fs.readdirSync(cfg.paths.css)) if (f.endsWith('.css') && !keep.has(f)) fs.rmSync(path.join(cfg.paths.css, f));
  for (const f of files) writeIfChanged(path.join(cfg.paths.css, `${f.name}.css`), f.content);
  writeIfChanged(path.join(cfg.paths.css, 'README.md'), readme(cfg, files, report));
  writeIfChanged(path.join(cfg.paths.freeze, 'split-report.json'), `${JSON.stringify(report, null, 1)}\n`);
  const tokens = writeTokens(cfg);
  return { units: files.length, files: files.length, counts: report.counts, heuristicRules: report.heuristic.rules, empty: report.empty, tokens: tokens.perTheme, tokenOverrides: tokens.overrides };
}

/**
 * Reads the split report the split stage wrote (the CSS load order and the id rules).
 * @param {object} cfg normalised config
 * @returns {object} the report
 * @throws {Error} when the split stage has not run
 */
export function readSplitReport(cfg) {
  const f = path.join(cfg.paths.freeze, 'split-report.json');
  if (!fs.existsSync(f)) throw new Error(`no ${f}: run the split stage first`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const summary = await run({ cfg: loadConfig() });
  console.log(JSON.stringify(summary));
}
