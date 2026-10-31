import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DialogConfirm } from "../DialogConfirm";

const CSS = readFileSync("src/components/core/Modal/Dialog.module.css", "utf8");

function ruleOf(selector: string): string {
  return CSS.split(`${selector} {`)[1]?.split("}")[0] ?? "";
}

function ConfirmFixture(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <DialogConfirm
        open={open}
        title="Descartar"
        testIdBase="confirm"
        cancelLabel="Cancelar"
        confirmLabel="Descartar"
        reasonLabel="Motivo"
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

describe("Dialog independent review (WO-13-012)", () => {
  it("keeps the native top-layer fixed position so opening never scrolls the page", () => {
    expect(ruleOf(".dialog")).not.toMatch(/position:\s*(relative|static|absolute)/);
  });

  it("paints the backdrop token once", () => {
    expect(ruleOf(".dialog::backdrop")).toContain("var(--backdrop)");
    expect(ruleOf(".backdrop")).not.toContain("var(--backdrop)");
  });

  it("starts a reopened confirmation with an empty reason", async () => {
    const user = userEvent.setup();
    render(<ConfirmFixture />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.type(screen.getByLabelText("Motivo"), "anterior");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByLabelText("Motivo")).toHaveValue("");
  });
});
