/**
 * FRD-08 gate (DR-072), reviewer (opus, DR-015): adversarial shell edges of the v2 Documentación.
 * Reconciled for WO-08-003: Referencia is links to Configuración and `/manual` is a home, so the
 * embedded catalog and the automatic first-page selection pinned by the v1 suite no longer exist.
 * Drives the real ManualShell; only the page renderer registry is replaced by fixtures.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualPage } from "@/lib/manual/manual";
import { validateNavigationQuery } from "@/lib/navigation/keys";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import { ManualShell } from "../ManualShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("../manualPages", () => ({ getManualPageComponent: () => null }));

function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

beforeEach(() => visit("/manual"));
afterEach(cleanup);

const PAGES: ManualPage[] = [
  { group: "concepts", slug: "que-es", title: "Qué es", order: 1, body: "cuerpo-concepto" },
  { group: "guides", slug: "operar", title: "Cómo operas", order: 1, body: "cuerpo-guia" },
];

describe("FRD-08 REQ-08-007 Referencia points to Configuración and forks nothing", () => {
  it("the reader renders no catalog container and each entry links to its FRD-07 section", () => {
    visit("/manual/guides/operar");
    render(<ManualShell pages={PAGES} />);
    for (const id of [
      "reference-commands-section",
      "reference-agents-section",
      "reference-rules-view",
      "reference-standards-view",
      "doc-reader-reference",
      "agent-card",
      "standards-section",
      "rules-section",
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    const index = screen.getByRole("navigation", { name: "Índice de la Documentación" });
    expect(within(index).getByRole("link", { name: "Comandos" })).toHaveAttribute(
      "href",
      "/configuration/skills",
    );
    expect(within(index).getByRole("link", { name: "Agentes" })).toHaveAttribute(
      "href",
      "/configuration/agents",
    );
    expect(within(index).getByRole("link", { name: "Reglas de decisión" })).toHaveAttribute(
      "href",
      "/configuration/rules",
    );
    expect(within(index).getByRole("link", { name: "Estándares" })).toHaveAttribute(
      "href",
      "/configuration/standards",
    );
  });
});

describe("FRD-08 AC-08-020.1 the root is a home, never an implicit page", () => {
  it("does not auto-select a page when the tutorial bucket is empty", () => {
    render(<ManualShell pages={PAGES} />);
    expect(screen.getByTestId("docs-home")).toBeInTheDocument();
    expect(screen.queryByTestId("doc-reader-authored")).toBeNull();
  });

  it("orders the numbered path by `order`, not by input position", () => {
    const pages: ManualPage[] = [
      { group: "tutorial", slug: "segundo", title: "Segundo", order: 5, body: "b" },
      { group: "tutorial", slug: "primero", title: "Primero", order: 1, body: "a" },
    ];
    render(<ManualShell pages={pages} />);
    const links = within(screen.getByRole("list", { name: "Empieza aquí" })).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/manual/tutorial/primero",
      "/manual/tutorial/segundo",
    ]);
  });

  it("an empty content tree renders the home with zero counts and never throws", () => {
    expect(() => render(<ManualShell pages={[]} />)).not.toThrow();
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Buscar en 0 páginas…");
    expect(screen.queryByTestId("doc-reader-authored")).toBeNull();
  });
});

describe("FRD-08 reader boundaries", () => {
  it("a page sharing its slug across groups opens only inside the addressed group", () => {
    const pages: ManualPage[] = [
      { group: "guides", slug: "same", title: "Guía", order: 1, body: "cuerpo-g" },
      { group: "concepts", slug: "same", title: "Concepto", order: 1, body: "cuerpo-c" },
    ];
    visit("/manual/concepts/same");
    render(<ManualShell pages={pages} />);
    expect(screen.getByTestId("doc-reader-authored")).toHaveTextContent("cuerpo-c");
    expect(screen.getByTestId("doc-reader-authored")).not.toHaveTextContent("cuerpo-g");
  });

  it("a group address without a page is bounded, not a blank reader", () => {
    visit("/manual/concepts");
    render(<ManualShell pages={PAGES} />);
    expect(screen.getByText("Esta página no existe")).toBeInTheDocument();
    expect(screen.queryByTestId("doc-reader")).toBeNull();
  });

  it("AC-25 the opened-index state is written with the value the URL contract accepts", () => {
    visit("/manual/guides/operar");
    render(<ManualShell pages={PAGES} />);
    act(() => screen.getByRole("button", { name: /Índice ·/ }).click());
    const href = `${window.location.pathname}${window.location.search}`;
    expect(validateNavigationQuery("manual", parseNavigationUrl(href))).toEqual({ ok: true });
  });
});

describe("FRD-08 REQ-08-001 canonical page title", () => {
  it.each([
    "/manual",
    "/manual/guides/operar",
    "/manual/guides/no-existe",
  ])("%s has exactly one h1, 'Documentación'", (href) => {
    visit(href);
    render(<ManualShell pages={PAGES} />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      "Documentación",
    ]);
  });
});
