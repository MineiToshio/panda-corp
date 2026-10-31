import { describe, expect, it } from "vitest";
import { parseDecisionBlocks } from "../activity";

describe("AC-18-022.2 decision details", () => {
  it("preserves ids and captures the first paragraphs from a production-shaped block", () => {
    const [point] = parseDecisionBlocks(`## 2026-10-19 (PENDIENTE) — Hosting
- **Estado:** PENDIENTE
- **Qué necesito de ti:** Elige el proveedor.
  Entre las opciones propuestas.

  Another paragraph is not part of the ask.
- **Contexto:** El servicio necesita almacenamiento.
  Hay dos opciones.

- **Recomendación:** Usa el plan gratuito.
`);
    expect(point).toMatchObject({
      id: "2026-10-19-1",
      ask: "Elige el proveedor. Entre las opciones propuestas.",
      context: "El servicio necesita almacenamiento. Hay dos opciones.",
      recommendation: "Usa el plan gratuito.",
      resolved: false,
    });
  });
  it("accepts Qué decidir and does not invent absent fields", () => {
    expect(parseDecisionBlocks("## OPEN: Choice\n**Qué decidir:** Choose A.")[0]).toMatchObject({
      ask: "Choose A.",
    });
    expect(parseDecisionBlocks("## OPEN: Legacy")[0]).not.toHaveProperty("ask");
    expect(parseDecisionBlocks("## OPEN: Legacy")[0]).not.toHaveProperty("context");
  });
});
