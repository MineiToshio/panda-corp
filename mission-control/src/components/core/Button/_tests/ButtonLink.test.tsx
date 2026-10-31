import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "../ButtonLink";

describe("ButtonLink", () => {
  it("renders navigation with the shared button style and requested size", () => {
    render(
      <ButtonLink href="/board" look="button" size="sm">
        Back
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Back" });
    expect(link).toHaveAttribute("href", "/board");
    expect(link).toHaveAttribute("data-size", "sm");
    expect(link.className).toMatch(/btn/);
  });
});
