import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { servicesFixture } from "@/lib/services/_tests/fixture";
import { AccountsDirectory } from "../AccountsDirectory";
import { ProjectAccounts } from "../ProjectAccounts";

beforeEach(() => window.history.replaceState(null, "", "/portfolio?view=cuentas"));

async function openDialog(name: string) {
  const user = userEvent.setup();
  render(<AccountsDirectory data={servicesFixture()} />);
  await user.click(screen.getByRole("button", { name }));
  return { user, dialog: screen.getByRole("dialog") };
}

describe("account row contract", () => {
  it("AC-26-003.1: each row shows the provider type, the organization and a dated access status", () => {
    render(<AccountsDirectory data={servicesFixture()} />);
    const row = screen.getByRole("button", { name: /first@example.com/ }).closest("tr");
    if (!row) throw new Error("row");
    expect(within(row).getByText("Database")).toBeInTheDocument();
    expect(within(row).getByText("Main")).toBeInTheDocument();
    expect(within(row).getByText(/2026|oct/)).toBeInTheDocument();
  });
  it("AC-26-011.1: a failed clipboard write is reported, never silent", async () => {
    const user = userEvent.setup();
    render(<ProjectAccounts data={servicesFixture()} projectId="demo" />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("blocked"));
    await user.click(screen.getByRole("button", { name: /first@example.com/ }));
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });
  it("AC-26-005.1: the filter never prints a raw key and an unsupported value keeps every row", () => {
    window.history.replaceState(null, "", "/portfolio?view=cuentas&accountsState=bogus");
    render(<AccountsDirectory data={servicesFixture()} />);
    expect(screen.getByText("3 cuentas")).toBeInTheDocument();
    expect(screen.queryByText("candidates")).not.toBeInTheDocument();
  });
  it("AC-26-005.1: the count line is singular at exactly one row", async () => {
    const user = userEvent.setup();
    render(<AccountsDirectory data={servicesFixture()} />);
    await user.click(screen.getByRole("button", { name: "Pendientes 1" }));
    expect(screen.getByText("1 cuenta")).toBeInTheDocument();
  });
  it("AC-26-007.1: the notice keeps the table usable and names only file and reason", () => {
    const data = servicesFixture();
    data.issues = [{ source: "services/accounts.yaml", code: "dangling" }];
    render(<AccountsDirectory data={data} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("services/accounts.yaml");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("AC-26-006.1: the project tab lists no provider the project did not declare", () => {
    render(<ProjectAccounts data={servicesFixture()} projectId="demo" />);
    expect(screen.queryByRole("link", { name: /Modal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /second@example.com/ })).not.toBeInTheDocument();
  });
});

describe("account dialog contract", () => {
  it("AC-26-004.1: a candidate row reports the provider's automation evidence, not an invented pending", async () => {
    const { dialog } = await openDialog("Detalles: Modal");
    expect(within(dialog).getByText("Documentada, sin prueba registrada")).toBeInTheDocument();
  });
  it("AC-26-004.1: a provider with no account states no acceptance fact about a nonexistent account", async () => {
    const { dialog } = await openDialog("Detalles: Modal");
    expect(within(dialog).queryByText("Acepta proyectos nuevos")).not.toBeInTheDocument();
  });
  it("AC-26-004.1: the linked project line carries its state in the project", async () => {
    const data = servicesFixture();
    const allocation = data.allocations[0];
    if (!allocation) throw new Error("fixture");
    allocation.status = "configured";
    const user = userEvent.setup();
    render(<AccountsDirectory data={data} />);
    await user.click(screen.getByRole("button", { name: "Detalles: Main" }));
    expect(within(screen.getByRole("dialog")).getByText(/Configurado/)).toBeInTheDocument();
  });
  it("AC-26-004.1: the public recipe includes its environment policy", async () => {
    const { dialog } = await openDialog("Detalles: Main");
    expect(within(dialog).getByText(/Branches/)).toBeInTheDocument();
  });
  it("AC-26-003.1: the dialog's dashboard link announces the new tab", async () => {
    const { dialog } = await openDialog("Detalles: Main");
    const link = within(dialog).getByRole("link", { name: /Abrir el panel de Neon/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAccessibleName(/pestaña nueva/);
  });
  it("AC-26-004.1: Escape closes, the URL key goes and focus returns to the opener", async () => {
    const { user } = await openDialog("Detalles: Main");
    expect(location.search).toContain("account=neon%3Aneon-main");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(location.search).not.toContain("account=");
    expect(screen.getByRole("button", { name: "Detalles: Main" })).toHaveFocus();
  });
});
