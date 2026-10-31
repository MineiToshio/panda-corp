import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../Modal";

describe("Orbita native dialog", () => {
  it("uses native modal lifecycle and restores scroll styles on unmount", () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: close,
    });
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal
        open
        title="Detail"
        testIdBase="native"
        onClose={onClose}
        tone="teal"
        kicker="Context"
        footer={<button type="button">Done</button>}
      >
        Body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.tagName).toBe("DIALOG");
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("hidden");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(close).toHaveBeenCalledOnce();
    expect(document.documentElement.style.overflow).toBe("");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });
  it("traps both tab directions and does not reopen when the close callback changes", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open title="Trap" testIdBase="trap" onClose={onClose}>
        <button type="button">Body action</button>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    const last = screen.getByRole("button", { name: "Body action" });
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cerrar modal" })).toHaveFocus();
    last.focus();
    const latestClose = vi.fn();
    rerender(
      <Modal open title="Trap" testIdBase="trap" onClose={latestClose}>
        <button type="button">Body action</button>
      </Modal>,
    );
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Escape" });
    expect(latestClose).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
});
