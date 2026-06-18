import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  IDEAS_DIR,
  NON_IDEA_FILES,
  PORTFOLIO,
  PROFILE,
  projectStatusPath,
  resolveFactoryRoot,
} from "./config";

describe("resolveFactoryRoot", () => {
  it("uses the PANDACORP_FACTORY_ROOT override when set", () => {
    expect(resolveFactoryRoot("/tmp/some-factory", "/anywhere/mission-control")).toBe(
      path.resolve("/tmp/some-factory"),
    );
  });

  it("trims and ignores an empty override", () => {
    expect(resolveFactoryRoot("   ", "/Users/x/panda-corp/mission-control")).toBe(
      path.resolve("/Users/x/panda-corp"),
    );
  });

  it("falls back to one level up from the cwd (MC lives inside the factory)", () => {
    expect(resolveFactoryRoot(undefined, "/Users/x/panda-corp/mission-control")).toBe(
      path.resolve("/Users/x/panda-corp"),
    );
  });

  it("normalizes a relative override against the process cwd", () => {
    expect(resolveFactoryRoot("../elsewhere", "/Users/x/panda-corp/mission-control")).toBe(
      path.resolve("../elsewhere"),
    );
  });
});

describe("derived path constants", () => {
  it("ideas dir, profile and portfolio hang off the factory root", () => {
    // The module-level constants are computed from the real cwd at import time;
    // assert their shape relative to a shared parent rather than an absolute value.
    expect(IDEAS_DIR.endsWith(path.join("factory", "ideas"))).toBe(true);
    expect(PROFILE.endsWith(path.join("factory", "profile.md"))).toBe(true);
    expect(PORTFOLIO.endsWith(path.join("factory", "portfolio.md"))).toBe(true);

    const root = IDEAS_DIR.slice(0, -path.join("factory", "ideas").length);
    expect(PROFILE.startsWith(root)).toBe(true);
    expect(PORTFOLIO.startsWith(root)).toBe(true);
  });

  it("lists the non-idea filenames to skip", () => {
    expect(NON_IDEA_FILES).toContain("_idea-template.md");
    expect(NON_IDEA_FILES).toContain("decision-log.md");
  });
});

describe("projectStatusPath", () => {
  it("points at <projectPath>/.pandacorp/status.yaml", () => {
    expect(projectStatusPath("/Users/x/projects/widget")).toBe(
      path.join("/Users/x/projects/widget", ".pandacorp", "status.yaml"),
    );
  });
});
