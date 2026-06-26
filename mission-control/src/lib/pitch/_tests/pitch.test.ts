/**
 * pitch.ts — parser tests. Exercises a realistic card body (the shared memo skeleton:
 * lead blockquote + "De un vistazo" bullets + scorecard table + "Profundizar" subsections)
 * and the graceful fallback when no structure is present.
 */

import { describe, expect, it } from "vitest";
import { parsePitch } from "../pitch";

const BODY = `> **Veredicto: 🧪 VALIDAR** — **La apuesta:** contenido viral que arrastra a una herramienta.

## 🔥 De un vistazo
- **Problema (PAS):** compras tu Labubu y la duda te carcome.
- **Por qué ahora:** crisis de falsificaciones 2025.
- **Por qué tú:** tu canal de 30k + credibilidad.
- **La visión:** checklist guiado por serie con galería real vs fake.

| Eje | founder-fit | wedge | esfuerzo | demanda | retorno |
|---|---|---|---|---|---|
| | Alto (viral) | Medio (español) | micro | Alta | mixed |

## ❄️ Profundizar

### Mercado
Coleccionistas hispanos de Funko/Labubu. Lead-magnet, freemium modesto.

### Gaps y riesgos
La verdad la pone el experto, no un algoritmo. Riesgo legal bajo por diseño.

### Evidencia
[CNN fakes Labubu](https://www.cnn.com/2025/08/24/business/fake-labubus-pop-mart)
`;

describe("parsePitch", () => {
  it("extracts the verdict and la apuesta from the lead blockquote", () => {
    const p = parsePitch(BODY);
    expect(p.verdict).toMatch(/VALIDAR/);
    expect(p.laApuesta).toBe("contenido viral que arrastra a una herramienta.");
  });

  it("parses the De un vistazo bullets and flags problema/vision kinds", () => {
    const p = parsePitch(BODY);
    expect(p.glance).toHaveLength(4);
    expect(p.glance.find((g) => g.kind === "problema")?.value).toMatch(/Labubu/);
    expect(p.glance.find((g) => g.kind === "vision")?.label).toMatch(/visión/i);
  });

  it("parses the scorecard table aligning each axis to its cell", () => {
    const p = parsePitch(BODY);
    const byAxis = Object.fromEntries(p.scorecard.map((a) => [a.axis, a.value]));
    expect(byAxis["founder-fit"]).toBe("Alto (viral)");
    expect(byAxis.esfuerzo).toBe("micro");
    expect(p.scorecard.find((a) => a.axis === "founder-fit")?.level).toBe("high");
  });

  it("parses the Profundizar subsections and strips table lines", () => {
    const p = parsePitch(BODY);
    const headings = p.deepDive.map((s) => s.heading);
    expect(headings).toContain("Mercado");
    expect(headings).toContain("Evidencia");
    expect(p.deepDive.every((s) => !s.markdown.includes("|"))).toBe(true);
  });

  it("builds hero badges from the verdict and the scorecard", () => {
    const p = parsePitch(BODY);
    expect(p.badges[0]?.label).toMatch(/VALIDAR/);
    expect(p.badges.some((b) => /esfuerzo: micro/.test(b.label))).toBe(true);
  });

  it("flags hasStructured=false for a body with no memo skeleton", () => {
    const p = parsePitch("Just a plain paragraph with no structure.");
    expect(p.hasStructured).toBe(false);
    expect(p.glance).toHaveLength(0);
    expect(p.deepDive).toHaveLength(0);
  });
});
