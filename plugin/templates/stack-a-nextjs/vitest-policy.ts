// Managed VERBATIM as .pandacorp/vitest-policy.ts (DR-159). Config stays project-owned.
import type { ViteUserConfig as UserConfig } from "vitest/config";

export function pandacorpVitest(
  config: UserConfig = {},
  {
    dom = [],
    domSetupFiles = [],
    defaultMaxWorkers,
  }: { dom?: string[]; domSetupFiles?: string[]; defaultMaxWorkers?: number } = {},
): UserConfig {
  const { test = {}, ...shared } = config;
  if (test.projects !== undefined) {
    throw new Error("Migrate existing Vitest projects explicitly before adopting pandacorpVitest");
  }
  const configured = process.env.PANDACORP_VITEST_MAX_WORKERS;
  if (configured !== undefined && !/^[1-9]\d*$/.test(configured)) {
    throw new Error("PANDACORP_VITEST_MAX_WORKERS must be a positive integer");
  }
  const maxWorkers = configured === undefined ? defaultMaxWorkers : Number(configured);
  if (maxWorkers !== undefined && (!Number.isSafeInteger(maxWorkers) || maxWorkers < 1)) {
    throw new Error("Vitest maxWorkers must be a positive safe integer");
  }
  // Vitest 4+ native defaults; retain the project's explicit selection when present.
  const include = test.include ?? ["**/*.{test,spec}.?(c|m)[jt]s?(x)"];
  const exclude = test.exclude ?? ["**/node_modules/**", "**/.git/**"];
  const setup =
    test.setupFiles === undefined
      ? []
      : typeof test.setupFiles === "string"
        ? [test.setupFiles]
        : test.setupFiles;
  // Never extends:true: Vitest concatenates include AND globalSetup arrays, causing
  // duplicate tests/setup. Explicitly share config while keeping root globalSetup once.
  const project = (
    name: string,
    environment: "node" | "jsdom",
    selection: string[],
    ignored: string[],
    setupFiles: string[],
  ) => ({
    ...shared,
    test: {
      ...test,
      name,
      environment,
      isolate: true,
      include: selection,
      exclude: ignored,
      projects: undefined,
      // One root budget, including the env override; project caps otherwise take precedence.
      maxWorkers: undefined,
      globalSetup: [],
      setupFiles,
    },
  });
  return {
    ...shared,
    test: {
      ...test,
      include: [],
      environment: "node",
      isolate: true,
      ...(maxWorkers === undefined ? {} : { maxWorkers }),
      projects: [
        project("node", "node", include, [...exclude, ...dom], setup),
        ...(dom.length
          ? [project("dom", "jsdom", dom, exclude, [...setup, ...domSetupFiles])]
          : []),
      ],
    },
  };
}
