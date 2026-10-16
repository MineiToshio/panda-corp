#!/usr/bin/env node
/**
 * Legacy wrapper: shards the frozen prototype into one mock per UI FRD through the fidelity toolset
 * (fidelity/freeze.mjs stages split and shard). Prefer `node fidelity/freeze.mjs shard` with
 * docs/design/freeze/fidelity.config.json.
 *
 * Usage (from the project root): node shard-prototype.mjs <config.json>
 * The config is either a fidelity config (fidelity/config.schema.json) or the legacy shape
 * { "prototype": "...", "widths": [1280, 375], "lang"?: "es", "frds": { "frd-01-slug": [{ "id", "title", "route", "setup"?, "click"? }] } },
 * which is converted: setup -> a js action, click -> a click action.
 * List EVERY state the FRD's acceptance criteria name (loading, empty, error, partial, dialogs), not only the happy
 * path: a state with no mock becomes an open question in the FDD and a blind spot for the build.
 * Output per FRD: docs/frds/<frd>/mocks/<slug>.html (visible screen + open dialogs per state, ids prefixed, the icon
 * sprite inlined, the split reference CSS linked) and mocks/screenshots/<id>-<width>-<theme>.jpg.
 */
import fs from 'node:fs';
import { ConfigError, loadConfig, loadSchema, resolveRoot, validate } from './fidelity/config.mjs';
import { freeze } from './fidelity/freeze.mjs';
import { BrowserUnavailable } from './fidelity/lib.mjs';

/**
 * Converts a legacy shard config into a fidelity config (a fidelity config passes through).
 * @param {object} raw parsed config
 * @returns {object} a fidelity config
 */
export function fromLegacy(raw) {
  if (validate(loadSchema(), raw).length === 0) return raw;
  const states = {};
  for (const [frd, list] of Object.entries(raw.frds || {})) {
    states[frd] = list.map((s) => {
      const actions = [...(s.setup ? [{ js: s.setup }] : []), ...(s.click ? [{ click: s.click }] : [])];
      return { id: s.id, title: s.title, route: s.route, ...(actions.length ? { actions } : {}) };
    });
  }
  return { prototype: raw.prototype, ...(raw.lang ? { lang: raw.lang } : {}), ...(raw.widths ? { widths: raw.widths } : {}), states };
}

const file = process.argv[2];
if (!file) { console.error('usage: node shard-prototype.mjs <config.json>'); process.exit(2); }
try {
  const cfg = loadConfig({ root: resolveRoot(), raw: fromLegacy(JSON.parse(fs.readFileSync(file, 'utf8'))) });
  const res = await freeze({ cfg, stages: ['split', 'shard'], force: true });
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  if (e instanceof ConfigError || e instanceof BrowserUnavailable) { console.error(e.message); process.exit(2); }
  throw e;
}
