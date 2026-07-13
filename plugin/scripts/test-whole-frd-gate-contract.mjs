#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const read = (file) => readFile(path.join(root, file), "utf8");

const [reviewer, engine, codex, implementSkill, quality, manual] =
	await Promise.all([
		read("plugin/agents/reviewer.md"),
		read("plugin/templates/shared/.claude/engines/pandacorp-build.js"),
		read("plugin/runtime/codex/executor.mjs"),
		read("plugin/skills/implement/SKILL.md"),
		read("factory/standards/quality.md"),
		read("mission-control/src/lib/manual/workflow-flows.ts"),
	]);

const requiredClasses = [
	"requirements",
	"acceptance criteria",
	"invariants",
	"edge cases",
	"limits",
	"errors",
	"exclusions",
];
for (const source of [reviewer, engine]) {
	for (const contractClass of requiredClasses) {
		assert.match(
			source.toLowerCase(),
			new RegExp(contractClass.replace(" ", "\\s+")),
			`${contractClass} must be explicit in every runtime gate prompt`,
		);
	}
	assert.match(
		source,
		/numbered ACs?[^\n]{0,180}(?:do not|never|may not|cannot)[^\n]{0,120}(?:waive|override|dismiss)|(?:do not|never|may not|cannot)[^\n]{0,120}(?:waive|override|dismiss)[^\n]{0,180}numbered ACs?/i,
		"numbered AC success must never waive another normative FRD clause",
	);
	assert.match(source, /traceability/i, "the verdict must record traceability");
}
assert.match(engine, /function enforceWholeFrdTraceability/);
assert.match(engine, /waivedFailure/);

assert.match(codex, /reviewerSource\.match\(\/<!-- WHOLE_FRD_ORACLE_START/);
assert.match(
	codex,
	/prompt: `Independently review \$\{frd\}[\s\S]*?\$\{wholeFrdOracle\}/,
);
assert.match(codex, /validateReviewResult/);
assert.match(codex, /review verdict lacks whole-FRD traceability inventory/);
assert.match(
	codex,
	/review verdict contradicts whole-FRD traceability or lacks boundary evidence/,
);

assert.match(implementSkill, /whole FRD/i);
assert.match(quality, /whole FRD/i);
assert.match(manual, /contrato completo/);
assert.match(manual, /trazabilidad contrato→prueba/);
assert.match(manual, /AC verde nunca/);

// R10-I regression: all numbered ACs pass, but the separate Edge cases clause fails.
// The contract must make this verdict RED and must require a boundary-test reference.
const fixture = {
	numberedAcceptanceCriteria: [
		{ id: "AC-1", status: "pass" },
		{ id: "AC-2", status: "pass" },
	],
	normativeClauses: [
		{ id: "EDGE-safe-integer", class: "edge", status: "fail", tests: [] },
	],
};
const gateGreen =
	fixture.numberedAcceptanceCriteria.every(({ status }) => status === "pass") &&
	fixture.normativeClauses.every(
		({ status, tests }) => status === "pass" && tests.length > 0,
	);
assert.equal(
	gateGreen,
	false,
	"a failed unsafe-integer edge must reject the FRD even when every numbered AC passes",
);

console.log("OK: whole-FRD gate contract and unsafe-integer regression");
