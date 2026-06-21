/**
 * frd-08-reuse.gate.reviewer.test.tsx — FRD-08 gate (DR-072), reviewer (opus)
 *
 * ANCHOR TEST for the blocking CORRECTION finding on WO-08-002.
 *
 * FRD-08 contract (frd.md AC) + WO-08-002 Scope are EXPLICIT:
 *   "The Reference catalogs SHALL **reuse the Configuración (FRD-07) card
 *    components** — the same skill / agent / rule / standard card, grid and
 *    detail surfaces — rather than re-implementing them, so the two surfaces
 *    stay visually and behaviorally consistent."
 *   WO-08-002 Scope: "Referencia (RefSection) — REUSES Configuración's
 *    SkillCard/AgentCard/RuleCard/StandardCard + the shared detail VERBATIM
 *    (do NOT fork them)."
 *   Inventory docs/design/components.md:104-107,142-143 — the Manual Referencia
 *    reuses Config's SkillCard/AgentCard/RuleCard/StandardCard verbatim.
 *
 * This is the same DR-057/DR-046 defect class that rejected FRD-05/07/10:
 * the Manual's DocReader forks its own flat ul/li catalog rows
 * (reference-command-NN, reference-agent-NN, reference-rules-view,
 *  reference-standards-view) with private styles instead of rendering the ONE
 * shared FRD-07 card primitives.
 *
 * The canonical FRD-07 card primitives stamp these testids:
 *   - SkillList   → skill-card-<slug>          (Panel + ItemSlot wand tile)
 *   - AgentList   → agent-card                 (pixel avatar + model chip)
 *   - DecisionRulesSection → rules-list / rules-section
 *   - StandardsSection     → standards-section
 *
 * A correct implementation that REUSES the FRD-07 cards makes these pass.
 * The current fork renders NONE of them → these tests are RED, proving the
 * violation. (Mutation-killing: swap the fork for the real SkillList/AgentList/
 * DecisionRulesSection/StandardsSection and every assertion below goes green.)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";
import { DocReader } from "../DocReader";

const SKILLS: SkillRef[] = [
  {
    slug: "spec",
    description: "Crear el proyecto y documentar el MVP.",
    runsIn: "factory",
    body: "",
  },
  { slug: "implement", description: "Arrancar la construcción.", runsIn: "project", body: "" },
];

const AGENTS: AgentRef[] = [
  { id: "reviewer", name: "Reviewer", description: "Gate de revisión.", model: "opus", body: "" },
];

const RULES: DecisionRule[] = [
  {
    id: "DR-046",
    patron: "Referencia derivada",
    default: "derivar de la fábrica",
    requiereHumano: false,
  },
];

const STANDARDS: Standard[] = [
  {
    id: "structure",
    title: "Project structure",
    body: "src/ es obligatorio.",
    domain: "Architecture",
    severity: "MUST",
    enforcement: "review",
    summary: ["src/ es obligatorio."],
  },
];

function renderCatalog(catalog: "commands" | "agents" | "rules" | "standards") {
  return render(
    <DocReader
      activePage={{ type: "reference", catalog }}
      skills={SKILLS}
      agents={AGENTS}
      rules={RULES}
      standards={STANDARDS}
    />,
  );
}

describe("FRD-08 Referencia reuses the FRD-07 card primitives (DR-046/DR-057)", () => {
  it("commands catalog renders the shared SkillCard primitive (skill-card-<slug>), not a forked list", () => {
    renderCatalog("commands");
    // The ONE shared skill card (SkillList → SkillCard) stamps skill-card-<slug>.
    expect(screen.getByTestId("skill-card-spec")).toBeInTheDocument();
    expect(screen.getByTestId("skill-card-implement")).toBeInTheDocument();
  });

  it("agents catalog renders the shared AgentCard primitive (agent-card), not a forked list", () => {
    renderCatalog("agents");
    expect(screen.getAllByTestId("agent-card").length).toBeGreaterThan(0);
  });

  it("rules catalog renders the shared DecisionRulesSection primitive (rules-list/rules-section)", () => {
    renderCatalog("rules");
    const viaSection = screen.queryByTestId("rules-section");
    const viaList = screen.queryByTestId("rules-list");
    expect(viaSection ?? viaList).not.toBeNull();
  });

  it("standards catalog renders the shared StandardsSection primitive (standards-section)", () => {
    renderCatalog("standards");
    expect(screen.getByTestId("standards-section")).toBeInTheDocument();
  });
});
