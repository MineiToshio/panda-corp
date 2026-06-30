/**
 * architecture.ts — parser tests. Exercised against a REAL digest shape (the personal-page-v2
 * content-as-code project: a stack table, the "Sin BD" branch, services and per-FRD cards) and a
 * malformed/empty input (which must degrade to hasContent:false, never crash — the same
 * parse-don't-validate contract as spec.ts).
 */

import { describe, expect, it } from "vitest";
import { parseArchitecture } from "../architecture";

const REAL_DIGEST = `---
proyecto: "personal-page-v2"
fase: arquitectura
stack: "Next.js 16 (App Router, RSC/SSG) · React 19 · TypeScript strict · Tailwind v4"
coste: "$0/mes"
host: "Vercel Hobby"
---

> Portfolio estático y bilingüe. Sin backend ni base de datos.

## 🧱 Stack & tecnologías

| Capa | Elección | Por qué |
|---|---|---|
| Framework / UI | Next.js 16 (App Router) · React 19 | RSC-first, SSG por ruta |
| Lenguaje | TypeScript strict | Sin \`any\` |
| Hosting | Vercel Hobby | Estático, $0 |

## 🗄️ Modelo de datos

Sin base de datos — el contenido es código, validado en build.

- **BlogPost** — posts MDX por locale.
- **CaseStudy** — los 4 estudios destacados.

## 🔌 Comunicación & servicios

- **Web3Forms** — POST cliente con key pública; sin server runtime.
- **PostHog** — telemetría solo-cliente, sin PII.

## 🧩 Por FRD

### FRD-01 · Site shell · i18n · theming
**Blueprint:** layout [locale] + nav/footer + i18n + tema.
**Work orders:**
- **WO-00-001** — design system: tokens → Tailwind @theme.
- **WO-01-001** — app shell: layout + Nav + Footer.

### FRD-02 · Home
**Blueprint:** home estática con un único CTA.
**Work orders:**
- **WO-02-001** — página home + componentes.
`;

describe("parseArchitecture", () => {
  it("reads the frontmatter into the hero fields", () => {
    const a = parseArchitecture(REAL_DIGEST);
    expect(a.proyecto).toBe("personal-page-v2");
    expect(a.fase).toBe("arquitectura");
    expect(a.stack).toContain("Next.js 16");
    expect(a.coste).toBe("$0/mes");
    expect(a.host).toBe("Vercel Hobby");
    expect(a.intro).toContain("Portfolio estático");
  });

  it("parses the stack table into Capa·Elección·Por qué rows (ignoring header + separator)", () => {
    const a = parseArchitecture(REAL_DIGEST);
    expect(a.stackRows).toHaveLength(3);
    expect(a.stackRows[0]).toEqual({
      capa: "Framework / UI",
      eleccion: "Next.js 16 (App Router) · React 19",
      porque: "RSC-first, SSG por ruta",
    });
    expect(a.stackRows[2]?.capa).toBe("Hosting");
  });

  it("detects the content-as-code (Sin BD) branch and the content entities", () => {
    const a = parseArchitecture(REAL_DIGEST);
    expect(a.dataModel).not.toBeNull();
    expect(a.dataModel?.isNone).toBe(true);
    expect(a.dataModel?.note).toContain("Sin base de datos");
    expect(a.dataModel?.entities.map((e) => e.title)).toEqual(["BlogPost", "CaseStudy"]);
  });

  it("parses the communication & services bullets", () => {
    const a = parseArchitecture(REAL_DIGEST);
    expect(a.services.map((s) => s.title)).toEqual(["Web3Forms", "PostHog"]);
    expect(a.services[0]?.desc).toContain("POST cliente");
  });

  it("parses each FRD card with its blueprint one-liner and normalized work orders", () => {
    const a = parseArchitecture(REAL_DIGEST);
    expect(a.frds).toHaveLength(2);
    const frd1 = a.frds[0];
    expect(frd1?.id).toBe("FRD-01");
    expect(frd1?.title).toContain("Site shell");
    expect(frd1?.blueprint).toContain("layout [locale]");
    expect(frd1?.workOrders.map((w) => w.id)).toEqual(["WO-00-001", "WO-01-001"]);
    expect(frd1?.workOrders[0]?.desc).toContain("design system");
  });

  it("recognises a relational data model (no Sin-BD phrase) without the no-DB branch", () => {
    const withDb = `## 🗄️ Modelo de datos

Postgres con Prisma; tres tablas.

- **User** — id, email, role.
- **Order** — id, user_id, total.
`;
    const a = parseArchitecture(withDb);
    expect(a.dataModel?.isNone).toBe(false);
    expect(a.dataModel?.entities).toHaveLength(2);
  });

  it("degrades gracefully (hasContent:false) on empty or unrecognised input — never throws", () => {
    expect(parseArchitecture("").hasContent).toBe(false);
    expect(parseArchitecture("just some prose with no sections").hasContent).toBe(false);
    expect(parseArchitecture("# Title\n\nrandom").dataModel).toBeNull();
  });

  it("sets hasContent:true when at least one section parsed", () => {
    expect(parseArchitecture(REAL_DIGEST).hasContent).toBe(true);
  });
});
