import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { servicesFixture } from "@/lib/services/_tests/fixture";
import { AccountsDirectory } from "../AccountsDirectory";
import { ProjectAccounts } from "../ProjectAccounts";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => window.history.replaceState(null, "", "/portfolio?view=cuentas&keep=yes"));
describe("accounts acceptance", () => {
  it("AC-26-001.1 AC-26-003.1 AC-26-010.1: works independently of project selection, separates identities and opens safe dashboards", () => {
    render(<AccountsDirectory data={servicesFixture()} />);
    expect(screen.getByRole("table", { name: "Cuentas de la fábrica" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copiar el usuario de Neon: first@example.com" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /second@example.com/ })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: /Neon/ })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
  it("AC-26-005.1: exclusive states, search by project/email and URL filters", async () => {
    const user = userEvent.setup();
    render(<AccountsDirectory data={servicesFixture()} />);
    expect(screen.getByRole("button", { name: "Activas 1" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "Demo Project");
    expect(screen.queryByRole("button", { name: /second@example.com/ })).not.toBeInTheDocument();
    expect(location.search).toContain("accountsQuery=Demo+Project");
    await user.clear(screen.getByRole("searchbox"));
    await user.click(screen.getByRole("button", { name: "Candidatos 1" }));
    expect(location.search).toContain("accountsState=candidates");
    expect(location.search).toContain("keep=yes");
    expect(screen.queryByRole("link", { name: /Neon/ })).not.toBeInTheDocument();
    expect(screen.getByText("Candidato")).toBeInTheDocument();
  });
  it("AC-26-004.1: keyboard detail, recipe, dated facts, resources, focus return", async () => {
    const user = userEvent.setup();
    render(<AccountsDirectory data={servicesFixture()} />);
    const opener = screen.getByRole("button", { name: "Detalles: Main" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", {
        name: "Copiar el usuario de Neon: first@example.com",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("2026-10-19", { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText("demo-dev", { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText("One account")).toBeInTheDocument();
    expect(within(dialog).getByText("Create")).toBeInTheDocument();
    expect(location.search).toContain("account=neon");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
  it("AC-26-006.1 AC-26-007.1 AC-26-008.1 AC-26-011.1: project-only, bounded notice, ordered table, copy and responsive captions", async () => {
    const user = userEvent.setup();
    const model = servicesFixture();
    model.issues = [{ source: "services/accounts.yaml", code: "invalid" }];
    const allocation = model.allocations[0];
    if (!allocation) throw new Error("Missing fixture allocation");
    model.allocations.push({
      ...allocation,
      integrationId: "extra",
      status: "configured",
    });
    const { container } = render(<ProjectAccounts data={model} projectId="demo" />);
    expect(screen.getByRole("alert")).toHaveTextContent("no cumple el contrato");
    expect(screen.queryByText("second@example.com")).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Configurado");
    const copy = screen
      .getAllByRole("button", { name: "Copiar el usuario de Neon: first@example.com" })
      .at(0);
    if (!copy) throw new Error("Missing login");
    await user.click(copy);
    expect(await navigator.clipboard.readText()).toBe("first@example.com");
    expect(container.querySelector('td[data-label="Entornos"] .chip')).toHaveAttribute(
      "data-tone",
      "teal",
    );
    expect(container.querySelector(".acc-table")).toBeInTheDocument();
  });
  it("AC-26-006.1: explicit empty project and no-match directory", async () => {
    const { unmount } = render(<ProjectAccounts data={servicesFixture()} projectId="missing" />);
    expect(screen.getByText(/no tiene servicios asignados/)).toBeInTheDocument();
    unmount();
    render(<AccountsDirectory data={servicesFixture()} />);
    await userEvent.setup().type(screen.getByRole("searchbox"), "no such service");
    expect(screen.getByText(/No hay coincidencias/)).toBeInTheDocument();
  });
});

it("AC-26-003.1 AC-26-011.1: missing project cells use explicit faint placeholders", () => {
  const model = servicesFixture();
  const allocation = model.allocations[0];
  if (!allocation) throw new Error("Missing fixture allocation");
  allocation.accountRef = null;
  allocation.resources = [];
  render(<ProjectAccounts data={model} projectId="demo" />);
  expect(screen.getAllByText("−")).toHaveLength(2);
});
