import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DataModelViewer } from "../DataModelViewer";
import { readyFixture } from "./fixture";
import { waitForLayout } from "./waitForLayout";

afterEach(cleanup);

async function ready() {
  render(<DataModelViewer result={readyFixture()} />);
  await waitForLayout();
  fireEvent.click(screen.getByText(/^Relaciones/));
  await screen.findByRole("button", { name: "Ver relación Propiedad" });
}

describe("model usability independent acceptance", () => {
  it.each([
    "click",
    "Enter",
    " ",
  ])("toggles a selected relationship off with %s", async (gesture) => {
    await ready();
    const relation = screen.getByRole("button", { name: "Ver relación Propiedad" });
    const user = userEvent.setup();
    const activate = async () => {
      if (gesture === "click") {
        await user.click(relation);
        return;
      }
      relation.focus();
      await user.keyboard(gesture === "Enter" ? "{Enter}" : " ");
    };
    await activate();
    expect(relation).toHaveAttribute("aria-pressed", "true");
    await activate();
    expect(relation).toHaveAttribute("aria-pressed", "false");
  });

  it("switches directly between relations and preserves entity-highlight behavior", async () => {
    await ready();
    const ownership = screen.getByRole("button", { name: "Ver relación Propiedad" });
    const review = screen.getByRole("button", { name: "Ver relación Revisión" });
    fireEvent.click(ownership);
    fireEvent.click(review);
    expect(ownership).toHaveAttribute("aria-pressed", "false");
    expect(review).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar entidad Account" }));
    // An entity neighbourhood lights connectors without explicitly selecting their rows.
    expect(ownership).toHaveAttribute("aria-pressed", "false");
    expect(review).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(review);
    expect(review).toHaveAttribute("aria-pressed", "true");
    expect(ownership).toHaveAttribute("aria-pressed", "false");
  });

  it("starts schema entities collapsed and opens each on demand without losing fields, keys or mappings", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByRole("button", { name: "Esquema" }));
    const accountCode = screen.getByText(/model Account \{/);
    const entryCode = screen.getByText(/model Entry \{/);
    expect(accountCode).not.toBeVisible();
    expect(entryCode).not.toBeVisible();
    // Native summary has no implicit button role in the installed DOM accessibility API.
    const account = screen.getByText("Account");
    const entry = screen.getByText("Entry");
    await user.click(account);
    expect(accountCode).toBeVisible();
    expect(accountCode).toHaveTextContent("accountId");
    expect(accountCode).toHaveTextContent("uuid");
    expect(accountCode).toHaveTextContent("email");
    expect(accountCode).toHaveTextContent("text?");
    expect(accountCode).toHaveTextContent("fields: [accountId], references: [ownerId]");
    expect(accountCode).toHaveTextContent('"Revisión"');
    expect(entryCode).not.toBeVisible();
    await user.click(account);
    expect(accountCode).not.toBeVisible();
    await user.click(entry);
    expect(accountCode).not.toBeVisible();
    expect(entryCode).toBeVisible();
    expect(entryCode).toHaveTextContent("@@unique([ownerId, reviewerId])");
    expect(entryCode).toHaveTextContent('"Referencia propia"');
    await user.click(entry);
    expect(entryCode).not.toBeVisible();
  });
});
