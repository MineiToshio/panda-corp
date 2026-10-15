#!/usr/bin/env node
/**
 * Step 9 deliverable check (DR-054 + DR-056): existence is checked, never self-asserted.
 * Usage (from the project root): node check-design-gate.mjs   → exit 0 when every artifact exists, 1 otherwise.
 */
import fs from "node:fs";
import path from "node:path";

const exists = p => fs.existsSync(p);
const nonEmpty = (p, min = 200) => exists(p) && fs.statSync(p).size >= min;
const read = p => (exists(p) ? fs.readFileSync(p, "utf8") : "");
const checks = [];
const check = (label, ok) => checks.push([label, Boolean(ok)]);
const tokens = (() => { try { return JSON.parse(read("docs/design/design-tokens.json")); } catch { return null; } })();
const tokenText = JSON.stringify(tokens || {});
check("DESIGN.md exists and is not marked DRAFT", nonEmpty("DESIGN.md") && !/\bDRAFT\b/.test(read("DESIGN.md").split("\n").slice(0, 5).join("\n")));
check("design-tokens.json parses", tokens);
check("typography uses web fonts (no system-only stack as the first family)", tokens && !/"--font-[a-z]+":\s*"(ui-sans-serif|system-ui|-apple-system|ui-serif|serif|sans-serif)/.test(tokenText));
check("design-decisions.md", nonEmpty("docs/design/design-decisions.md"));
check("components.md non-empty with an AppShell row or an explicit no-shell note", nonEmpty("docs/design/components.md", 1000) && /AppShell|no persistent shell/i.test(read("docs/design/components.md")));
check("a11y-report.md", nonEmpty("docs/design/a11y-report.md"));
const protoDir = "docs/design/prototype";
const protoHtml = exists(protoDir) ? fs.readdirSync(protoDir).filter(f => f.endsWith(".html") && f !== "components.html") : [];
check("whole-app prototype in docs/design/prototype/", protoHtml.length > 0);
check("component catalogue (prototype/components.html)", exists(path.join(protoDir, "components.html")));
check("measured styles (prototype/reference/computed-styles.json)", nonEmpty(path.join(protoDir, "reference/computed-styles.json")));
check("exported logo SVGs (prototype/logo/)", exists(path.join(protoDir, "logo")) && fs.readdirSync(path.join(protoDir, "logo")).some(f => f.endsWith(".svg")));
check("fidelity-checklist.md", nonEmpty("docs/design/fidelity-checklist.md"));
check("technical-assumptions.md", nonEmpty("docs/design/technical-assumptions.md"));
for (const dir of exists("docs/frds") ? fs.readdirSync("docs/frds").filter(d => d.startsWith("frd-")) : []) {
  const frd = read(`docs/frds/${dir}/frd.md`);
  if (!/^ui:\s*true/m.test(frd)) continue;
  const mocks = `docs/frds/${dir}/mocks`;
  check(`${dir}: fdd.md`, nonEmpty(`docs/frds/${dir}/fdd.md`, 1000));
  check(`${dir}: mocks html + screenshots`, exists(mocks) && fs.readdirSync(mocks).some(f => f.endsWith(".html")) && exists(`${mocks}/screenshots`) && fs.readdirSync(`${mocks}/screenshots`).length > 0);
}
for (const [label, ok] of checks) console.log(`${ok ? "OK     " : "MISSING"} ${label}`);
const bad = checks.filter(([, ok]) => !ok).length;
console.log(bad ? `NOT READY: ${bad} missing` : "READY");
process.exit(bad ? 1 : 0);
