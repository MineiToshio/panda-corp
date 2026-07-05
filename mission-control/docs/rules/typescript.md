---
description: TypeScript idioms beyond strict mode — type-only imports, satisfies, discriminated unions, no unsafe assertions, const maps, readonly.
applies_when: typescript
globs: ["**/*.ts", "**/*.tsx"]
source: Pandacorp stack — TypeScript
---

# TypeScript

(Strict mode, `unknown` over `any`, explicit return types — see `code-conventions`. Mechanical rules — `noExplicitAny`, `useImportType`, tsc strict — are enforced by the canonical `biome.json` + `tsc`; fix the gate's message, don't argue with it.)

- **`satisfies` over annotation/`as`** for config objects, token maps and lookup tables — type-checking *and* preserved literal inference.
- **Model exclusive states as discriminated unions** (literal `kind`/`status` tag); make switches **exhaustive** with a `never` default (`const _exhaustive: never = x`). Illegal states unrepresentable — pairs with React's "derive, don't sync".
- **Avoid type assertions (`as`)** except at trust boundaries (parsed JSON, narrowing `unknown`); **never `as any`, never double-assert**. Coerce `unknown` with a type guard or schema (Zod), not a cast.
- **Prefer `as const` object maps over `enum`** (enums emit runtime code; const maps + a derived union are tree-shakeable and literal-precise). String enums only where a nominal type is genuinely needed.
- **Mark intent-immutable data `readonly`** (`readonly T[]`, readonly props, frozen config).
- **Parse, don't validate at read boundaries (DR-078)**: a reader returns a typed value or an **explicit error** (throw or `Result`/discriminated union) — never a silent `[]`/`null` on an unrecognised shape. Model never-empty collections as `NonEmpty`; test readers against a real AND a malformed fixture.
