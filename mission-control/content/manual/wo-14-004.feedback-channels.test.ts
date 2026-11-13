/** FRD-08 AC-08-021.1/.4 supersede WO-14-004's automatic feedback pickup. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readManualPages } from "@/lib/manual/manual";
import { renderedManualText } from "@/test/manualPageText";

const APP_ROOT = path.resolve(__dirname, "../..");
const pages = readManualPages(APP_ROOT);
const page = pages.find((entry) => entry.slug === "g-feedback");
function feedbackText(): string {
  if (!page) throw new Error("Missing g-feedback page");
  return renderedManualText(page).replace(/\s+/g, " ");
}

describe("FRD-08 Day 1 feedback: build, capture and answer", () => {
  it("keeps the authored guide indexed with a real source", () => {
    expect(fs.existsSync(path.join(APP_ROOT, "content/manual/guides/g-feedback.md"))).toBe(true);
    expect(page?.group).toBe("guides");
    expect(page?.title.trim()).toBeTruthy();
    expect(feedbackText().length).toBeGreaterThan(100);
  });
  it("routes bugs through the single build entry and regression tests", () => {
    const text = feedbackText();
    expect(text).toContain("/pandacorp:implement");
    expect(text).toMatch(/tests de regresión preceden al arreglo/i);
    expect(text).not.toMatch(/\/pandacorp:(bug|iterate|ch[a]nge)\b/);
  });
  it("captures a draft for later without widening the current run", () => {
    const text = feedbackText();
    expect(text).toContain("draft");
    expect(text).toContain("card check");
    expect(text).toMatch(/no se recoge automáticamente ni amplía el run/);
    expect(text).toMatch(/Más adelante selecciona ese objetivo con implement/);
  });
  it("answers explicit question IDs through the CLI and parks only affected work", () => {
    const text = feedbackText();
    expect(text).toContain("/pandacorp:decide <id>");
    expect(text).toMatch(/aplica la respuesta mediante el CLI/);
    expect(text).toMatch(/aparcan solo el trabajo afectado/);
    expect(text).toMatch(/unidad aparcada y sus dependientes/);
  });
  it("documents the canonical inbox and tracked-inbox mirror before landing", () => {
    const text = feedbackText();
    expect(text).toContain(".pandacorp/inbox/decisions.md");
    expect(text).toContain(".pandacorp/inbox/decisions.pending.md");
    expect(text).toMatch(/visibles antes del aterrizaje/);
    expect(text).toMatch(/copia resuelta del espejo suprime una copia pendiente antigua/);
    expect(text).not.toMatch(/agente.*escribe.*status\.yaml/i);
  });
  it("links to the safe testing guide without equating branch verification with delivery", () => {
    const text = feedbackText();
    expect(text).toMatch(/snapshot verificado y aterrizado en main/);
    expect(text).toMatch(/verificado en rama aún no está entregado/);
    expect(text).toContain("Probar sin parar al agente");
  });
  it("preserves the daily feedback and testing guide destinations", () => {
    const slugs = pages.filter((entry) => entry.group === "guides").map((entry) => entry.slug);
    for (const slug of [
      "g-capturar",
      "g-handoff",
      "g-modo",
      "g-feedback",
      "g-probar",
      "g-traspaso",
      "g-plugin",
    ])
      expect(slugs).toContain(slug);
  });
});
