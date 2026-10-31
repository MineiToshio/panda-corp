import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { loadWorkspaceProject } from "../../../_panels/workspaceProject";
import { workspaceSelection } from "../../../workspace-route";

/** Temporary project sources, with file-by-file managed-state cleanup. */
export function summaryFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resumen-"));
  const projectPath = path.join(root, "folder-name");
  const write = (relative: string, content: string) => {
    const file = path.join(projectPath, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  write("docs/frds/frd-01-reading/frd.md", "# FRD-01 — Reading\n");
  write(
    "docs/frds/frd-01-reading/work-orders/wo-01-001-reading.md",
    "---\nimplementation_status: PLANNED\n---\n# WO-01-001 — Read live files\n",
  );
  write(".pandacorp/status.yaml", "project: Display Name\nphase: implementation\nrunning: false\n");
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  vi.stubEnv("PANDACORP_EVENTS_FILE", path.join(root, "events.ndjson"));
  vi.stubEnv("PANDACORP_CODEX_EVENTS_FILE", path.join(root, "codex-events.ndjson"));
  vi.stubEnv("MC_CLOCK", "2026-10-31T12:00:00Z");
  const item: ProjectListItem = {
    name: "Display Name",
    path: projectPath,
    exists: true,
    stage: "implementation",
    running: false,
    status: {
      present: true,
      malformed: false,
      status: { project: "Display Name", phase: "implementation", running: false },
    },
  };
  const route = {
    ...workspaceSelection({ tab: "summary" }),
    navigationBaseHref: "/projects/display-name/summary",
    state: { project: "display-name", tab: "summary" },
  };
  function project() {
    return loadWorkspaceProject(item);
  }
  function cleanup(directory = root): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) cleanup(file);
      else fs.unlinkSync(file);
    }
  }
  return { root, item, write, project, route, cleanup };
}
