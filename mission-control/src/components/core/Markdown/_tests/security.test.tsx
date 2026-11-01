import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Markdown } from "../Markdown";

it("never sends a document referrer to embedded images", () => {
  render(<Markdown>{"![External diagram](https://example.com/image.png)"}</Markdown>);
  expect(screen.getByRole("img", { name: "External diagram" })).toHaveAttribute(
    "referrerpolicy",
    "no-referrer",
  );
});
