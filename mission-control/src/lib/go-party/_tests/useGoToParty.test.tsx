/**
 * WO-02-012 — useGoToParty hook (CMP-02-go-party)
 *
 * Tests for the React hook that wires goToParty to Next.js useRouter,
 * as required by the CampaignPipeline onEnterForge prop (WO-02-010 contract):
 *
 *   export function CampaignPipeline(props: CampaignPipelineProps): React.JSX.Element;
 *   // onEnterForge: (slug: string) => void — host-navigate to Portfolio → project → Party (WO-02-012)
 *
 * AC-02-010.5 — WHEN the build phase's "Entrar a La Fragua" action is activated,
 *   THE system SHALL navigate the host app to Portfolio → project → Party tab, WITHOUT reload.
 *
 * The hook returns a stable callback that calls router.push with the Party URL.
 *
 * Traceability:
 *   CMP-02-go-party → REQ-02-010 (AC-02-010.5)
 *   IF-02-goParty: `goToParty(slug: string): void`
 *   WO-02-012
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/navigation before importing the hook
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
}));

import { useGoToParty } from "../go-party";

describe("useGoToParty hook — wires goToParty to Next.js router (AC-02-010.5)", () => {
  it("returns a function", () => {
    const { result } = renderHook(() => useGoToParty());
    expect(typeof result.current).toBe("function");
  });

  it("calling the returned function with a valid slug pushes /projects/<slug>?tab=party", () => {
    mockPush.mockClear();
    const { result } = renderHook(() => useGoToParty());
    result.current("my-project");
    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/projects/my-project?tab=party");
  });

  it("does NOT call router.push for an empty slug (safe no-op)", () => {
    mockPush.mockClear();
    const { result } = renderHook(() => useGoToParty());
    result.current("");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does NOT call router.push for a whitespace-only slug (safe no-op)", () => {
    mockPush.mockClear();
    const { result } = renderHook(() => useGoToParty());
    result.current("   ");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not throw when called with any slug", () => {
    const { result } = renderHook(() => useGoToParty());
    expect(() => result.current("")).not.toThrow();
    expect(() => result.current("valid")).not.toThrow();
  });

  it("navigates to different projects on successive calls", () => {
    mockPush.mockClear();
    const { result } = renderHook(() => useGoToParty());
    result.current("project-a");
    result.current("project-b");
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenNthCalledWith(1, "/projects/project-a?tab=party");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/projects/project-b?tab=party");
  });
});
