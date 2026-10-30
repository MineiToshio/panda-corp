/** WO-13-011 — fields, segmented control, switch, MoreBar and CopyText: keyboard-operable state through ARIA. REQ-13-009. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyText } from "../../CopyText/CopyText";
import { allReveal, MoreBar, pagedReveal } from "../../MoreBar/MoreBar";
import { Segmented } from "../../Segmented/Segmented";
import { SearchField, SelectField, Switch } from "../Field";

describe("AC-13-010.1: field family", () => {
  it("AC-13-010.1: search and select are labelled; switch and segmented expose state through ARIA", () => {
    const onSearch = vi.fn();
    const onSwitch = vi.fn();
    const onSeg = vi.fn();
    render(
      <>
        <SearchField label="Buscar proyecto" value="" onChange={onSearch} />
        <SelectField
          label="Fase"
          value="a"
          options={[{ value: "a", label: "A" }]}
          onChange={onSearch}
        />
        <Switch label="Mostrar todo" checked={false} onChange={onSwitch} />
        <Segmented
          label="Vista"
          value="x"
          options={[
            { value: "x", label: "X" },
            { value: "y", label: "Y" },
          ]}
          onChange={onSeg}
        />
      </>,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar proyecto" }), {
      target: { value: "ab" },
    });
    expect(onSearch).toHaveBeenCalledWith("ab");
    expect(screen.getByRole("combobox", { name: "Fase" })).toBeTruthy();
    const sw = screen.getByRole("switch", { name: "Mostrar todo" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(onSwitch).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "X" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Y" }));
    expect(onSeg).toHaveBeenCalledWith("y");
  });

  it("AC-13-010.1: MoreBar arithmetic follows the prototype and the bar holds only the caller's label", () => {
    expect(pagedReveal(24, 0, 10)).toEqual({ visible: 10, remaining: 14, next: 14 });
    expect(pagedReveal(17, 0, 15)).toEqual({ visible: 15, remaining: 2, next: 2 });
    expect(pagedReveal(60, 1, 12, 24)).toEqual({ visible: 36, remaining: 24, next: 24 });
    expect(allReveal(30, 10, false)).toEqual({ visible: 10, remaining: 20, next: 20 });
    expect(allReveal(30, 10, true).remaining).toBe(0);
    const onClick = vi.fn();
    render(<MoreBar label="Mostrar 14 más · quedan 14" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 14 más · quedan 14" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("AC-13-010.1: CopyText copies the exact text and reports a blocked clipboard", async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("blocked"));
    Object.assign(navigator, { clipboard: { writeText } });
    const onResult = vi.fn();
    render(<CopyText text="/pandacorp:spec" onResult={onResult} />);
    const btn = screen.getByRole("button", { name: "Copiar /pandacorp:spec" });
    fireEvent.click(btn);
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(true));
    expect(writeText).toHaveBeenCalledWith("/pandacorp:spec");
    fireEvent.click(btn);
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));
  });
});
