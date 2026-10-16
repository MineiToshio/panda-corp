#!/usr/bin/env node
/**
 * Legacy wrapper: measures the frozen components and builds the catalogue through the fidelity toolset
 * (fidelity/freeze.mjs stages split, measure and catalog). Prefer `node fidelity/freeze.mjs all` with
 * docs/design/freeze/fidelity.config.json.
 *
 * Usage (from the project root): node measure-components.mjs <config.json>
 * The config is either a fidelity config (fidelity/config.schema.json) or the legacy shape
 * { "prototype": "...", "components": [{ "name", "route", "selector", "setup"?, "click"? }], "exports"?: "<expression>" },
 * which is converted: selector -> root, setup -> pre, click -> the measured state, widths 375 + 1280.
 * Outputs: reference/css/ (split), reference/computed-styles.json, reference/components/, components.html, the
 * catalogue sheets and the `exports` files, all next to the prototype.
 */
import fs from 'node:fs';
import { ConfigError, loadConfig, loadSchema, resolveRoot, validate } from './fidelity/config.mjs';
import { freeze } from './fidelity/freeze.mjs';
import { BrowserUnavailable } from './fidelity/lib.mjs';

/**
 * Converts a legacy measure-components config into a fidelity config (a fidelity config passes through).
 * @param {object} raw parsed config
 * @returns {object} a fidelity config
 */
export function fromLegacy(raw) {
  if (validate(loadSchema(), raw).length === 0) return raw;
  return {
    prototype: raw.prototype,
    widths: [375, 1280],
    components: (raw.components || []).map((c) => ({
      name: c.name,
      route: c.route,
      root: c.selector,
      ...(c.setup ? { pre: c.setup } : {}),
      states: { default: c.click ? { click: c.click } : {} },
    })),
    ...(raw.exports ? { exports: raw.exports } : {}),
  };
}

const file = process.argv[2];
if (!file) { console.error('usage: node measure-components.mjs <config.json>'); process.exit(2); }
try {
  const cfg = loadConfig({ root: resolveRoot(), raw: fromLegacy(JSON.parse(fs.readFileSync(file, 'utf8'))) });
  const res = await freeze({ cfg, stages: ['split', 'measure', 'catalog'], force: true });
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  if (e instanceof ConfigError || e instanceof BrowserUnavailable) { console.error(e.message); process.exit(2); }
  throw e;
}
