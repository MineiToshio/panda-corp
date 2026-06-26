/**
 * spec.ts — parser tests. Exercises a realistic spec digest (frontmatter + lead + PRD/Research
 * blocks classified by label + per-FRD cards with detail blocks) and the graceful empty case.
 */

import { describe, expect, it } from "vitest";
import { parseSpec } from "../spec";

const DIGEST = `---
proyecto: "Toshio.dev — Portafolio de marca personal"
fase: producto
---

> Vista de alto nivel del PRD, el research y los FRDs.

## 📋 PRD

### Hipótesis de valor
Si reemplazas el sitio viejo, **contactan** en vez de cerrar la pestaña.

### Usuarios
- **Reclutador tech** — decide en 15s.
- **Cliente freelance** — busca prueba social.

### Métricas de éxito
- **≥1 contacto inbound** — en 30 días.

### Alcance v1
- Site shell bilingüe
- Blog MDX

### Fuera del v1
- Comentarios (giscus)

### Decisiones abiertas
- **Case studies** — qué 3-4 proyectos.

## 🔬 Research

### Hallazgo clave
El sitio actual es una señal negativa.

### Referentes
- **brittanychiang.com** — curación extrema.

## 🧩 FRDs

### FRD-01 · Site shell, i18n & theming · UI
El esqueleto bilingüe.
**Overview:** El marco que envuelve toda la app.
**User stories:**
- Como visitante, quiero cambiar de idioma.
- Como visitante, quiero dark mode.
**Reglas de negocio:**
- Locale por defecto: español.
**Fuera de alcance:**
- Más de dos idiomas.
**Open questions:**
- ¿Selector de idioma explícito?

### FRD-02 · SEO & structured data · Infra
SEO de verdad.
`;

describe("parseSpec", () => {
  it("reads the frontmatter, intro and the three sections", () => {
    const spec = parseSpec(DIGEST);
    expect(spec.proyecto).toBe("Toshio.dev — Portafolio de marca personal");
    expect(spec.fase).toBe("producto");
    expect(spec.intro).toContain("Vista de alto nivel");
    expect(spec.prd).not.toBeNull();
    expect(spec.research).not.toBeNull();
    expect(spec.frds).toHaveLength(2);
    expect(spec.hasContent).toBe(true);
  });

  it("classifies PRD subsections by label", () => {
    const blocks = parseSpec(DIGEST).prd?.blocks ?? [];
    const kindOf = (label: string) => blocks.find((b) => b.label.includes(label))?.kind;
    expect(kindOf("Hipótesis")).toBe("prose");
    expect(kindOf("Usuarios")).toBe("roles");
    expect(kindOf("Métricas")).toBe("metrics");
    expect(kindOf("Alcance")).toBe("chips");
    expect(kindOf("Fuera")).toBe("chips-muted");
    expect(kindOf("Decisiones")).toBe("decisions");
  });

  it("parses role/decision items into title + desc, and chips into title-only", () => {
    const blocks = parseSpec(DIGEST).prd?.blocks ?? [];
    const roles = blocks.find((b) => b.kind === "roles");
    expect(roles?.items[0]).toEqual({ title: "Reclutador tech", desc: "decide en 15s." });
    const chips = blocks.find((b) => b.kind === "chips");
    expect(chips?.items.map((i) => i.title)).toEqual(["Site shell bilingüe", "Blog MDX"]);
  });

  it("classifies Referentes as ref cards", () => {
    const research = parseSpec(DIGEST).research;
    expect(research?.blocks.find((b) => b.label.includes("Referentes"))?.kind).toBe("refs");
  });

  it("parses an FRD card with id, tag, summary and the detail blocks", () => {
    const frd = parseSpec(DIGEST).frds[0];
    expect(frd?.id).toBe("FRD-01");
    expect(frd?.tag).toBe("UI");
    expect(frd?.summary).toBe("El esqueleto bilingüe.");
    expect(frd?.overview).toContain("El marco que envuelve");
    expect(frd?.userStories).toHaveLength(2);
    expect(frd?.businessRules).toEqual(["Locale por defecto: español."]);
    expect(frd?.outOfScope).toEqual(["Más de dos idiomas."]);
    expect(frd?.openQuestions).toEqual(["¿Selector de idioma explícito?"]);
  });

  it("tolerates an FRD with only a summary (no detail blocks)", () => {
    const frd = parseSpec(DIGEST).frds[1];
    expect(frd?.id).toBe("FRD-02");
    expect(frd?.summary).toBe("SEO de verdad.");
    expect(frd?.userStories).toEqual([]);
    expect(frd?.openQuestions).toEqual([]);
  });

  it("returns hasContent=false on a digest with no recognisable sections", () => {
    const spec = parseSpec("---\nproyecto: x\n---\n\n> intro\n\njust prose, no sections.");
    expect(spec.hasContent).toBe(false);
    expect(spec.prd).toBeNull();
    expect(spec.frds).toEqual([]);
  });
});
