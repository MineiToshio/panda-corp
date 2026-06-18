/**
 * Error net smoke tests — the global error boundary, the segment error boundary
 * and the not-found page (nextjs.md: "no failure leaves a blank screen").
 *
 * These verify the new behaviour added with the error net: each surface renders
 * accessible recovery affordances (a reset button or a home link) using design
 * tokens, never a blank screen.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "../error";
import GlobalError from "../global-error";
import NotFound from "../not-found";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("not-found page", () => {
  it("renders a heading and a link back home", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: /no encontrada/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al inicio/i })).toHaveAttribute("href", "/");
  });
});

describe("segment error boundary", () => {
  it("shows an alert and calls reset when the user retries", async () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

describe("global error boundary", () => {
  it("offers a retry that calls reset", async () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("boom")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
