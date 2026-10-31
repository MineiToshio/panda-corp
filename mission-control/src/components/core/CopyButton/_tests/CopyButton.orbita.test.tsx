import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmdRow, CommandCompact } from "@/components/core/CmdRow/CmdRow";
import { CopyButton } from "../CopyButton";

afterEach(() => vi.useRealTimers());

describe("Orbita clipboard feedback", () => {
  it("copies the full selected command and dismisses the toast after 2.6 seconds", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(
      <CmdRow
        command="/pandacorp:build project"
        variant="box"
        modes={[{ flag: "--ask", label: "Ask" }]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "--ask" } });
    const button = screen.getByRole("button", { name: "Copiar /pandacorp:build project --ask" });
    await act(async () => fireEvent.click(button));
    expect(writeText).toHaveBeenCalledWith("/pandacorp:build project --ask");
    expect(screen.getByRole("status")).toHaveTextContent("Copiado al portapapeles");
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("restarts feedback for a second successful copy while the first toast is visible", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<CopyButton value="command" />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    act(() => vi.advanceTimersByTime(2_000));
    await act(async () => fireEvent.click(screen.getByRole("button")));
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByRole("status")).toHaveTextContent("Copiado al portapapeles");
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("shows an honest failure message and allows another attempt", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error("Blocked"))
      .mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<CopyButton value="command" />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(screen.getByRole("status")).toHaveTextContent("El navegador bloqueó el portapapeles");
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(screen.getByRole("status")).toHaveTextContent("Copiado al portapapeles");
  });
  it("exports a compact command without duplicating clipboard logic", () => {
    render(<CommandCompact command="/pandacorp:spec project" />);
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:spec project" }),
    ).toBeInTheDocument();
  });
});
