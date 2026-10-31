/**
 * ArchitectureDigest — component tests. Renders the digest's stack table, the conditional "Sin BD"
 * branch, services + env, the ADR rows (clickable → modal) and the per-FRD cards (clickable →
 * modal with the work orders). The heavy WoDag (the live DAG, tested in its own suite) is mocked
 * so these tests stay fast and deterministic. Queries by role/name per the testing discipline.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

  it("AC-02-013.2: renders the stack matrix rows", () => {
    renderDigest();
    const stack = screen.getByRole("table");
    expect(
      within(stack)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Capa", "Elección", "Por qué"]);
    expect(within(stack).getByText("Framework / UI")).toBeInTheDocument();
    expect(screen.getByText("RSC, SSG por ruta")).toBeInTheDocument();
  });

  it("renders the 'Sin BD' branch with the content entities", () => {
    renderDigest();
    expect(screen.getByText(/Sin base de datos/)).toBeInTheDocument();
    expect(screen.getByText("BlogPost")).toBeInTheDocument();
  });

  it("AC-02-013.4: renders the services and the live env vars", () => {
    renderDigest();
    expect(screen.getByText("Web3Forms")).toBeInTheDocument();
    expect(screen.getByText("NEXT_PUBLIC_SITE_URL")).toBeInTheDocument();
  });

  it("AC-02-013.3: before construction renders the live planned count", () => {
    renderDigest();
    expect(
      within(screen.getByTestId("arch-plan")).getByText("0 work orders planificadas", {
        selector: "p",
      }),
    ).toBeInTheDocument();
  });

  it("opens an ADR modal with its body when an ADR row is clicked", () => {
    renderDigest();
    fireEvent.click(screen.getByRole("button", { name: /Approved stack/ }));
    expect(screen.getByText("full body.")).toBeInTheDocument();
  });

  it("AC-02-013.5: opens an FRD modal without inventing work orders from digest prose", () => {
    renderDigest();
    fireEvent.click(screen.getByRole("button", { name: /FRD-01 Site shell/ }));
    expect(screen.queryByText("WO-00-001")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByText("0 work orders planificadas"),
    ).toBeVisible();
  });
});

// --- FRD card "N WOs" badge — derived from disk (workOrdersForFrd), not digest prose ---

describe("ArchitectureDigest — FRD card WO-count badge derives from disk", () => {
  it("shows 0 (no badge) when the digest lists a WO the disk doesn't have (workOrders=[])", () => {
    renderDigest();
    // DIGEST's FRD-01 prose lists "WO-00-001", but the live `workOrders` prop is [] —
    // the badge must NOT show "1 WO" from the prose; it shows nothing (disk truth: 0).
    const card = screen.getByRole("button", { name: /FRD-01 Site shell/ });
    expect(within(card).queryByText(/WO$/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/WOs$/)).not.toBeInTheDocument();
  });

  it("shows the REAL disk count even when it differs from the digest prose's single WO", () => {
    const liveWos = [
      {
        id: "WO-01-001",
        title: "a",
        frd: "frd-01-site-shell",
        state: "todo" as const,
        relPath: "a.md",
      },
      {
        id: "WO-01-002",
        title: "b",
        frd: "frd-01-site-shell",
        state: "todo" as const,
        relPath: "b.md",
      },
    ];
    render(
      <ArchitectureDigest
        body={DIGEST}
        title="personal-page-v2"
        workOrders={liveWos}
        envVars={ENV}
        adrs={ADRS}
      />,
    );
    const card = screen.getByRole("button", { name: /FRD-01 Site shell/ });
    // Disk has 2 WOs for frd-01 even though the prose only lists one ("WO-00-001").
    expect(within(card).getByText("2 work orders planificadas")).toBeInTheDocument();
  });
});

// --- Per-FRD dependency DAG inside the FRD modal (only when > 1 work order) ---

const DIGEST_TWO_FRDS = `---
proyecto: "p"
fase: arquitectura
---

## 🧩 Por FRD

### FRD-01 · Site shell
**Blueprint:** la fundación.
- **WO-01-001** — shell.

### FRD-02 · Home
**Blueprint:** la home.
- **WO-02-001** — home.
`;

// FRD-01 has TWO live work orders (→ a scoped DAG); FRD-02 has ONE (→ no DAG).
const LIVE_WOS = [
  {
    id: "WO-01-001",
    title: "Shell",
    frd: "frd-01-site-shell",
    state: "todo" as const,
    relPath: "a.md",
  },
  {
    id: "WO-01-002",
    title: "i18n",
    frd: "frd-01-site-shell",
    state: "todo" as const,
    relPath: "b.md",
    dependsOn: ["WO-01-001"],
  },
  { id: "WO-02-001", title: "Home", frd: "frd-02-home", state: "todo" as const, relPath: "c.md" },
];

describe("ArchitectureDigest — per-FRD dependency DAG", () => {
  function renderTwoFrds() {
    render(<ArchitectureDigest body={DIGEST_TWO_FRDS} title="p" workOrders={LIVE_WOS} />);
  }

  it("AC-02-013.6: ends with live orders and links, without the removed scoped DAG", () => {
    renderTwoFrds();
    fireEvent.click(screen.getByRole("button", { name: /FRD-01 Site shell/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("WO-01-001")).toBeVisible();
    expect(within(dialog).queryByText("WO-02-001")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arch-frd-dag")).not.toBeInTheDocument();
  });

  it("does NOT show the scoped DAG in the modal of an FRD with a single work order", () => {
    renderTwoFrds();
    fireEvent.click(screen.getByRole("button", { name: /FRD-02 Home/ }));
    expect(screen.queryByTestId("arch-frd-dag")).not.toBeInTheDocument();
  });
});

it("restores a published ADR dialog from its copied URL", () => {
  window.history.replaceState({}, "", "/portfolio/registered/architecture?adr=ADR-0001");
  renderDigest();
  expect(screen.getByRole("dialog")).toHaveTextContent("full body.");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
  expect(window.location.search).not.toContain("adr");
});

it("shows an unavailable state for an unknown ADR instead of opening another item", () => {
  window.history.replaceState({}, "", "/portfolio/registered/architecture?adr=ADR-404");
  renderDigest();
  expect(screen.getByRole("status")).toHaveTextContent("El ADR seleccionado no está disponible.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("shows FRD titles beside mosaic ids and the plan explanation", () => {
  render(
    <ArchitectureDigest
      body={DIGEST_TWO_FRDS}
      title="p"
      workOrders={LIVE_WOS}
      constructionStarted
    />,
  );
  expect(screen.getByText("FRD-01 Site shell")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Por FRD" })).toBeVisible();
  expect(screen.getByText(/Cada fila es un FRD y cada cuadro/)).toBeVisible();
});

it("keeps valid work-order tiles beside a broken file notice in the partial plan", () => {
  render(
    <ArchitectureDigest
      body={DIGEST_TWO_FRDS}
      title="p"
      workOrders={LIVE_WOS}
      constructionStarted
      sourceErrors={{
        workOrderFiles: [
          {
            file: "docs/frds/frd-01-site-shell/work-orders/wo-01-003-broken.md",
            reason: "invalid implementation_status",
          },
        ],
      }}
    />,
  );
  const plan = within(screen.getByTestId("arch-plan"));
  expect(plan.getByRole("alert")).toHaveTextContent("wo-01-003-broken.md");
  expect(plan.getByRole("alert")).toHaveTextContent("implementation_status no es PLANNED");
  expect(plan.getAllByRole("img", { name: /^WO-/ })).toHaveLength(LIVE_WOS.length);
  for (const order of LIVE_WOS) {
    expect(
      plan.getByRole("img", { name: new RegExp(`${order.id} · ${order.title}`) }),
    ).toBeVisible();
  }
  expect(plan.queryByRole("img", { name: /WO-01-003/ })).not.toBeInTheDocument();
  expect(plan.getByText("FRD-01 Site shell")).toBeVisible();
  expect(plan.getByText("FRD-02 Home")).toBeVisible();
});
