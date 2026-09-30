/**
 * activeProjects() carries the portfolio row's "last sync" cell to the rail item (REQ-03-007).
 *
 * Real production shape: the Spanish "Última sync" header (DR-009) → readPortfolio → ProjectListItem.
 */

import { describe, expect, it } from "vitest";
import { activeProjects } from "@/lib/portfolio/portfolio";

const PORTFOLIO = [
  "# Portfolio Pandacorp",
  "",
  "| Proyecto | Ruta | Repo | Idea origen | Fase | Usuarios | Retorno | Veredicto | Última sync |",
  "|---|---|---|---|---|---|---|---|---|",
  "| Alfa | `/nonexistent/alfa/` | — | idea-a | implementation | — | personal | — | 2026-09-22 |",
  "| Beta | `/nonexistent/beta/` | — | idea-b | implementation | — | personal | — | — |",
  "",
].join("\n");

describe("activeProjects — lastSync", () => {
  it("passes the raw last-sync cell through to the item", () => {
    const alfa = activeProjects(PORTFOLIO).find((p) => p.name === "Alfa");

    expect(alfa?.lastSync).toBe("2026-09-22");
  });

  it("leaves lastSync undefined for a placeholder cell", () => {
    const beta = activeProjects(PORTFOLIO).find((p) => p.name === "Beta");

    expect(beta).toBeDefined();
    expect(beta?.lastSync).toBeUndefined();
  });
});
