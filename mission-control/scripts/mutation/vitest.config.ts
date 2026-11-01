import { defineConfig } from "vitest/config";
import base from "../../vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      "src/lib/work-orders/_tests/{real-source-boundaries,published.mutation}.test.ts",
      "src/lib/spec/_tests/{read-artifacts,read-frds.mutation}.test.ts",
      "src/lib/changes/_tests/openChanges*.test.ts",
      "src/lib/architecture/_tests/{read-artifacts.reviewer,artifact-boundaries.mutation}.test.ts",
      "src/lib/fragua/_tests/scene-data.test.ts",
      "src/lib/portfolio/_tests/{overview-resolver,overview.integration,displayName}.test.ts",
      "src/lib/navigation/_tests/{canonicalHistory,useUrlState,navigationTransition,history.mutation,NavigationLink}.test.tsx",
      "src/lib/pitch/_tests/proposalSummary.test.ts",
      "src/app/achievements/_utils/_tests/*.test.ts",
      "src/components/core/Chip/_tests/stackOrder.test.ts",
      "src/components/modules/DataModelViewer/_tests/{layout,layout.reviewer,layout.ux.reviewer,hostile-ids.reviewer}.test.ts",
      "src/components/modules/DataModelViewer/_tests/{viewport,viewport.mutation,usability.reviewer}.test.tsx",
    ],
    maxWorkers: 1,
  },
});
