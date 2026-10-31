/**
 * FRD-18 reviewer integration tests (DR-015, DR-080), rewritten for the v2 Inicio.
 *
 * Exercises the Inicio resolvers and surfaces together, through their public API, on the
 * edges the implementer's suite did not assert: real-shaped decision files, the seven-day
 * boundaries, the launch bridge, and the honest-calm invariant.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TuTurno } from "@/components/dashboard/TuTurno/TuTurno";
import { Pulso } from "@/components/modules/Pulso/Pulso";
import { deriveColumn } from "@/lib/board/board";
import { parseDecisionBlocks } from "@/lib/docs/activity";
import { countLaunched, type IdeaCard } from "@/lib/ideas/ideas";
import { selectLastAchievement } from "@/lib/inicio/achievement";
import { deriveFlightGroups } from "@/lib/inicio/flight";
import { deriveIdeaFunnel } from "@/lib/inicio/funnel";
import { readProjectInbox } from "@/lib/inicio/inbox";
import { pulseTiles } from "@/lib/inicio/pulse";
import { deriveOwnerTurn, type OwnerTurnItem } from "@/lib/inicio/turn";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";
import { EnMarchaCard } from "../_components/EnMarchaCard";

const NOW = "2026-10-30T12:00:00Z";
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "frd-18-reviewer-"));
  fs.mkdirSync(path.join(root, ".pandacorp/inbox/changes"), { recursive: true });
});
afterEach(() => {
  cleanup();
  fs.rmSync(root, { recursive: true, force: true });
});

function decisions(content: string): void {
  fs.writeFileSync(path.join(root, ".pandacorp/inbox/decisions.md"), content);
}
function queued(name: string, status: string): void {
  fs.writeFileSync(
    path.join(root, ".pandacorp/inbox/changes", `${name}.md`),
    `---\ntype: change\nstatus: ${status}\ndate: '2026-10-20'\n---\n# ${name}\nBody.`,
  );
}
function inbox() {
  return readProjectInbox({ name: "Example", id: "example", path: root });
}
function turnItem(overrides: Partial<OwnerTurnItem>): OwnerTurnItem {
  return {
    kind: "decision",
    id: "2026-10-23-1",
    title: "Pick hosting",
    project: "Example",
    projectId: "example",
    where: "/tmp/example",
    command: "/pandacorp:decide 2026-10-23-1",
    date: "2026-10-23",
    ageDays: 7,
    ageLabel: "hace 7 días",
    ...overrides,
  };
}
function idea(status: IdeaCard["status"], project?: string): IdeaCard {
  return { status, project } as IdeaCard;
}
function overview(phase: string, projectPath: string): ProjectOverviewItem {
  return {
    path: projectPath,
    source: { status: { present: true, malformed: false, status: { phase } } },
  } as unknown as ProjectOverviewItem;
}

describe("REQ-18-010: live decisions.md shapes reach Tu turno", () => {
  it("a valid pending decision survives an unsupported heading in the same file", () => {
    decisions(
      "# Bandeja\n\n## 2026-10-20 (PENDIENTE) — Choose hosting\n\n**Qué decidir:** Pick A.\n\n## FRD-25 — Needs the owner\n\n**Estado:** PENDIENTE\n",
    );
    const result = deriveOwnerTurn([inbox()], NOW);
    expect(result.items.map((item) => item.title)).toEqual(["Choose hosting"]);
    expect(result.errors).toEqual([{ project: "Example", source: "decisions" }]);
  });

  it("a file holding only resolved `## RESUELTO` blocks (the live Funko Tracker shape) reads calm", () => {
    decisions(
      "# Bandeja\n\n## RESUELTO — La construcción se atasca\n\nCerrado.\n\n## RESUELTO: el gate de fidelidad bloquea (2026-10-18)\n\nCerrado.\n",
    );
    const result = deriveOwnerTurn([inbox()], NOW);
    expect(result).toMatchObject({ count: 0, errors: [] });
  });

  it("keeps the ask and context of the live PersonalPage block, joined across wrapped lines", () => {
    const [point] = parseDecisionBlocks(
      "## 2026-09-10 · Copy\n\n**Contexto:** Carlos revisó el sitio\ny dio feedback.\n\n**Qué necesito de ti:** dime si\nlo dejamos.\n",
    );
    expect(point).toMatchObject({
      context: "Carlos revisó el sitio y dio feedback.",
      ask: "dime si lo dejamos.",
    });
  });

  it("does not let the detail fields change a decision id or its status", () => {
    const plain = "## 2026-10-20 (PENDIENTE) — Same\n";
    const rich = `${plain}**Contexto:** Why.\n**Qué decidir:** What.\n`;
    const [before] = parseDecisionBlocks(plain);
    const [after] = parseDecisionBlocks(rich);
    expect(after).toMatchObject({ id: before?.id, status: before?.status });
  });
});

describe("REQ-18-011: routine progress never enters the queue", () => {
  it("excludes engine logs, resolved blocks and every non-ready change, and the count equals the rows", () => {
    decisions(
      "## 2026-10-20 (PENDIENTE) — Real\n## 2026-10-20 — 12:30 Engine tick\n## 2026-10-20 (PENDIENTE) — Closed\n- **Estado:** RESUELTO\n",
    );
    for (const status of ["building", "draft", "done"]) queued(`c-${status}`, status);
    const result = deriveOwnerTurn([inbox()], NOW);
    expect(result.items.map((item) => item.title)).toEqual(["Real"]);
    expect(result.count).toBe(result.items.length);
  });

  it("puts the same building and draft changes in En marcha, with canonical deep links", () => {
    queued("c-building", "building");
    queued("c-draft", "draft");
    const groups = deriveFlightGroups([inbox()]);
    expect(groups.map((group) => group.kind)).toEqual(["building", "draft"]);
    expect(groups[0]?.rows[0]?.href).toBe("/portfolio/example/changes?change=c-building");
    expect(groups[1]?.rows[0]).toMatchObject({
      title: "1 cambio en borrador",
      href: "/portfolio/example/changes",
    });
  });
});

describe("REQ-18-003: calm is only claimed when every source was read", () => {
  it("an unreadable queue never shows Al día", () => {
    render(
      <TuTurno
        result={{ items: [], count: 0, errors: [{ project: "Example", source: "changes" }] }}
      />,
    );
    expect(screen.queryByText("Al día")).toBeNull();
    expect(screen.queryByText("Nada espera tu acción ahora mismo.")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Example");
  });

  it("a truly empty queue shows the message and the badge", () => {
    render(<TuTurno result={{ items: [], count: 0, errors: [] }} />);
    expect(screen.getByText("Al día")).toBeVisible();
    expect(screen.getByText("Nada espera tu acción ahora mismo.")).toBeVisible();
  });

  it("an empty En marcha draws no card, a read failure still does", () => {
    const { container, rerender } = render(<EnMarchaCard groups={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<EnMarchaCard groups={[]} errors={[{ project: "Example", source: "work-orders" }]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Example");
  });
});

describe("AC-18-022.2: the seven-day boundary of the run sentence", () => {
  const RUN = /^Corre en la carpeta de Example\./;
  function openDetails(ageDays: number): HTMLElement {
    const item = turnItem({ ageDays, ask: "Pick A.", recommendation: "A.", context: "Why." });
    render(<TuTurno result={{ items: [item], count: 1, errors: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Detalles: Pick hosting" }));
    return screen.getByRole("dialog");
  }

  it("carries the drawn sentence at exactly seven days", () => {
    expect(within(openDetails(7)).getByText(RUN)).toBeInTheDocument();
  });

  it("shows only the command at six days", () => {
    const dialog = openDetails(6);
    expect(within(dialog).queryByText(RUN)).toBeNull();
    expect(dialog).toHaveTextContent("/pandacorp:decide 2026-10-23-1");
  });
});

describe("REQ-18-014 AC-18-022.4: the funnel uses the launch bridge", () => {
  const LAUNCHED = "/projects/launched";
  it("counts a launched in-pipeline project once, on the same figure the Logros funnel reads", () => {
    const ideas = [idea("in-pipeline", LAUNCHED), idea("shipped"), idea("discarded")];
    const projects = [overview("release", LAUNCHED)];
    const funnel = deriveIdeaFunnel(ideas, projects);
    const row = (phase: string) => funnel.rows.find((entry) => entry.phase === phase)?.count;
    expect(row("release")).toBe(
      countLaunched(
        ideas,
        projects.map((project) => project.source.status),
      ),
    );
    expect(row("release")).toBe(2);
    expect(row("implementation")).toBe(0);
    expect(funnel.discarded).toBe(1);
  });

  it("agrees with the board for every active idea", () => {
    const projects = [overview("design", "/projects/design")];
    const card = idea("in-pipeline", "/projects/design");
    const funnel = deriveIdeaFunnel([card], projects);
    expect(deriveColumn(card, projects[0]?.source.status ?? null)).toBe("design");
    expect(funnel.rows.find((entry) => entry.phase === "design")?.count).toBe(1);
  });

  it("keeps a zeroed factory visible, never blank", () => {
    const funnel = deriveIdeaFunnel([], []);
    expect(funnel.rows).toHaveLength(6);
    expect(funnel.rows.every((entry) => entry.count === 0)).toBe(true);
  });
});

describe("REQ-18-013 AC-12-001.3: the pulse", () => {
  it("never reads an unknown project count as zero", () => {
    const counts = { frds: null, ordersVerified: null, ordersTotal: null };
    const tiles = pulseTiles([{ counts } as unknown as ProjectOverviewItem]);
    expect(tiles.length).toBeLessThanOrEqual(5);
    render(<Pulso tiles={tiles} />);
    expect(screen.getAllByText("?").length).toBeGreaterThanOrEqual(2);
  });
});

describe("Gremio: one freshness predicate", () => {
  const unique = {
    name: "First",
    category: "Discovery" as const,
    rarity: "Común" as const,
    condition: "",
    unlocked: true,
  };
  it.each([
    ["2026-10-23T12:00:00Z", true],
    ["2026-10-23T11:59:59Z", false],
    ["2026-11-02T12:00:00Z", false],
  ])("unlocked %s is fresh: %s", (date, fresh) => {
    expect(selectLastAchievement([{ ...unique, date }], NOW)?.fresh).toBe(fresh);
  });

  it("orders dated unlocks before undated ones", () => {
    const picked = selectLastAchievement(
      [
        { ...unique, name: "Undated" },
        { ...unique, name: "Dated", date: "2026-01-01" },
      ],
      NOW,
    );
    expect(picked?.title).toBe("Dated");
  });
});
