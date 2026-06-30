/**
 * ArchitectureDigest — component tests. Renders the digest's stack table, the conditional "Sin BD"
 * branch, services + env, the ADR rows (clickable → modal) and the per-FRD cards (clickable →
 * modal with the work orders). The heavy WoDag (the live DAG, tested in its own suite) is mocked
 * so these tests stay fast and deterministic. Queries by role/name per the testing discipline.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the live DAG — its rendering (dagre/SVG/live snapshot) is exercised in WoDag's own tests.
vi.mock("@/app/projects/[slug]/_observability/WoDag/WoDag", () => ({
  WoDag: ({ workOrders }: { workOrders: unknown[] }) => (
    <div data-testid="wo-dag-mock">{workOrders.length} WOs</div>
  ),
}));

import { ArchitectureDigest } from "../ArchitectureDigest";

const DIGEST = `---
proyecto: "personal-page-v2"
fase: arquitectura
stack: "Next.js 16 · React 19 · Tailwind v4"
coste: "$0/mes"
host: "Vercel Hobby"
---

> Portfolio estático y bilingüe, sin base de datos.

## 🧱 Stack & tecnologías

| Capa | Elección | Por qué |
|---|---|---|
| Framework / UI | Next.js 16 | RSC, SSG por ruta |
| Hosting | Vercel Hobby | Estático, $0 |

## 🗄️ Modelo de datos

Sin base de datos — el contenido es código.

- **BlogPost** — posts MDX por locale.

## 🔌 Comunicación & servicios

- **Web3Forms** — POST cliente, sin server runtime.

## 🧩 Por FRD

### FRD-01 · Site shell
**Blueprint:** layout [locale] + nav + i18n.
**Work orders:**
- **WO-00-001** — design system.
`;

const ADRS = [
  {
    id: "ADR-0001",
    title: "Approved stack",
    decision: "Next.js on Vercel Hobby.",
    body: "# ADR-0001\n\nfull body.",
  },
];
const ENV = [{ name: "NEXT_PUBLIC_SITE_URL", comment: "Site URL" }];

function renderDigest() {
  return render(
    <ArchitectureDigest
      body={DIGEST}
      title="personal-page-v2"
      workOrders={[]}
      envVars={ENV}
      adrs={ADRS}
    />,
  );
}

describe("ArchitectureDigest", () => {
  it("renders the hero with the stack one-liner and host/coste chips", () => {
    renderDigest();
    expect(screen.getByRole("heading", { name: "personal-page-v2" })).toBeInTheDocument();
    expect(screen.getByText("Next.js 16 · React 19 · Tailwind v4")).toBeInTheDocument();
    expect(screen.getByTestId("arch-chip-host")).toHaveTextContent("Vercel Hobby");
    expect(screen.getByTestId("arch-chip-coste")).toHaveTextContent("$0/mes");
  });

  it("renders the stack matrix rows", () => {
    renderDigest();
    expect(screen.getByText("Framework / UI")).toBeInTheDocument();
    expect(screen.getByText("RSC, SSG por ruta")).toBeInTheDocument();
  });

  it("renders the 'Sin BD' branch with the content entities", () => {
    renderDigest();
    expect(screen.getByText(/Sin base de datos/)).toBeInTheDocument();
    expect(screen.getByText("BlogPost")).toBeInTheDocument();
  });

  it("renders the services and the live env vars", () => {
    renderDigest();
    expect(screen.getByText("Web3Forms")).toBeInTheDocument();
    expect(screen.getByText("NEXT_PUBLIC_SITE_URL")).toBeInTheDocument();
  });

  it("renders the implementation-plan DAG (the mocked WoDag)", () => {
    renderDigest();
    expect(screen.getByTestId("wo-dag-mock")).toBeInTheDocument();
  });

  it("opens an ADR modal with its body when an ADR row is clicked", () => {
    renderDigest();
    fireEvent.click(screen.getByRole("button", { name: /Approved stack/ }));
    expect(screen.getByText("full body.")).toBeInTheDocument();
  });

  it("opens an FRD modal listing its work orders when an FRD card is clicked", () => {
    renderDigest();
    fireEvent.click(screen.getByRole("button", { name: /FRD-01 Site shell/ }));
    expect(screen.getByText("WO-00-001")).toBeInTheDocument();
    expect(screen.getByText(/design system/)).toBeInTheDocument();
  });
});
