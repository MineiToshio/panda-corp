import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { activeDestinationPath } from "@/lib/navigation/destinations";
import { validateNavigationQuery } from "@/lib/navigation/keys";
import { navigationHref, parseNavigationUrl } from "@/lib/navigation/urls";
import { useCanonicalSelection, useUrlSearch, useUrlState } from "@/lib/navigation/useUrlState";

afterEach(() => vi.restoreAllMocks());

describe("FRD-25 independent semantic URL acceptance (LESSON-0365)", () => {
  it("AC-25-001.1/004.1/009.1: preserves every family, resource case, filters and anchor", () => {
    const cases = [
      [
        "/board/second/campaign?phase=architecture&boardQuery=needle",
        { idea: "second", phase: "architecture", boardQuery: "needle" },
      ],
      [
        "/board/second/documents/docs%2FFRD-25%2FDesign.md",
        { idea: "second", doc: "docs/FRD-25/Design.md" },
      ],
      [
        "/portfolio/second/observability?view=deps&frd=FRD-25&state=review&wo=WO-25-001&woview=full&dag=wo&focus=WO-25-001",
        { project: "second", wo: "WO-25-001", woview: "full", focus: "WO-25-001" },
      ],
      [
        "/projects/second/documents/docs%2FFRD-25%2FDesign.md",
        { project: "second", doc: "docs/FRD-25/Design.md" },
      ],
      [
        "/portfolio?view=cuentas&accountsQuery=needle&accountsState=active&account=provider%3Acandidate",
        { view: "cuentas", accountsQuery: "needle", account: "provider:candidate" },
      ],
      [
        "/proposals/memory/prune/LESSON-0365",
        { proposalsTab: "memoria", stream: "prune", lesson: "LESSON-0365" },
      ],
      ["/proposals/backlog/BL-0001", { backlogItem: "BL-0001" }],
      [
        "/achievements/trophies?category=quality&trophy=first&eras=one%2Ctwo",
        { hallTab: "trofeos", category: "quality", trophy: "first", eras: "one,two" },
      ],
      [
        "/configuration/standards/CONV-13?q=source&severity=MUST&domain=testing",
        { configSection: "standards", configItem: "CONV-13", q: "source" },
      ],
      [
        "/manual/guides/build?q=gate&index=1",
        { manualGroup: "guides", manualPage: "build", index: "1" },
      ],
      [
        "/projects/second/architecture?model=Esquema&entity=Entry&modelQuery=owner&schemaTable=Entry&relationship=ownership&expanded=1",
        {
          model: "Esquema",
          entity: "Entry",
          modelQuery: "owner",
          schemaTable: "Entry",
          relationship: "ownership",
          expanded: "1",
        },
      ],
    ] as const;
    for (const [href, selection] of cases) {
      const input = `${href}${href.includes("?") ? "&" : "?"}future=kept#Acceptance`;
      const output = navigationHref(input, {});
      expect(parseNavigationUrl(output)).toMatchObject(selection);
      expect(navigationHref(output, {})).toBe(output);
      expect(new URL(output, "http://localhost").hash).toBe("#Acceptance");
      expect(parseNavigationUrl(output).future).toBe("kept");
    }
    for (const family of ["portfolio", "projects"]) {
      expect(activeDestinationPath(`/${family}/second/documents`)).toBe("/portfolio");
      const legacy = `/${family}?project=second&tab=Work%20orders&wo=WO-25-001&wotab=full&view=dag&state=review#Acceptance`;
      const href = normalizeLegacyNavigation(legacy);
      expect(href).toContain(`/${family}/second/observability?`);
      expect(parseNavigationUrl(href)).toMatchObject({
        project: "second",
        wo: "WO-25-001",
        woview: "full",
        view: "deps",
        state: "review",
      });
      expect(validateNavigationQuery("observability", parseNavigationUrl(href))).toEqual({
        ok: true,
      });
      const document = navigationHref(href, {
        tab: "documents",
        doc: "docs/FRD-25/Design.md",
        wo: null,
        woview: null,
      });
      expect(document).toContain(`/${family}/second/documents/docs%2FFRD-25%2FDesign.md?`);
      expect(document).toContain("#Acceptance");
    }
  });

  it("AC-25-002.1/003.1: defaults and rapid search replace; independent selections survive history restoration", () => {
    window.history.replaceState({ sentinel: 25 }, "", "/board#Acceptance");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const hook = renderHook(() => {
      useCanonicalSelection("board", "idea", "second");
      return { search: useUrlSearch("boardQuery"), phase: useUrlState("phase", "product") };
    });
    expect(window.location.pathname).toBe("/board/second");
    act(() => {
      hook.result.current.search[1]("a");
      hook.result.current.search[1]((previous) => `${previous}b`);
      hook.result.current.search[1]((previous) => `${previous}c`);
    });
    expect(hook.result.current.search[0]).toBe("abc");
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(4);
    act(() => hook.result.current.phase[1]("architecture"));
    expect(push).toHaveBeenCalledTimes(1);
    const copied = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    act(() => {
      window.history.replaceState(
        {},
        "",
        "/board/second?phase=product&boardQuery=older#Acceptance",
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(hook.result.current.phase[0]).toBe("product");
    expect(hook.result.current.search[0]).toBe("older");
    act(() => {
      window.history.replaceState({}, "", copied);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(hook.result.current.phase[0]).toBe("architecture");
    expect(hook.result.current.search[0]).toBe("abc");
    expect(window.location.hash).toBe("#Acceptance");
    hook.unmount();
  });
});
