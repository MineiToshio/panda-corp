/**
 * SpecDigest — component tests. Renders the digest's PRD/Research/FRD sections and verifies the
 * FRD cards are clickable buttons that open the detail modal (owner rule: detail in a modal).
 * Queries by role/name (no testid/CSS), per the testing discipline.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpecDigest } from "../SpecDigest";

const DIGEST = `---
proyecto: "Toshio.dev"
fase: producto
---

> Vista de alto nivel del PRD, el research y los FRDs.

## 📋 PRD

### Usuarios
- **Reclutador tech** — decide en 15s.

### Decisiones abiertas
- **Case studies** — qué 3-4 proyectos.

## 🔬 Research

### Referentes
- **brittanychiang.com** — curación extrema.

## 🧩 FRDs

### FRD-01 · Site shell, i18n & theming · UI
El esqueleto bilingüe.
**Overview:** El marco que envuelve toda la app.
**User stories:**
- Como visitante, quiero cambiar de idioma.
**Open questions:**
- ¿Selector de idioma explícito?
`;

describe("SpecDigest", () => {
  it("renders the project hero and the PRD/Research/FRD content", () => {
    render(<SpecDigest title="fallback" body={DIGEST} />);
    expect(screen.getByRole("heading", { name: "Toshio.dev" })).toBeInTheDocument();
    expect(screen.getByText("Reclutador tech")).toBeInTheDocument();
    expect(screen.getByText("brittanychiang.com")).toBeInTheDocument();
    expect(screen.getByText("Site shell, i18n & theming")).toBeInTheDocument();
  });

  it("renders the PRD lead with the scannable kinds (problem→bullets, bet→highlight, scope→checklist, out-of-scope→no strikethrough)", () => {
    const body = `---
proyecto: "X"
fase: producto
---
> intro

## 📋 PRD

### El problema
- **Sitio viejo** — diseño 2021.
- **Blog caído** — HTTP 500.

### Hipótesis de valor
Si lo reemplazas, te contactan en vez de cerrar la pestaña.

### Alcance v1
- Site shell bilingüe
- Blog MDX

### Fuera del v1
- Comentarios giscus
`;
    render(<SpecDigest title="x" body={body} />);
    // problem → a scannable bullet list (not a paragraph)
    expect(screen.getAllByTestId("spec-bullet")).toHaveLength(2);
    // hypothesis → a single highlighted callout
    expect(screen.getByTestId("spec-highlight")).toHaveTextContent(
      "Si lo reemplazas, te contactan en vez de cerrar la pestaña.",
    );
    // scope → a roomy checklist (scope items, NOT cramped chips)
    expect(screen.getAllByTestId("spec-scope-item")).toHaveLength(2);
    // out-of-scope → a muted chip WITHOUT a strike-through (legibility fix)
    const outChip = screen.getByText("Comentarios giscus");
    expect(outChip.style.textDecoration).not.toContain("line-through");
  });

  it("falls back to the card title when the digest has no `proyecto`", () => {
    render(
      <SpecDigest
        title="Mi proyecto"
        body={"> intro\n\n## 🧩 FRDs\n\n### FRD-01 · X · UI\nresumen."}
      />,
    );
    expect(screen.getByRole("heading", { name: "Mi proyecto" })).toBeInTheDocument();
  });

  it("opens the detail modal with the FRD's blocks when its card is clicked", () => {
    render(<SpecDigest title="fallback" body={DIGEST} />);
    // No dialog until a card is clicked.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle de FRD-01/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /FRD-01 · Site shell/ })).toBeInTheDocument();
    expect(screen.getByText("El marco que envuelve toda la app.")).toBeInTheDocument();
    expect(screen.getByText("Como visitante, quiero cambiar de idioma.")).toBeInTheDocument();
    expect(screen.getByText("Open questions")).toBeInTheDocument();
    expect(screen.getByText("¿Selector de idioma explícito?")).toBeInTheDocument();
  });

  it("closes the modal via its close button", () => {
    render(<SpecDigest title="fallback" body={DIGEST} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver detalle de FRD-01/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
