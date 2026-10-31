import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PersistentPage from "../[...segments]/page";
import { ManualShell } from "../ManualShell";

function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}
const pages = [
  {
    group: "tutorial",
    slug: "start-here",
    title: "Start here",
    order: 1,
    body: "Authored opening",
  },
];

describe("persistent documentation navigation", () => {
  it("preserves the home URL and restores addressed pages on popstate", () => {
    visit("/manual");
    render(<ManualShell pages={pages} />);
    expect(window.location.pathname).toBe("/manual");
    visit("/manual/tutorial/start-here");
    expect(screen.getByText("Authored opening")).toBeInTheDocument();
    visit("/manual");
    expect(screen.getByTestId("docs-home")).toBeInTheDocument();
  });
  it.each([
    ["commands", "skills"],
    ["agents", "agents"],
    ["rules", "rules"],
    ["standards", "standards"],
  ])("redirects legacy %s resources with query preservation and bounded item encoding", async (legacy, section) => {
    await expect(
      PersistentPage({
        params: Promise.resolve({ segments: ["reference", legacy, "a/b"] }),
        searchParams: Promise.resolve({ q: "term" }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(`/configuration/${section}/a%2Fb?q=term`),
    });
  });
  it("rejects unknown legacy sections without an open redirect", async () => {
    await expect(
      PersistentPage({
        params: Promise.resolve({ segments: ["reference", "https:evil"] }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
  it("seeds unknown authored groups so the bounded documentation empty state can render", async () => {
    const tree = await PersistentPage({
      params: Promise.resolve({ segments: ["unknown", "missing"] }),
      searchParams: Promise.resolve({ index: "1" }),
    });
    expect(tree.props.href).toBe("/manual/unknown/missing?index=1");
  });
});
