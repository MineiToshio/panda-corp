import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { ChangeQueueItem, ChangeQueueStatus } from "@/lib/changes/changes";
import { discardChangeAction } from "../../../_actions/discard-change";
import { ChangesPanel } from "../ChangesPanel";

vi.mock("../../../_actions/discard-change", () => ({ discardChangeAction: vi.fn() }));
beforeEach(() => {
  window.history.replaceState(null, "", "/portfolio/project/changes");
  vi.clearAllMocks();
});
function item(status: ChangeQueueStatus): ChangeQueueItem {
  return {
    id: status,
    title: `Change ${status}`,
    status,
    type: "bug",
    cls: "expedite",
    date: "2026-10-19",
    frd: "FRD-04",
    dependsOn: "WO-04-001",
    rebuildsVerified: true,
    body: "## Context\nPublished body",
    implementedSha: "secret-sha",
    closingAt: "secret-time",
  };
}
function mount(status: ChangeQueueStatus) {
  render(
    <ChangesPanel
      result={{ items: [item(status)], errors: [] }}
      projectPath="/tmp/project"
      slug="project"
    />,
  );
}
it.each([
  "ready",
  "draft",
  "building",
  "closing",
  "done",
  "discarded",
] as const)("REQ-04-010: %s dialog scopes build and restricts discard", async (status) => {
  const user = userEvent.setup();
  mount(status);
  if (status === "done" || status === "discarded")
    await user.click(screen.getByText("Historial 1"));
  const trigger = screen.getByRole("button", { name: /Change / });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(`/pandacorp:implement change:${status}`)).toBeInTheDocument();
  expect(within(dialog).getByText("Rehace trabajo ya verificado")).toBeInTheDocument();
  expect(within(dialog).getByText("Urgente")).toBeInTheDocument();
  expect(dialog).not.toHaveTextContent("secret-sha");
  expect(dialog).not.toHaveTextContent("secret-time");
  expect(within(dialog).queryByRole("button", { name: "Descartar cambio" }) !== null).toBe(
    status === "ready" || status === "draft",
  );
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
it("REQ-04-008: confirmation replaces detail, cancels on Escape and sends optional reason", async () => {
  const user = userEvent.setup();
  mount("ready");
  await user.click(screen.getByRole("button", { name: /Change ready/ }));
  await user.click(screen.getByRole("button", { name: "Descartar cambio" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog")).not.toHaveTextContent("Published body");
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toHaveTextContent("Published body");
  await user.click(screen.getByRole("button", { name: "Descartar cambio" }));
  await user.type(screen.getByRole("textbox", { name: /Motivo/ }), "Duplicate");
  vi.mocked(discardChangeAction).mockResolvedValue({ ok: false, reason: "not-discardable" });
  await user.click(screen.getByRole("button", { name: "Descartar" }));
  expect(screen.getByRole("alert")).toHaveTextContent("ya no se puede descartar");
  expect(screen.getByRole("textbox")).toHaveValue("Duplicate");
  vi.mocked(discardChangeAction).mockResolvedValue({ ok: true });
  await user.click(screen.getByRole("button", { name: "Descartar" }));
  expect(discardChangeAction).toHaveBeenLastCalledWith(
    "/tmp/project",
    "ready",
    "project",
    "Duplicate",
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("REQ-04-007: malformed sources are named without claiming an empty queue", () => {
  render(
    <ChangesPanel
      result={{ items: [], errors: [{ file: "broken.md", reason: "invalid" }] }}
      projectPath="/tmp/project"
      slug="project"
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("broken.md");
  expect(screen.queryByText("No hay cambios abiertos en la cola.")).not.toBeInTheDocument();
});
it("REQ-04-009: empty queue still offers the change command", () => {
  render(
    <ChangesPanel result={{ items: [], errors: [] }} projectPath="/tmp/project" slug="project" />,
  );
  expect(screen.getByText("No hay cambios abiertos en la cola.")).toBeInTheDocument();
  expect(screen.getByText("/pandacorp:change")).toBeInTheDocument();
});

it.each([
  "not-found",
  "parse-error",
] as const)("REQ-04-008: %s stays visible inside confirmation", async (reason) => {
  const user = userEvent.setup();
  mount("ready");
  await user.click(screen.getByRole("button", { name: /Change ready/ }));
  await user.click(screen.getByRole("button", { name: "Descartar cambio" }));
  vi.mocked(discardChangeAction).mockResolvedValue({ ok: false, reason });
  await user.click(screen.getByRole("button", { name: "Descartar" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("textbox")).toBeInTheDocument();
});

it("REQ-04-008: Back from confirmation then opening history shows detail", async () => {
  const user = userEvent.setup();
  render(
    <ChangesPanel
      result={{ items: [item("ready"), item("done")], errors: [] }}
      projectPath="/tmp/project"
      slug="project"
    />,
  );
  await user.click(screen.getByRole("button", { name: /Change ready/ }));
  await user.click(screen.getByRole("button", { name: "Descartar cambio" }));
  act(() => {
    window.history.replaceState(null, "", "/portfolio/project/changes");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByText("Historial 1"));
  await user.click(screen.getByRole("button", { name: /Change done/ }));
  expect(screen.getByRole("dialog", { name: "Change done" })).toHaveTextContent("Published body");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("REQ-04-008: cancel clears discard failure and caps the reason", async () => {
  const user = userEvent.setup();
  mount("ready");
  await user.click(screen.getByRole("button", { name: /Change ready/ }));
  await user.click(screen.getByRole("button", { name: "Descartar cambio" }));
  expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "2000");
  expect(screen.getByRole("button", { name: "Descartar" })).toHaveAttribute(
    "data-variant",
    "danger",
  );
  vi.mocked(discardChangeAction).mockResolvedValue({ ok: false, reason: "not-found" });
  await user.click(screen.getByRole("button", { name: "Descartar" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  await user.click(screen.getByRole("button", { name: "Descartar cambio" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
