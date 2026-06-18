// ESLint runs ONLY the test-discipline checks Biome cannot do (eslint-plugin-testing-library).
// Biome owns formatting + all general lint; madge owns circular-dependency detection
// (see verify.sh). Run on demand with `pnpm lint:eslint` — these surface as warnings
// (existing test-suite debt: query-by-role over container/node access).
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import testingLibrary from "eslint-plugin-testing-library";

export default [
  {
    ignores: ["node_modules/**", ".next/**", "prototype/**", "coverage/**", "**/*.js", "**/*.cjs"],
  },
  {
    // Register @typescript-eslint so pre-existing inline `eslint-disable @typescript-eslint/*`
    // directives resolve to a known (disabled) rule instead of erroring. No rules enabled —
    // Biome owns those checks.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { "@typescript-eslint": tsPlugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
  },
  {
    // testing-library discipline on test files (quality-and-testing.md).
    files: ["**/_tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    plugins: { "testing-library": testingLibrary },
    rules: {
      "testing-library/no-container": "warn",
      "testing-library/no-node-access": "warn",
      "testing-library/prefer-screen-queries": "warn",
      "testing-library/no-dom-import": ["warn", "react"],
    },
  },
];
