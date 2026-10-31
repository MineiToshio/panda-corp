import fs from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManualShell } from "../ManualShell";

describe("AC-08-020.3 reader layout contract (browser fidelity belongs to the reviewer)", () => {
  it("uses one title and delegates the main landmark to AppShell", () => {
    const { container } = render(<ManualShell pages={[]} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(container.querySelector("[data-screen='documentacion']")).toBeInTheDocument();
  });
  it("defines the right index and the 900px disclosure boundary with token-based paper styles", () => {
    const css = fs.readFileSync(
      "src/components/modules/DocumentReader/DocumentReader.module.css",
      "utf8",
    );
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) 280px");
    expect(css).toContain("max-width: 899px");
    expect(css).toContain("order: -1");
    expect(css).toContain('data-open="true"');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
