---
description: TypeScript idioms beyond strict mode — type-only imports, satisfies, discriminated unions, no unsafe assertions, const maps, readonly.
applies_when: typescript
globs: ["**/*.ts", "**/*.tsx"]
source: Pandacorp stack — TypeScript
---

# TypeScript

(Strict mode, `unknown` over `any`, no `@ts-ignore`, explicit return types — see `code-conventions`. This file is the idiom layer on top.)

- **Type-only imports/exports** use `import type` / `export type` (no accidental runtime import; required by `verbatimModuleSyntax`). (lint: `@typescript-eslint/consistent-type-imports`, autofix)
- **`satisfies` over annotation/`as`** for config objects, token maps and lookup tables — you get type-checking *and* preserved literal inference.
- **Model exclusive states as discriminated unions** (tagged by a literal `kind`/`status`) and make switches **exhaustive** with a `never` default (`const _exhaustive: never = x`). Makes illegal states unrepresentable — pairs with React's "derive, don't sync". (lint: `@typescript-eslint/switch-exhaustiveness-check`)
- **Avoid type assertions (`as`)** except at trust boundaries (parsed JSON, narrowing `unknown`); **never `as any`, never double-assert**. Coerce `unknown` with a type guard or schema (Zod), not a cast.
- **Prefer `as const` object maps over `enum`** (enums emit runtime code and have iteration/nominal quirks; const maps + a derived union are tree-shakeable and literal-precise). String enums are tolerated where a nominal type is genuinely needed.
- **Mark intent-immutable data `readonly`** (`readonly T[]`, readonly props, frozen config).
