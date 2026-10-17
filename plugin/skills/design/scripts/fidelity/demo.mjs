/**
 * The demo-scaffolding contract, defined once for the three tools that enforce it: the shard stage strips it from every
 * mock (`shard.strip` default), the round preflight checks it is hidden under demo=off (`preflight.demoSelectors` /
 * `demoText` defaults) and the design gate refuses a mock that still carries it. The prototype contract marks every
 * demo affordance with the attribute; the class prefix and the wording are the markers a missed attribute leaves.
 */

export const DEMO_ATTRIBUTE = 'data-demo-only';
export const DEMO_CLASS_PREFIX = 'demo-';
/** Regex source (case-insensitive) of demo wording that must never reach a product render. */
export const DEMO_TEXT = '\\b(solo demo|demo only|demo mode|modo demo)\\b';

/**
 * The demo selectors: the attribute plus any element with a demo-* class.
 * @param {string} [attribute] the demo-only attribute (config demoOnlyAttribute)
 * @returns {string[]} CSS selectors
 */
export function demoSelectors(attribute = DEMO_ATTRIBUTE) {
  return [`[${attribute}]`, `[class^="${DEMO_CLASS_PREFIX}"]`, `[class*=" ${DEMO_CLASS_PREFIX}"]`];
}

export const DEMO_SELECTORS = Object.freeze(demoSelectors());

/**
 * The demo markers left in a static HTML file (a mock): the attribute, a demo-* class, demo wording in a text node.
 * @param {string} html the file content
 * @param {string} [attribute] the demo-only attribute
 * @returns {string[]} the marker kinds found
 */
export function demoMarkers(html, attribute = DEMO_ATTRIBUTE) {
  const out = [];
  if (new RegExp(`<[a-z][^>]*\\s${attribute}(?=[\\s=>/])`, 'i').test(html)) out.push(`${attribute} attribute`);
  if (new RegExp(`<[a-z][^>]*\\sclass\\s*=\\s*["'](?:[^"']*\\s)?${DEMO_CLASS_PREFIX}[\\w-]+`, 'i').test(html)) out.push(`${DEMO_CLASS_PREFIX}* class`);
  if (new RegExp(`>[^<]*${DEMO_TEXT}[^<]*<`, 'i').test(html)) out.push('"Solo demo" text');
  return out;
}
