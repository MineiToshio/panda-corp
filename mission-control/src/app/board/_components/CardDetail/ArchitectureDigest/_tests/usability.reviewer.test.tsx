import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArchitectureDigest } from "../ArchitectureDigest";

const BODY = `---
proyecto: Example
---
## Stack & tecnologías

| Capa | Elección | Por qué |
|---|---|---|
| Analytics | PostHog | Event capture |
| Forms | Web3Forms | Contact endpoint |

## Comunicación & servicios

- **PostHog** — Capture launch conversion and retain the operational event rationale.
- **Web3Forms** — POST client contact messages without a server runtime.
`;

function renderArchitecture() {
  render(
    <ArchitectureDigest
      title="Example"
      body={BODY}
      dataModel={{ kind: "missing" }}
      workOrders={[]}
      envVars={[{ name: "NEXT_PUBLIC_POSTHOG_KEY", comment: "Public analytics key" }]}
    />,
  );
}

describe("architecture reading order independent acceptance", () => {
  it("places integrations and operation between stack and data model, with environment separate", () => {
    renderArchitecture();
    // These existing bands expose no accessible names; their stable IDs identify their order.
    const stack = screen.getByTestId("arch-stack");
    const integrations = screen.getByTestId("arch-services");
    const model = screen.getByTestId("arch-data-model");
    const environment = screen.getByTestId("arch-env-block");
    expect(
      stack.compareDocumentPosition(integrations) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      integrations.compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(integrations).getByText(/Integraciones.*operaci[oó]n/i)).toBeVisible();
    expect(integrations).not.toContainElement(environment);
    expect(within(environment).getByText("NEXT_PUBLIC_POSTHOG_KEY")).toBeVisible();
  });

  it("preserves service-specific rationale even when the same vendor appears in the stack", () => {
    renderArchitecture();
    const integrations = within(screen.getByTestId("arch-services"));
    expect(integrations.getByText("PostHog")).toBeVisible();
    expect(integrations.getByText(/retain the operational event rationale/)).toBeVisible();
    expect(integrations.getByText("Web3Forms")).toBeVisible();
    expect(integrations.getByText(/without a server runtime/)).toBeVisible();
    expect(integrations.getAllByRole("listitem")).toHaveLength(2);
  });
});
