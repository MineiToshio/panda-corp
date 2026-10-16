/**
 * A minimal CSS tokenizer for the splitter: top-level units with line numbers, @media / @container / @supports /
 * @layer opened one level, and a normalised (wrapper chain, prelude, declarations) form for multiset comparison.
 */

const NESTED = new Set(['@media', '@container', '@supports', '@layer']);

/** @param {string} s @returns {(k: number) => number} 0-based offset -> count of newlines before it */
function newlineCounter(s) {
  const nl = [];
  for (let i = s.indexOf('\n'); i >= 0; i = s.indexOf('\n', i + 1)) nl.push(i);
  return (k) => {
    let lo = 0;
    let hi = nl.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (nl[mid] < k) lo = mid + 1; else hi = mid; }
    return lo;
  };
}

/** i points just after '{'; returns the index just after the matching '}' (comment and string aware). */
function scanBlock(s, i) {
  let depth = 1;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); if (j < 0) throw new Error('unterminated comment'); i = j + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && s[j] !== c) j += s[j] === '\\' ? 2 : 1;
      i = j + 1;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i + 1; }
    i++;
  }
  throw new Error('unbalanced braces');
}

/**
 * Splits CSS into units: {kind: comment|rule|at|stmt, text, prelude?, body?, la, lb, children?}.
 * @param {string} s CSS text
 * @param {number} [baseLine] line number of the first character
 * @returns {object[]} units
 */
export function units(s, baseLine = 1) {
  const count = newlineCounter(s);
  const lineOf = (k) => baseLine + count(k);
  const out = [];
  const n = s.length;
  let i = 0;
  while (i < n) {
    if (/\s/.test(s[i])) { i++; continue; }
    if (s.startsWith('/*', i)) {
      const j = s.indexOf('*/', i + 2) + 2;
      if (j < 2) throw new Error('unterminated comment');
      out.push({ kind: 'comment', text: s.slice(i, j), la: lineOf(i), lb: lineOf(j - 1) });
      i = j;
      continue;
    }
    let j = i;
    while (j < n && s[j] !== '{' && s[j] !== ';') {
      if (s.startsWith('/*', j)) { j = s.indexOf('*/', j + 2) + 2; continue; }
      j++;
    }
    if (j >= n) throw new Error(`trailing junk: ${s.slice(i, i + 80)}`);
    const prelude = s.slice(i, j).trim();
    if (s[j] === ';') {
      out.push({ kind: 'stmt', text: s.slice(i, j + 1), prelude, la: lineOf(i), lb: lineOf(j) });
      i = j + 1;
      continue;
    }
    const k = scanBlock(s, j + 1);
    const u = { kind: 'rule', text: s.slice(i, k), prelude, body: s.slice(j + 1, k - 1), la: lineOf(i), lb: lineOf(k - 1) };
    if (prelude.startsWith('@')) {
      u.kind = 'at';
      if (NESTED.has(prelude.split(/\s+/)[0].split('(')[0])) u.children = units(s.slice(j + 1, k - 1), lineOf(j + 1));
    }
    out.push(u);
    i = k;
  }
  return out;
}

/** @param {string} t @returns {string} comments removed, whitespace collapsed and dropped around { } ; , > ~ */
export function normWs(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim().replace(/\s*([{};,>~])\s*/g, '$1');
}

/** @param {string} body @returns {string} normalised declaration list */
export function normDecls(body) {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').split(';').map(normWs).map((p) => p.replace(/^([-\w]+)\s*:\s*/, '$1:')).filter(Boolean).join(';');
}

/**
 * Every style rule / keyframes / statement as a normalised JSON key [wrapper chain, prelude, declarations].
 * @param {object[]} us units
 * @param {string[]} [wrap]
 * @returns {string[]} keys (a multiset: duplicates kept)
 */
export function flatRules(us, wrap = []) {
  const res = [];
  for (const u of us) {
    if (u.kind === 'comment') continue;
    if (u.kind === 'stmt') res.push(JSON.stringify([wrap, normWs(u.prelude), '']));
    else if (u.children) res.push(...flatRules(u.children, [...wrap, normWs(u.prelude)]));
    else if (u.kind === 'at') res.push(JSON.stringify([wrap, normWs(u.prelude), normWs(u.body)]));
    else res.push(JSON.stringify([wrap, normWs(u.prelude), normDecls(u.body)]));
  }
  return res;
}

/**
 * Multiset difference sizes of two key lists.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {{missing: string[], extra: string[]}} keys of a absent from b, and of b absent from a
 */
export function multisetDiff(a, b) {
  const m = new Map();
  for (const k of a) m.set(k, (m.get(k) || 0) + 1);
  for (const k of b) m.set(k, (m.get(k) || 0) - 1);
  const missing = [];
  const extra = [];
  for (const [k, v] of m) { for (let i = 0; i < v; i++) missing.push(k); for (let i = 0; i < -v; i++) extra.push(k); }
  return { missing, extra };
}
