import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuildModePicker } from "../BuildModePicker";

/** Reviewer-authored (DR-080): AC-11-005.1 and REQ-11-001/002/003 as the FDD states them. */
const COMMAND = "/pandacorp:implement";
const card = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("AC-11-005.1 the literal contract of the FDD", () => {
  it.each([
    {
      name: "Equilibrado",
      tag: "por defecto",
      power: 2,
      flag: "",
      hint: "Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x.",
    },
    {
      name: "Pro",
      tag: "pro",
      power: 1,
      flag: "pro",
      hint: "1 agente a la vez, modelos económicos (sonnet/haiku). Más lento, mínimo consumo. Para el plan Pro.",
    },
    {
      name: "Potente",
      tag: "powerful",
      power: 3,
      flag: "powerful",
      hint: "Hasta 5 agentes en paralelo → avanza más rápido. Para Max 20x.",
    },
    {
      name: "Profundo",
      tag: "deep",
      power: 4,
      flag: "deep",
      hint: "Mejores modelos en todos + revisión adversarial extra. Para un proyecto especial.",
    },
  ])("$name carries its tag, power, hint and flag", ({ name, tag, power, flag, hint }) => {
    render(<BuildModePicker project="alpha" />);
    const button = card(new RegExp(`^${name} `));
    expect(within(button).getByText(tag, { exact: true })).toBeInTheDocument();
    expect(within(button).getByText(hint)).toBeInTheDocument();
    expect(within(button).getByRole("img", { name: `Potencia ${power} de 4` })).toBeInTheDocument();
    expect(button).toHaveAttribute("data-mode", flag);
  });

  it("shows the intro and fills exactly N meter segments per card", () => {
    render(<BuildModePicker project="alpha" />);
    expect(
      screen.getByText("Con cuánta potencia se construye. Se recuerda por proyecto."),
    ).toBeInTheDocument();
    const segments = [...screen.getByRole("img", { name: "Potencia 3 de 4" }).children];
    expect(segments).toHaveLength(4);
    expect(segments.filter((segment) => segment.classList.contains("on"))).toHaveLength(3);
  });

  it("offers nothing that could run a command", () => {
    render(<BuildModePicker project="alpha" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("names the copy button after the command it copies", async () => {
    render(<BuildModePicker project="alpha" />);
    expect(screen.getByRole("button", { name: `Copiar ${COMMAND}` })).toBeInTheDocument();
    await userEvent.click(card(/^Profundo /));
    expect(screen.getByRole("button", { name: `Copiar ${COMMAND} deep` })).toBeInTheDocument();
  });

  it("selects on Enter as well as Space", async () => {
    const user = userEvent.setup();
    render(<BuildModePicker project="alpha" />);
    card(/^Pro /).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(`${COMMAND} pro`)).toBeInTheDocument();
  });
});

describe("REQ-11-003 remembered per project, in the browser only", () => {
  it("moves two mounted pickers of one project together and leaves another project alone", async () => {
    render(
      <>
        <BuildModePicker project="alpha" />
        <BuildModePicker project="alpha" />
        <BuildModePicker project="beta" />
      </>,
    );
    const [first] = screen.getAllByRole("button", { name: /^Potente / });
    await userEvent.click(first as HTMLElement);
    expect(screen.getAllByText(`${COMMAND} powerful`)).toHaveLength(2);
    expect(screen.getAllByText(COMMAND, { exact: true })).toHaveLength(1);
  });

  it("does not share a choice with a slug that prefixes it", () => {
    localStorage.setItem("mc:build-mode:funko", "deep");
    render(<BuildModePicker project="funko-tracker" />);
    expect(screen.getByText(COMMAND, { exact: true })).toBeInTheDocument();
  });

  it.each([
    "constructor",
    "__proto__",
    "toString",
    "valueOf",
  ])("opens Equilibrado for the slug %s, which names an Object.prototype member", async (project) => {
    render(<BuildModePicker project={project} />);
    expect(card(/^Equilibrado /)).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(card(/^Potente /));
    expect(screen.getByText(`${COMMAND} powerful`)).toBeInTheDocument();
  });

  it("stores Equilibrado again, so the next visit keeps it", async () => {
    localStorage.setItem("mc:build-mode:alpha", "deep");
    render(<BuildModePicker project="alpha" />);
    await userEvent.click(card(/^Equilibrado /));
    expect(localStorage.getItem("mc:build-mode:alpha")).toBe("balanced");
  });

  it.each([
    "",
    "   ",
    "null",
    "POWERFUL",
    "powerful ",
    '["deep"]',
    "__proto__",
  ])("opens Equilibrado over the stored value %j", (raw) => {
    localStorage.setItem("mc:build-mode:alpha", raw);
    render(<BuildModePicker project="alpha" />);
    expect(card(/^Equilibrado /)).toHaveAttribute("aria-pressed", "true");
  });

  it("hydrates over a blocked read without a recoverable error", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const element = <BuildModePicker project="alpha" />;
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, element, { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(host.textContent).toContain(COMMAND);
    await act(async () => root?.unmount());
  });
});

describe("REQ-11-002 the shown command never depends on storage working", () => {
  it("loses only the memory of the choice when the quota is full, not the choice", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    render(<BuildModePicker project="alpha" />);
    await userEvent.click(card(/^Potente /));
    expect(card(/^Potente /)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`${COMMAND} powerful`)).toBeInTheDocument();
  });

  it("still lets the owner reach every command with site data blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    render(<BuildModePicker project="alpha" />);
    await userEvent.click(card(/^Profundo /));
    expect(screen.getByText(`${COMMAND} deep`)).toBeInTheDocument();
  });
});

describe("REQ-11-002 the copied command is the shown command", () => {
  it("copies the new command right after a mode change", async () => {
    const user = userEvent.setup();
    render(<BuildModePicker project="alpha" />);
    await user.click(screen.getByRole("button", { name: `Copiar ${COMMAND}` }));
    expect(await navigator.clipboard.readText()).toBe(COMMAND);
    await user.click(card(/^Potente /));
    await user.click(screen.getByRole("button", { name: `Copiar ${COMMAND} powerful` }));
    expect(await navigator.clipboard.readText()).toBe(`${COMMAND} powerful`);
  });

  it("confirms a copy through the shared toast", async () => {
    const user = userEvent.setup();
    render(<BuildModePicker project="alpha" />);
    await user.click(screen.getByRole("button", { name: `Copiar ${COMMAND}` }));
    expect(await screen.findByRole("status")).toHaveTextContent("Copiado");
  });

  it("reports a blocked clipboard and never confirms it", async () => {
    const user = userEvent.setup();
    render(<BuildModePicker project="alpha" />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    await user.click(screen.getByRole("button", { name: `Copiar ${COMMAND}` }));
    const toast = await screen.findByRole("status");
    expect(toast).not.toHaveTextContent(/^Copiado/);
  });
});
