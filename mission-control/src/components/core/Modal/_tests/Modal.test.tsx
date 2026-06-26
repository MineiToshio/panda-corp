/**
 * Modal — reusable overlay dialog (core primitive). Tests the shared chrome:
 * open/closed rendering, title + badge, accessibility contract, and the three
 * close paths (backdrop, ✕, Escape). Content-specific modals (IntakeModal, the
 * discarded-ideas modal) get their own tests for their bodies.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "@/components/core/Modal/Modal";

function renderModal(overrides?: { open?: boolean; onClose?: () => void }) {
  const onClose = overrides?.onClose ?? vi.fn();
  render(
    <Modal
      open={overrides?.open ?? true}
      onClose={onClose}
      title="Mi modal"
      testIdBase="demo"
      badge={<span data-testid="demo-badge">BADGE</span>}
    >
      <p data-testid="demo-body">contenido</p>
    </Modal>,
  );
  return { onClose };
}

describe("Modal — rendering", () => {
  it("does not render anything when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByTestId("demo-modal")).not.toBeInTheDocument();
  });

  it("renders the panel, title, badge and children when open", () => {
    renderModal();
    expect(screen.getByTestId("demo-modal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mi modal" })).toBeInTheDocument();
    expect(screen.getByTestId("demo-badge")).toBeInTheDocument();
    expect(screen.getByTestId("demo-body")).toBeInTheDocument();
  });

  it("derives the backdrop and close testids from testIdBase", () => {
    renderModal();
    expect(screen.getByTestId("demo-backdrop")).toBeInTheDocument();
    expect(screen.getByTestId("demo-close")).toBeInTheDocument();
  });
});

describe("Modal — accessibility", () => {
  it("is a dialog with aria-modal and the title as its accessible name", () => {
    renderModal();
    const dialog = screen.getByRole("dialog", { name: "Mi modal" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("uses an explicit ariaLabel when provided", () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Título visible"
        ariaLabel="Nombre accesible"
        testIdBase="d2"
      >
        <p>x</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Nombre accesible" })).toBeInTheDocument();
  });
});

describe("Modal — close paths", () => {
  it("calls onClose when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId("demo-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the ✕ button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId("demo-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when the panel itself is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId("demo-body"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
