import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/core/Modal/Modal";

function FocusFixture({
  showModal = true,
  showOpener = true,
}: {
  showModal?: boolean;
  showOpener?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      {showOpener && (
        <button type="button" onClick={() => setOpen(true)}>
          Abrir detalle
        </button>
      )}
      <button type="button">Siguiente proyecto</button>
      {showModal && (
        <Modal open={open} onClose={() => setOpen(false)} title="Detalle" testIdBase="focus">
          <button type="button">Acción del diálogo</button>
        </Modal>
      )}
    </>
  );
}

describe("Modal focus restoration independent review", () => {
  it("returns focus to its opener after Escape, including a later reopen", async () => {
    const user = userEvent.setup();
    render(<FocusFixture />);
    const opener = screen.getByRole("button", { name: "Abrir detalle" });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await user.click(opener);
      expect(screen.getByRole("dialog", { name: "Detalle" })).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(opener).toHaveFocus();
    }
  });

  it("returns focus after closing with the dialog's close button", async () => {
    const user = userEvent.setup();
    render(<FocusFixture />);
    const opener = screen.getByRole("button", { name: "Abrir detalle" });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Cerrar modal" }));
    expect(opener).toHaveFocus();
  });

  it("restores focus when an open modal is unmounted with its opener still present", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FocusFixture />);
    const opener = screen.getByRole("button", { name: "Abrir detalle" });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Acción del diálogo" }));
    rerender(<FocusFixture showModal={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("does not focus a detached opener or steal focus after a project changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FocusFixture />);
    const opener = screen.getByRole("button", { name: "Abrir detalle" });
    await user.click(opener);
    const restore = vi.spyOn(opener, "focus");
    rerender(<FocusFixture showOpener={false} />);
    const nextProject = screen.getByRole("button", { name: "Siguiente proyecto" });
    await user.click(nextProject);
    rerender(<FocusFixture showModal={false} showOpener={false} />);
    expect(restore).not.toHaveBeenCalled();
    expect(nextProject).toHaveFocus();
    restore.mockRestore();
  });
});
