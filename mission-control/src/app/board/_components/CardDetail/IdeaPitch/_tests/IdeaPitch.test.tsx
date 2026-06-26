/**
 * IdeaPitch (CMP-02-idea-pitch) — the Propuesta tab's renderer.
 * Verifies the hero, the hot/cold structure, the scorecard bars, and the raw-markdown fallback.
 * Prose flows through the shared <Markdown>; queries by role/text/testid (no container assertions).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IdeaPitch } from "../IdeaPitch";

const MEMO = `> **Veredicto: 🧪 VALIDAR** — **La apuesta:** contenido viral que arrastra a una herramienta.

## 🔥 De un vistazo
- **Problema (PAS):** compras tu Labubu y la duda te carcome.
- **Por qué tú:** tu canal de 30k.
- **La visión:** checklist guiado por serie.

| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | Alto | Medio | micro | Alta | mixed |

## ❄️ Profundizar

### Mercado
Coleccionistas hispanos. Lead-magnet.

### Gaps y riesgos
La verdad la pone el experto. Riesgo legal bajo.
`;

describe("IdeaPitch", () => {
  it("renders the hero: title + la apuesta one-liner", () => {
    render(<IdeaPitch title="PandaCheck" body={MEMO} />);
    expect(screen.getByRole("heading", { name: "PandaCheck" })).toBeInTheDocument();
    expect(screen.getByText(/contenido viral que arrastra/)).toBeInTheDocument();
    expect(screen.getByText("Memo-pitch de idea")).toBeInTheDocument();
  });

  it("renders the verdict badge from the lead blockquote", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getByText(/VALIDAR/)).toBeInTheDocument();
  });

  it("renders the De un vistazo glance rows", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getAllByTestId("pitch-glance-row").length).toBe(3);
    expect(screen.getByText(/duda te carcome/)).toBeInTheDocument();
  });

  it("renders the Profundizar deep-dive cards", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    const cards = screen.getAllByTestId("pitch-deep-card");
    expect(cards.length).toBe(2);
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("Gaps y riesgos")).toBeInTheDocument();
  });

  it("renders the scorecard as bars", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getAllByTestId("pitch-score-bar").length).toBe(5);
  });

  it("falls back to raw markdown when the body has no memo skeleton", () => {
    render(<IdeaPitch title="X" body={"## Plain heading\n\nJust prose, no structure."} />);
    expect(screen.getByRole("heading", { name: /Plain heading/ })).toBeInTheDocument();
    expect(screen.getByText(/Just prose/)).toBeInTheDocument();
    expect(screen.queryAllByTestId("pitch-glance-row")).toHaveLength(0);
  });

  it("frames the whole memo as an accessible proposal region", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getByRole("article", { name: "Propuesta de la idea" })).toBeInTheDocument();
  });
});
