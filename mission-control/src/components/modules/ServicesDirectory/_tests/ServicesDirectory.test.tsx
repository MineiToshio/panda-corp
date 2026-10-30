import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { parseAccounts, parseProviders } from "@/lib/services/parsers";
import type { ServicesDirectoryData } from "@/lib/services/types";
import { directoryRows, ServicesDirectory } from "../ServicesDirectory";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { PortfolioViews } from "../PortfolioViews";

function data(): ServicesDirectoryData {
  const providers = parseProviders({
    schema_version: 1,
    providers: [
      {
        id: "neon",
        name: "Neon",
        type: "Database",
        purpose: "PostgreSQL per project",
        adoption: "base",
        dashboard_url: "https://console.neon.tech",
        reuse_policy: "One account",
        environment_policy: "Branches",
        automation: { methods: ["api"], status: "documented", steps: ["Create"] },
        quota_notes: "Check quota",
        sources: [{ url: "https://example.com/docs", checked_at: "2026-10-19" }],
      },
      {
        id: "modal",
        name: "Modal",
        type: "Compute",
        purpose: "Render posters",
        adoption: "optional",
        dashboard_url: "https://modal.com",
        reuse_policy: "Shared",
        environment_policy: "Separate apps",
        automation: { methods: ["cli"], status: "documented", steps: ["Deploy"] },
        quota_notes: "Zero spend",
        sources: [{ url: "https://example.com/docs", checked_at: "2026-10-19" }],
      },
    ],
  });
  const accounts = parseAccounts({
    schema_version: 1,
    accounts: [
      {
        id: "neon-main",
        provider_id: "neon",
        login_email: "first@example.com",
        display_name: "Main",
        access_status: "historical_identity_verified",
        observed_at: "2026-10-19",
        plan: "Free",
        accepting_new_projects: true,
        automation_status: "documented",
        next_step: null,
        notes: null,
      },
      {
        id: "neon-second",
        provider_id: "neon",
        login_email: "second@example.com",
        display_name: "Second",
        access_status: "unverified",
        observed_at: null,
        plan: null,
        accepting_new_projects: false,
        automation_status: "pending",
        next_step: "Verify",
        notes: null,
      },
    ],
  });
  return {
    providers,
    accounts,
    issues: [],
    allocations: [
      {
        integrationId: "database",
        projectId: "demo",
        projectName: "Demo Project",
        projectHref: "/portfolio/demo/accounts",
        providerId: "neon",
        accountRef: "neon-main",
        status: "observed",
        resources: [{ environment: "dev", resourceName: "demo-dev", nativeResourceId: null }],
      },
      {
        integrationId: "render",
        projectId: "other",
        projectName: "Other",
        projectHref: "/portfolio/other/accounts",
        providerId: "modal",
        accountRef: null,
        status: "proposed",
        resources: [],
      },
    ],
  };
}
describe("approved read-only account directory", () => {
  it("distinguishes multiple accounts and safe new-tab dashboards", () => {
    render(<ServicesDirectory data={data()} />);
    expect(screen.getByText("first@example.com", { selector: "summary span" })).toBeInTheDocument();
    expect(
      screen.getByText("second@example.com", { selector: "summary span" }),
    ).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Abrir panel ↗" })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
  it("searches by project and email, then filters honest candidates", async () => {
    const user = userEvent.setup();
    render(<ServicesDirectory data={data()} />);
    const search = screen.getByRole("searchbox");
    await user.type(search, "Demo Project");
    expect(
      screen.getByText("Main", { exact: false, selector: "summary span" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("second@example.com", { selector: "summary span" }),
    ).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "second@");
    expect(
      screen.queryByText("first@example.com", { selector: "summary span" }),
    ).not.toBeInTheDocument();
    await user.clear(search);
    await user.selectOptions(screen.getByRole("combobox"), "candidates");
    expect(screen.getByText("Modal", { selector: "summary strong" })).toBeInTheDocument();
    expect(screen.queryByText("Neon", { selector: "summary strong" })).not.toBeInTheDocument();
  });
  it("scopes project accounts without leaking unrelated identities", () => {
    const result = directoryRows(data(), "demo");
    expect(result).toHaveLength(1);
    expect(result[0]?.account?.id).toBe("neon-main");
    render(<ServicesDirectory data={data()} projectId="demo" />);
    expect(screen.queryByText("second@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Modal", { selector: "summary strong" })).not.toBeInTheDocument();
  });
  it("shows errors and missing bindings explicitly", () => {
    const model = data();
    model.issues = [{ source: "accounts", code: "invalid" }];
    render(<ServicesDirectory data={model} projectId="missing" />);
    expect(
      within(screen.getByRole("alert")).getByText(/no cumple el contrato/),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No hay vínculos");
  });
  it("AC-25-004.1 — global tabs keep selection and do not interpret accounts as a project slug", async () => {
    const user = userEvent.setup();
    render(<PortfolioViews href="/portfolio/demo/summary?unrelated=keep" accounts={false} />);
    await user.click(screen.getByRole("tab", { name: "Cuentas" }));
    expect(push).toHaveBeenCalledWith("/portfolio/demo/summary?unrelated=keep&view=cuentas");
  });
  it("returns from canonical Cuentas to projects and removes the legacy alias", async () => {
    const user = userEvent.setup();
    render(
      <PortfolioViews
        href="/portfolio/demo/summary?view=cuentas&portfolioView=accounts&unrelated=keep"
        accounts
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Proyectos" }));
    expect(push).toHaveBeenCalledWith("/portfolio/demo/summary?unrelated=keep");
  });
});
