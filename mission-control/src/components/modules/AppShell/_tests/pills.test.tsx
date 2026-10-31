import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingPill } from "../PendingPill";
import { PluginPill } from "../PluginPill";

describe("sidebar pills", () => {
  it("AC-15-006.1 AC-15-002.1: only drift renders, naming the behind runtime versions", () => {
    const state = {
      drift: false,
      reason: "in-sync" as const,
      installedVersion: "9.2.0",
      sourceVersion: "9.2.0",
      detail: "",
    };
    const view = render(<PluginPill state={state} />);
    expect(screen.queryByRole("link")).toBeNull();
    view.rerender(
      <PluginPill state={{ ...state, drift: true, reason: "behind", installedVersion: "9.1.0" }} />,
    );
    expect(screen.getByRole("link", { name: "Plugin desactualizado" })).toHaveAttribute(
      "title",
      "Instalado 9.1.0 · repositorio 9.2.0",
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
    view.rerender(<PluginPill state={{ ...state, reason: "unknown" }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("AC-15-006.1: a behind Codex runtime names its own versions even when Claude is current", () => {
    render(
      <PluginPill
        state={{
          drift: true,
          reason: "behind",
          installedVersion: "9.3.0",
          sourceVersion: "9.3.0",
          detail: "",
          runtimes: {
            claude: {
              runtime: "claude",
              drift: false,
              reason: "in-sync",
              installedVersion: "9.3.0",
              sourceVersion: "9.3.0",
            },
            codex: {
              runtime: "codex",
              drift: true,
              reason: "behind",
              installedVersion: "9.1.0",
              sourceVersion: "9.2.0",
            },
          },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Plugin desactualizado" })).toHaveAttribute(
      "title",
      "Instalado 9.1.0 · repositorio 9.2.0",
    );
  });
  it("AC-21-008.1, AC-21-008.2: uncapped count, urgent/unread priority and empty hiding", () => {
    const summary = { count: 123, urgent: false, unreadable: 0, hidden: false };
    const view = render(<PendingPill summary={summary} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/#worktrees-card");
    expect(screen.getByRole("link")).toHaveTextContent("123 pendientes");
    expect(screen.getByRole("link")).toHaveAttribute("data-tone", "slate");
    expect(screen.getByRole("link")).toHaveAttribute(
      "title",
      "123 ramas sin integrar en main. Abre «Árboles de trabajo» en Inicio.",
    );
    view.rerender(<PendingPill summary={{ ...summary, urgent: true }} />);
    expect(screen.getByRole("link")).toHaveTextContent("depurar ya");
    view.rerender(<PendingPill summary={{ ...summary, urgent: true, unreadable: 2 }} />);
    expect(screen.getByRole("link")).toHaveTextContent("sin leer");
    expect(screen.getByRole("link")).not.toHaveTextContent("depurar ya");
    expect(screen.getByRole("link")).toHaveAttribute("data-tone", "coral");
    view.rerender(
      <PendingPill summary={{ count: 0, urgent: false, unreadable: 1, hidden: false }} />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("Árboles · sin leer");
    view.rerender(
      <PendingPill summary={{ count: 0, urgent: false, unreadable: 0, hidden: true }} />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});
