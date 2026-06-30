import { describe, expect, it } from "vitest";

import { nameToSlug } from "../slug";

describe("nameToSlug", () => {
  it("kebab-cases a display name with spaces and parentheses", () => {
    // The exact case that 404'd the whole project workspace: the dashboard links
    // route to this slug, so the [slug] resolver must derive the same value.
    expect(nameToSlug("Pandacorp (Mission Control)")).toBe("pandacorp-mission-control");
  });

  it("collapses runs of non-alphanumerics and trims leading/trailing dashes", () => {
    expect(nameToSlug("  PersonalPage v2 (Toshio.dev) ")).toBe("personalpage-v2-toshio-dev");
  });

  it("is idempotent on an already-slugged value", () => {
    expect(nameToSlug("pandacorp-mission-control")).toBe("pandacorp-mission-control");
  });
});
