import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function valueImports(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  return source.statements.flatMap((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return [];
    const clause = node.importClause;
    if (clause?.isTypeOnly) return [];
    const bindings = clause?.namedBindings;
    if (
      bindings &&
      ts.isNamedImports(bindings) &&
      !clause.name &&
      bindings.elements.every((entry) => entry.isTypeOnly)
    )
      return [];
    return [node.moduleSpecifier.text];
  });
}
function localModule(file: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return undefined;
  const base = specifier.startsWith("@/")
    ? path.resolve("src", specifier.slice(2))
    : path.resolve(path.dirname(file), specifier);
  return [`${base}.ts`, `${base}.tsx`].find((candidate) => fs.existsSync(candidate));
}

it("StatisticsTab's entire value-import graph stays free of Node built-ins", () => {
  const seen = new Set<string>();
  const violations: string[] = [];
  const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));
  function visit(file: string): void {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of valueImports(file)) {
      if (specifier.startsWith("node:") || builtins.has(specifier)) {
        violations.push(`${path.relative(process.cwd(), file)} -> ${specifier}`);
        continue;
      }
      const target = localModule(file, specifier);
      if (target) visit(target);
    }
  }
  visit(path.resolve("src/app/achievements/_components/Stats/StatisticsTab.tsx"));
  expect(violations).toEqual([]);
});
