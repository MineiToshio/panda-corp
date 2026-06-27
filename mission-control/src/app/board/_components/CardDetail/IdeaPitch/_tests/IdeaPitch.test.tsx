/**
 * IdeaPitch (CMP-02-idea-pitch) — the Propuesta tab's renderer.
 * Verifies the hero (badges from the explicit Badges line), the hot/cold rows, the "La visión"
 * feature grid + checklist mock, the risk↔mitigation cards, the chart, the scorecard, the collapsible
 * Evidencia, and the fallback. Faithful to the approved HTML (10b).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IdeaPitch } from "../IdeaPitch";

const MEMO = `> **Veredicto: 🏗️ build (re-scopeado)** — **La apuesta:** una web que te vuelve el experto.
> **Badges:** 🏗️ build (re-scopeado) | cubeta: MICRO · 2–3 días | painkiller · viral | retorno: oportunidad + personal

## 🔥 De un vistazo

### La apuesta
El contenido viral convertido en herramienta.

### El problema
Compras tu Labubu y la duda te carcome.

> "How do I know if my Labubu is real?" — patrón del nicho.

### La visión
- **Checklist guiado** — paso a paso por serie.
- **Galería spot the fake** — comparador lado a lado.

**Vista previa — pandacheck.app/labubu-v3**
- ✓ Sello de pie con relieve nítido
- ! Holograma: revisa el viraje de color

| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | Alto | Medio | micro | Alta | mixed |

## ❄️ Profundizar

### Mercado
Coleccionistas hispanos. Lead-magnet.

### Gaps y fuente de la verdad
La verdad la pone el experto.

| Riesgo | Mitigación |
|---|---|
| Falso positivo. | La app educa, no certifica. |

### Red team
Si fracasó: nadie pasó del video a la herramienta.

### El ask
Micro-app de 2-3 días.

### Evidencia
[CNN](https://www.cnn.com/2025/08/24/business/fake-labubus-pop-mart)
`;

describe("IdeaPitch", () => {
  it("renders the hero with the explicit badges (full text, not truncated)", () => {
    render(<IdeaPitch title="PandaCheck" body={MEMO} />);
    expect(screen.getByRole("heading", { name: "PandaCheck" })).toBeInTheDocument();
    expect(screen.getByText("painkiller · viral")).toBeInTheDocument();
    expect(screen.getByText("cubeta: MICRO · 2–3 días")).toBeInTheDocument();
    expect(screen.getByText("retorno: oportunidad + personal")).toBeInTheDocument();
  });

  it("shows the app-type/platform meta chips and drops the opaque 'build' verdict badge", () => {
    render(<IdeaPitch title="X" body={MEMO} projectType="web" targetPlatforms="responsive" />);
    expect(screen.getAllByTestId("pitch-meta-chip").map((c) => c.textContent?.trim())).toEqual([
      "web",
      "Responsive",
    ]);
    // the opaque verdict badge is replaced by the "qué es" meta chips
    expect(screen.queryByText("🏗️ build (re-scopeado)")).toBeNull();
  });

  it("renders the De un vistazo hot rows including La apuesta and El problema", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getAllByTestId("pitch-glance-row").length).toBe(3);
    expect(screen.getByText("La apuesta")).toBeInTheDocument();
    expect(screen.getByText(/duda te carcome/)).toBeInTheDocument();
  });

  it("renders La visión as a feature grid plus the checklist mock", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getByText("Checklist guiado")).toBeInTheDocument();
    expect(screen.getByTestId("pitch-mock")).toBeInTheDocument();
    expect(screen.getByText(/Sello de pie con relieve/)).toBeInTheDocument();
  });

  it("renders the Profundizar cold rows (excluding Evidencia)", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getAllByTestId("pitch-cold-row").length).toBe(4);
    expect(screen.getByText("Gaps y fuente de la verdad")).toBeInTheDocument();
  });

  it("renders the risk↔mitigation cards with a Mitigación label", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getByTestId("pitch-rm")).toBeInTheDocument();
    expect(screen.getByText(/Falso positivo/)).toBeInTheDocument();
    expect(screen.getByText(/Mitigación/)).toBeInTheDocument();
  });

  it("renders the scorecard bars and the esfuerzo-vs-valor chart", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getAllByTestId("pitch-score-bar").length).toBe(5);
    expect(screen.getByTestId("pitch-chart")).toBeInTheDocument();
  });

  it("renders Evidencia as a collapsible (not a cold row)", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getByTestId("pitch-evidence")).toBeInTheDocument();
    expect(screen.getByText(/Evidencia y fuentes/)).toBeInTheDocument();
  });

  it("falls back to raw markdown when the body has no memo skeleton", () => {
    render(<IdeaPitch title="X" body={"## Plain heading\n\nJust prose, no structure."} />);
    expect(screen.getByRole("heading", { name: /Plain heading/ })).toBeInTheDocument();
    expect(screen.queryAllByTestId("pitch-glance-row")).toHaveLength(0);
  });

  it("frames the whole memo as an accessible proposal region", () => {
    render(<IdeaPitch title="X" body={MEMO} />);
    expect(screen.getByRole("article", { name: "Propuesta de la idea" })).toBeInTheDocument();
  });
});
