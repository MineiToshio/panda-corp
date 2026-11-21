#!/usr/bin/env node
// Codex `exec --output-schema` rejects a schema node that carries `const` or `enum` without `type`
// ("schema must specify a type", codex-cli 0.171). Every schema a worker may receive as its output
// schema must therefore type each const/enum node, or every Codex unit fails before it starts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS = path.join(HERE, "..", "runtime", "build", "schemas");
const OUTPUT_SCHEMAS = ["report", "review-report", "rescue-report", "doubt-answer"];

let passed = 0;
let failed = 0;
function untyped(node, at, out) {
  if (Array.isArray(node)) {
    node.forEach((child, i) => untyped(child, `${at}/${i}`, out));
    return out;
  }
  if (node && typeof node === "object") {
    if (("const" in node || "enum" in node) && !("type" in node)) out.push(at || "/");
    for (const [key, child] of Object.entries(node)) untyped(child, `${at}/${key}`, out);
  }
  return out;
}

for (const name of OUTPUT_SCHEMAS) {
  const schema = JSON.parse(readFileSync(path.join(SCHEMAS, `${name}.schema.json`), "utf8"));
  const missing = untyped(schema, "", []);
  if (missing.length === 0) {
    passed += 1;
    console.log(`PASS  ${name}.schema.json types every const/enum node`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}.schema.json has const/enum without type at: ${missing.join(", ")}`);
  }
}

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
