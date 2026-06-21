/**
 * frd-08-gate-opus.reviewer.test.tsx — FRD-08 gate (DR-072), reviewer (opus, DR-015)
 *
 * Adversarial edges the WO-08-002 implementer tests did not see, anchored to the
 * FRD-08 EARS contract and to the SPECIFIC defect classes that rejected this WO
 * before (reopen_count 1):
 *
 *   1. The DR-046/DR-057 reuse VIOLATION (prior reject) — the Manual Referencia
 *      forked its own flat ul/li catalogs (reference-command-NN, reference-rules-view)
 *      instead of reusing the FRD-07 cards. This gate closes the NEGATIVE: the
 *      reference branch renders the ONE shared primitive AND carries NO forked
 *      catalog testid. (frd-08-reuse.gate.reviewer asserts the POSITIVE presence;
 *      this asserts the fork is GONE — both directions, so re-forking goes RED.)
 *
 *   2. DR-046 currency THROUGH the reuse path — a skill that exists ONLY in the
 *      readers (never in any Manual file) must reach the reader via the REUSED
 *      SkillsSection card. This is the contract's reason to derive+reuse rather
 *      than hand-copy. (The integration test proves rule REMOVAL re-derives; this
 *      proves an ARBITRARY skill flows through the reused card with a unique slug
 *      the Manual never names — so a hand-copied list could never satisfy it.)
 *
 *   3. The empty-pane-on-load fix (this cycle's structural change) — robustness:
 *      the Diátaxis PRIORITY fallback (tutorial → guides → concepts) must fire
 *      when the tutorial bucket is empty, and the FIRST page by `order` must win
 *      even when the input array is out of order (a hand-rolled "[0]" would pick
 *      the wrong page). Empty content tree must NOT throw and must show the empty
 *      state, never a blank crash.
 *
 *   4. DR-062 cohesion — exactly ONE H1, text "Documentación", never "Manual"/"Códice"
 *      as the surface NAME (códice tolerated only as subtitle flavor).
 *
 * Drives the REAL ManualShell + DocReader (no lib mock for the components under
 * test) with controlled props, exercising WO-08-002 together with the FRD-07
 * primitives it reuses.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManualPage } from "@/lib/manual/manual";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";
import { DocReader } from "../DocReader";
import { ManualShell } from "../ManualShell";

// react-markdown is ESM-heavy; stub to the raw body so we can assert it reaches the reader.
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="md-out">{children}</div>,
}));

afterEach(cleanup);

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

function mkSkill(
  slug: string,
  description: string,
  runsIn: SkillRef["runsIn"] = "factory",
): SkillRef {
  return { slug, description, runsIn, body: "" };
}

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

function shellProps(
  pages: ManualPage[],
  skills: SkillRef[] = [mkSkill("spec", "Crear el proyecto.")],
) {
  return { pages, skills, agents: AGENTS, rules: RULES, standards: STANDARDS };
}

// --------------------------------------------------------------------------
// 1. Reuse NEGATIVE — the forked catalog is GONE (the prior-reject defect class)
// --------------------------------------------------------------------------

describe("FRD-08 reuse NEGATIVE — the Referencia renders the shared primitive, not a fork (DR-046/DR-057)", () => {
  const ALL_FORK_TESTIDS = [
    "reference-commands-section",
    "reference-agents-section",
    "reference-rules-view",
    "reference-standards-view",
  ];

  it("commands catalog reuses SkillsSection and renders NO forked reference-* catalog", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "commands" }}
        skills={[mkSkill("spec", "Crear."), mkSkill("implement", "Construir.")]}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    // POSITIVE: the ONE shared skill card.
    expect(screen.getByTestId("skill-card-spec")).toBeInTheDocument();
    // NEGATIVE: none of the forked catalog containers exist anywhere.
    for (const id of ALL_FORK_TESTIDS) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    // NEGATIVE: no per-row forked command testid (reference-command-0, ...).
    expect(screen.queryByTestId("reference-command-0")).toBeNull();
  });

  it("each of the four catalogs renders its canonical FRD-07 primitive testid", () => {
    // commands → skill-card-*
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "commands" }}
        {...shellProps([])}
        skills={[mkSkill("spec", "x")]}
      />,
    );
    expect(screen.getByTestId("skill-card-spec")).toBeInTheDocument();
    cleanup();
    // agents → agent-card
    render(<DocReader activePage={{ type: "reference", catalog: "agents" }} {...shellProps([])} />);
    expect(screen.getAllByTestId("agent-card").length).toBeGreaterThan(0);
    cleanup();
    // rules → rules-section / rules-list
    render(<DocReader activePage={{ type: "reference", catalog: "rules" }} {...shellProps([])} />);
    expect(
      screen.queryByTestId("rules-section") ?? screen.queryByTestId("rules-list"),
    ).not.toBeNull();
    cleanup();
    // standards → standards-section
    render(
      <DocReader activePage={{ type: "reference", catalog: "standards" }} {...shellProps([])} />,
    );
    expect(screen.getByTestId("standards-section")).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// 2. DR-046 currency THROUGH the reuse path — an arbitrary derived skill flows in
// --------------------------------------------------------------------------

describe("FRD-08 DR-046 — an arbitrary skill the Manual never names reaches the reused card", () => {
  it("a skill present only in the readers surfaces as a shared skill-card (could not be hand-copied)", () => {
    // A slug the Manual files never mention — proves derivation+reuse, not a static list.
    const ghost = mkSkill("review-launch-zz9", "Auditar el lanzamiento.");
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "commands" }}
        skills={[ghost]}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    const card = screen.getByTestId("skill-card-review-launch-zz9");
    expect(card).toBeInTheDocument();
    expect(within(card).getByText(/Auditar el lanzamiento/)).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// 3. Empty-pane-on-load (this cycle) — priority fallback + order + empty tree
// --------------------------------------------------------------------------

describe("FRD-08 default page on load — deriveDefaultPage robustness (this cycle's fix)", () => {
  it("falls back to GUIDES when the tutorial bucket is empty (Diátaxis priority)", () => {
    const pages: ManualPage[] = [
      { group: "concepts", slug: "que-es", title: "Qué es", order: 1, body: "cuerpo-concepto" },
      { group: "guides", slug: "operar", title: "Cómo operas", order: 1, body: "cuerpo-guia" },
    ];
    render(<ManualShell {...shellProps(pages)} />);
    // No tutorial → first GUIDES page is active and rendered (not the concepts one).
    expect(screen.getByTestId("doc-reader-authored")).toBeInTheDocument();
    expect(screen.getByTestId("md-out")).toHaveTextContent("cuerpo-guia");
    expect(screen.getByTestId("doc-nav-item-guides-operar")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("doc-nav-item-concepts-que-es")).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("picks the lowest-`order` page even when the input array is out of order (not array[0])", () => {
    const pages: ManualPage[] = [
      { group: "tutorial", slug: "segundo", title: "Segundo", order: 5, body: "cuerpo-segundo" },
      { group: "tutorial", slug: "primero", title: "Primero", order: 1, body: "cuerpo-primero" },
    ];
    render(<ManualShell {...shellProps(pages)} />);
    // order:1 ("primero") wins even though it is array[1]; a naive pages[0] would pick "segundo".
    expect(screen.getByTestId("md-out")).toHaveTextContent("cuerpo-primero");
    expect(screen.getByTestId("doc-nav-item-tutorial-primero")).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("empty content tree shows the empty state and never throws (no blank crash)", () => {
    expect(() => render(<ManualShell {...shellProps([])} />)).not.toThrow();
    expect(screen.getByTestId("doc-reader-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("doc-reader-authored")).toBeNull();
  });

  it("selecting a Reference catalog from the nav swaps the reader to the reused card (integration)", () => {
    const pages: ManualPage[] = [
      {
        group: "tutorial",
        slug: "como-empezar",
        title: "Cómo empezar",
        order: 1,
        body: "cuerpo-inicio",
      },
    ];
    render(<ManualShell {...shellProps(pages)} />);
    // Starts on the authored tutorial page...
    expect(screen.getByTestId("doc-reader-authored")).toBeInTheDocument();
    // ...click the Comandos reference nav item → reader swaps to the shared SkillsSection card.
    fireEvent.click(screen.getByTestId("doc-nav-item-reference-commands"));
    expect(screen.getByTestId("doc-reader-reference")).toBeInTheDocument();
    expect(screen.getByTestId("skill-card-spec")).toBeInTheDocument();
    expect(screen.queryByTestId("doc-reader-authored")).toBeNull();
  });
});

// --------------------------------------------------------------------------
// 4. DR-062 cohesion — exactly ONE H1 "Documentación", never "Manual"/"Códice" as the name
// --------------------------------------------------------------------------

describe("FRD-08 DR-062 — canonical page title is 'Documentación', never 'Manual'/'Códice'", () => {
  it("the canonical page H1 is 'Documentación' and no H1 names the surface Manual/Códice", () => {
    const pages: ManualPage[] = [
      { group: "tutorial", slug: "como-empezar", title: "Cómo empezar", order: 1, body: "x" },
    ];
    render(<ManualShell {...shellProps(pages)} />);
    // The PageTitle block (DR-062) is the canonical page title.
    const title = screen.getByRole("heading", { level: 1, name: /documentaci[oó]n/i });
    expect(title).toBeInTheDocument();
    // The surface NAME (any H1) is never "Manual" or "Códice" (códice tolerated only as subtitle flavor).
    for (const h of screen.getAllByRole("heading", { level: 1 })) {
      const t = (h.textContent ?? "").toLowerCase();
      expect(t).not.toContain("manual");
      expect(t).not.toContain("códice");
    }
  });
});
