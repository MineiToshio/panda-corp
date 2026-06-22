/**
 * app/manual/_tests/manual.reviewer.integration.test.tsx — FRD-08 reviewer (Opus, DR-015)
 *
 * Adversarial INTEGRATION gate for FRD-08 (the Manual / "Códice del gremio").
 * Exercises WO-08-001..005 TOGETHER through the REAL page.tsx — the surface the
 * owner actually loads — NOT each component in isolation. The per-WO suites pass
 * components mock data directly; that can hide an orphaned component (the exact
 * bug class that sank FRD-03 and FRD-10: BusinessSnapshot / RecoveryHint /
 * ChainCard built + tested but never mounted by the page). Here we drive the
 * whole derivation chain end-to-end:
 *
 *   page.tsx (real readers) → ManualShell → DocNav (select) → DocReader →
 *   Reference{Commands,Agents,Rules,Standards} components
 *
 * against a real on-disk fixture factory tree, with NO mock of the lib/ data layer.
 * That is the only way to prove DR-046: a skill/agent/rule/standard defined ONLY
 * in the factory appears in the Manual's Reference with zero edits to any Manual
 * file, and renaming it in the factory renames it in the Manual.
 *
 * Traceability: AC-08-001.* / AC-08-002.* / AC-08-003.* / AC-08-004.* / AC-08-005.*
 *               DR-046 (derived, not hand-copied).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ManualPage from "../page";

// react-markdown is ESM-heavy; stub it (we assert the body text reaches the reader,
// not the markdown renderer's internals).
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown-output">{children}</div>
  ),
}));

// next/navigation guard (DocNav/CopyButton ecosystem may touch it).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/manual",
  useSearchParams: () => new URLSearchParams(),
}));

// --------------------------------------------------------------------------
// A self-contained, mutable fixture factory tree (plugin + factory/*).
// Each test gets a fresh tree so the DR-046 "rename" test can mutate it.
// --------------------------------------------------------------------------

let factoryRoot: string;
let priorEnv: string | undefined;

function writeFile(rel: string, contents: string): void {
  const abs = path.join(factoryRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents, "utf-8");
}

function seedSkill(slug: string, description: string): void {
  writeFile(
    `plugin/skills/${slug}/SKILL.md`,
    `---\ndescription: ${description}\n---\n# /pandacorp:${slug}\n\nRun inside the factory.\n`,
  );
}

function seedAgent(id: string, name: string, model: string, description: string): void {
  writeFile(
    `plugin/agents/${id}.md`,
    `---\nname: ${name}\nmodel: ${model}\ndescription: ${description}\n---\n# ${name}\n`,
  );
}

function seedRegistry(): void {
  writeFile(
    "factory/decisions/registry.yaml",
    [
      "decisiones:",
      "  - id: DR-XEDGE-AUTO",
      "    patron: una decision recurrente trivial",
      "    default: auto-aprobado por defecto",
      "    requiere_humano: false",
      "    nota: nota de prueba del revisor",
      "  - id: DR-XEDGE-HUMAN",
      "    patron: gastar dinero o desplegar a produccion",
      "    default: siempre pregunta al owner",
      "    requiere_humano: true",
      "",
    ].join("\n"),
  );
}

function seedStandards(): void {
  writeFile(
    "factory/standards/conventions.md",
    "---\ndomain: code\nseverity: must\nenforcement: ci\n---\n# Conventions\n\n- English code, Spanish chat.\n",
  );
  // DR-049 currency: structure.md must surface in the standards Reference (AC-08-004.4).
  writeFile(
    "factory/standards/structure.md",
    "---\ndomain: structure\nseverity: must\nenforcement: review\n---\n# Structure\n\n- Feature-centric docs/frds/frd-NN-<slug>/.\n",
  );
  writeFile("factory/standards/README.md", "# Standards index (must be skipped)\n");
}

function seedFullFactory(): void {
  seedSkill("spec", "Documenta el MVP de una idea (handoff).");
  seedSkill("implement", "Arranca la construccion con el workflow dinamico.");
  // A malformed skill (no description) MUST be skipped end-to-end (AC-08-003 / AC-07-001.2).
  writeFile("plugin/skills/no-desc/SKILL.md", "---\nfoo: bar\n---\n# /pandacorp:no-desc\n");
  seedAgent("reviewer", "Reviewer", "opus", "Revisa la feature en el gate de FRD.");
  seedAgent("implementer", "Implementer", "sonnet", "Construye una work order con TDD.");
  seedRegistry();
  seedStandards();
}

beforeEach(() => {
  factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "frd08-review-"));
  priorEnv = process.env.PANDACORP_FACTORY_ROOT;
  process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
});

afterEach(() => {
  cleanup();
  if (priorEnv === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
  else process.env.PANDACORP_FACTORY_ROOT = priorEnv;
  try {
    fs.rmSync(factoryRoot, { recursive: true, force: true });
  } catch {
    /* best-effort temp cleanup */
  }
});

/** Render the real Server Component page (it calls the real readers synchronously). */
function renderManual(): void {
  render(ManualPage());
}

/** Click a DocNav item by its data-testid. */
function selectNav(testid: string): void {
  fireEvent.click(screen.getByTestId(testid));
}

describe("FRD-08 reviewer — Manual derivation integration (DR-046, anti-orphan)", () => {
  it("AC-08-002.1/.2 — the page mounts shell + nav + reader and renders the Reference group", () => {
    seedFullFactory();
    renderManual();

    expect(screen.getByTestId("manual-page")).toBeTruthy();
    expect(screen.getByTestId("manual-shell")).toBeTruthy();
    expect(screen.getByTestId("doc-nav")).toBeTruthy();
    expect(screen.getByTestId("doc-reader")).toBeTruthy();
    // The four Reference catalog entries must be reachable from the nav.
    expect(screen.getByTestId("doc-nav-item-reference-commands")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-item-reference-agents")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-item-reference-rules")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-item-reference-standards")).toBeTruthy();
  });

  it("AC-08-003.1/.4 — commands catalog is DERIVED end-to-end: a skill defined only in the factory appears in the reader", () => {
    seedFullFactory();
    renderManual();
    // Anti-orphan: the catalog must NOT show before selection (reader starts empty).
    expect(screen.queryByTestId("skills-section")).toBeNull();

    selectNav("doc-nav-item-reference-commands");

    // Reuses the FRD-07 SkillsSection → SkillList (skills-section / skill-card-<slug>).
    const section = screen.getByTestId("skills-section");
    expect(within(section).getByText("/pandacorp:spec")).toBeTruthy();
    expect(within(section).getByText("/pandacorp:implement")).toBeTruthy();
    // Malformed skill (no description) is skipped end-to-end — never reaches the user.
    expect(screen.queryByTestId("skill-card-no-desc")).toBeNull();
  });

  it("AC-08-003.3 (DR-046 swap) — renaming a skill dir in the factory renames it in the Manual, with ZERO Manual file edits", () => {
    // Initial render with a skill named "old-spec".
    seedSkill("old-spec", "Comando original.");
    seedAgent("reviewer", "Reviewer", "opus", "x");
    seedRegistry();
    seedStandards();
    renderManual();
    selectNav("doc-nav-item-reference-commands");
    expect(screen.getByText("/pandacorp:old-spec")).toBeTruthy();
    cleanup();

    // Rename the skill DIRECTORY in the factory (no Manual file touched).
    fs.renameSync(
      path.join(factoryRoot, "plugin/skills/old-spec"),
      path.join(factoryRoot, "plugin/skills/new-spec"),
    );

    renderManual();
    selectNav("doc-nav-item-reference-commands");
    expect(screen.getByText("/pandacorp:new-spec")).toBeTruthy();
    expect(screen.queryByText("/pandacorp:old-spec")).toBeNull();
  });

  it("AC-08-003.2 — agents catalog is derived end-to-end with name + model badge", () => {
    seedFullFactory();
    renderManual();
    selectNav("doc-nav-item-reference-agents");

    // Reuses the FRD-07 AgentList (agent-list / agent-card / agent-model-chip).
    const section = screen.getByTestId("agent-list");
    expect(within(section).getByText("Reviewer")).toBeTruthy();
    expect(within(section).getByText("Implementer")).toBeTruthy();
    // Model surfaced as a labelled badge (not color alone).
    expect(within(section).getByText("opus")).toBeTruthy();
    expect(within(section).getByText("sonnet")).toBeTruthy();
  });

  it("AC-08-004.1 — decision rules are derived end-to-end; requiereHumano is a TEXT label, not color alone", () => {
    seedFullFactory();
    renderManual();
    selectNav("doc-nav-item-reference-rules");

    // Reuses the FRD-07 DecisionRulesSection (rules-section / rule-item-<id>).
    const view = screen.getByTestId("rules-section");
    expect(within(view).getByTestId("rule-item-DR-XEDGE-AUTO")).toBeTruthy();
    expect(within(view).getByTestId("rule-item-DR-XEDGE-HUMAN")).toBeTruthy();

    // The human-gate rule must carry a readable text indicator + data attribute
    // (state never by color alone): the shared indicator pairs a dot + a label.
    const humanIndicator = screen.getByTestId("rule-indicator-DR-XEDGE-HUMAN");
    expect(humanIndicator.textContent).toContain("Te consulta");
    expect(humanIndicator.getAttribute("data-indicator")).toBe("human");

    const autoIndicator = screen.getByTestId("rule-indicator-DR-XEDGE-AUTO");
    expect(autoIndicator.textContent).toContain("Auto-aprueba");
    expect(autoIndicator.getAttribute("data-indicator")).toBe("auto");
  });

  it("AC-08-004.2/.4 — standards are derived end-to-end; structure.md (DR-049) surfaces; README.md is skipped", () => {
    seedFullFactory();
    renderManual();
    selectNav("doc-nav-item-reference-standards");

    // Reuses the FRD-07 StandardsSection (standards-section / standard-item-<id>).
    const view = screen.getByTestId("standards-section");
    // structure.md (DR-049 currency) flows through the same uniform loop.
    // The standards reader ids entries by filename (incl. extension).
    expect(within(view).getByTestId("standard-item-structure.md")).toBeTruthy();
    expect(within(view).getByTestId("standard-item-conventions.md")).toBeTruthy();
    // README.md must NOT become a standard entry.
    expect(screen.queryByTestId("standard-item-README.md")).toBeNull();
  });

  it("AC-08-004.3 (DR-046 swap) — removing a rule from the registry removes it from the Manual with no Manual edit", () => {
    seedFullFactory();
    renderManual();
    selectNav("doc-nav-item-reference-rules");
    expect(screen.getByTestId("rule-item-DR-XEDGE-HUMAN")).toBeTruthy();
    cleanup();

    // Drop one rule from the registry (factory-only change).
    writeFile(
      "factory/decisions/registry.yaml",
      "decisiones:\n  - id: DR-XEDGE-AUTO\n    patron: p\n    default: d\n    requiere_humano: false\n",
    );

    renderManual();
    selectNav("doc-nav-item-reference-rules");
    expect(screen.getByTestId("rule-item-DR-XEDGE-AUTO")).toBeTruthy();
    expect(screen.queryByTestId("rule-item-DR-XEDGE-HUMAN")).toBeNull();
  });

  it("AC-08-001/.005 — authored content pages reach the reader: selecting one renders its body", () => {
    seedFullFactory();
    renderManual();

    // The real content/manual/ tree is read via process.cwd(); at least one authored
    // page must exist and be selectable (the no-context reader requirement).
    const tutorialGroup = screen.getByTestId("doc-nav-group-tutorial");
    const firstAuthored = within(tutorialGroup).queryAllByRole("button")[0];
    expect(firstAuthored).toBeTruthy();
    if (!firstAuthored) return;

    fireEvent.click(firstAuthored);
    const authored = screen.getByTestId("doc-reader-authored");
    // The page content must have flowed into the reader (non-empty), proving the
    // readManualPages → ManualShell → DocReader chain is wired. The reader renders
    // either a bespoke React page (the repaint, prototype-faithful composed UI) or,
    // for an unmapped slug, the react-markdown fallback — both surface the content.
    expect((authored.textContent ?? "").trim().length).toBeGreaterThan(0);
    expect(within(authored).getAllByRole("heading").length).toBeGreaterThan(0);
  });

  it("empty-factory resilience — no skills/agents/rules/standards => reader shows empty states, never throws", () => {
    // Intentionally seed NOTHING (empty factory tree). All readers return [].
    renderManual();

    selectNav("doc-nav-item-reference-commands");
    // Shared SkillList honest empty state.
    expect(screen.getByTestId("skill-list-empty")).toBeTruthy();
    cleanup();

    renderManual();
    selectNav("doc-nav-item-reference-rules");
    // Shared DecisionRulesSection honest empty state.
    expect(screen.getByTestId("rules-empty")).toBeTruthy();
  });
});
