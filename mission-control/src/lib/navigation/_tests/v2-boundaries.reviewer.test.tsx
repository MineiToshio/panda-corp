import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/modules/AppShell/AppShell";
import { readyFixture } from "@/components/modules/DataModelViewer/_tests/fixture";
import { DataModelViewer } from "@/components/modules/DataModelViewer/DataModelViewer";
import { navActive } from "@/components/modules/Nav/navActive";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { activeDestinationPath } from "@/lib/navigation/destinations";
import { readNavigationCatalog } from "@/lib/navigation/identityCatalog";
import { validateNavigationQuery } from "@/lib/navigation/keys";
import { routeHref, workspaceRouteState } from "@/lib/navigation/routeState";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: vi.fn(() => "/"),
}));

afterEach(() => vi.restoreAllMocks());

describe("FRD-25 whole-contract boundary probes (LESSON-0450, LESSON-0185)", () => {
  it("AC-25-008.1/012.1: accepts exact limits and rejects malformed routes and catalogs loudly", () => {
    expect(validateNavigationQuery("accounts", { accountsQuery: "😀".repeat(200) })).toEqual({
      ok: true,
    });
    expect(validateNavigationQuery("accounts", { accountsQuery: "😀".repeat(201) }).ok).toBe(false);
    expect(() =>
      routeHref("/portfolio", ["x".repeat(512), "summary"], { q: "x".repeat(2048) }),
    ).not.toThrow();
    for (const segment of ["x".repeat(513), "..", "%2e%2e", "bad%5Cpath", "bad%00path"]) {
      expect(() => routeHref("/portfolio", [segment], {})).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    }
    expect(() => routeHref("/portfolio", ["second"], { q: "x".repeat(2049) })).toThrow();
    expect(() => routeHref("/portfolio", ["second"], { state: ["review", "done"] })).toThrow();
    expect(() =>
      workspaceRouteState("/portfolio/second/summary/extra", ["second", "summary", "extra"]),
    ).toThrow();
    expect(
      workspaceRouteState("/portfolio/second/no-such-tab", ["second", "no-such-tab"]),
    ).toMatchObject({ tab: "unknown", raw: "no-such-tab" });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "frd25-gate-catalog-"));
    const catalog = path.join(root, "factory/navigation-identities.json");
    fs.mkdirSync(path.dirname(catalog));
    try {
      expect(readNavigationCatalog(root)).toBeUndefined();
      for (const fixture of [
        "{broken",
        '{"schemaVersion":1,"resources":{}}',
        '{"schemaVersion":2,"resources":[]}',
      ]) {
        fs.writeFileSync(catalog, fixture);
        expect(() => readNavigationCatalog(root)).toThrow("Navigation identities:");
        expect(fs.readFileSync(catalog, "utf8")).toBe(fixture);
      }
    } finally {
      if (fs.existsSync(catalog)) fs.unlinkSync(catalog);
      fs.rmdirSync(path.dirname(catalog));
      fs.rmdirSync(root);
    }
  });

  it("AC-25-008.1: alias normalization cannot silently discard an unsupported Board tail", () => {
    for (const href of [
      "/board/second/campaign/extra?phase=architecture#Acceptance",
      "/board/second/documents/docs%2FFRD-25.md/extra?model=schema#Acceptance",
    ]) {
      expect(normalizeLegacyNavigation(href)).toBe(href);
    }
  });

  it("AC-25-010.1: every descendant retains the shell and the project keeps Portfolio active", () => {
    for (const href of [
      "/projects/second/spec",
      "/configuration",
      "/configuration/skills/reviewer",
    ]) {
      vi.mocked(usePathname).mockReturnValue(href);
      render(
        <AppShell>
          <p>{href}</p>
        </AppShell>,
      );
      expect.soft(screen.getByTestId("app-shell"), href).toBeInTheDocument();
      expect.soft(screen.getByText(href), href).toBeInTheDocument();
      expect
        .soft(screen.getByTestId("app-nav-portfolio").hasAttribute("aria-current"), href)
        .toBe(href.startsWith("/projects/"));
      expect
        .soft(screen.getByTestId("app-nav-configuracion").hasAttribute("aria-current"), href)
        .toBe(href.startsWith("/configuration"));
      cleanup();
    }
    expect(activeDestinationPath("/projects/second/spec")).toBe("/portfolio");
    expect(navActive("/projects/second/spec")).toBe("portfolio");
  });

  it("AC-25-001.1/002.1: restores the canonical Esquema model mode rather than the diagram default", async () => {
    window.history.replaceState(
      {},
      "",
      "/portfolio/second/architecture?model=Esquema&schemaTable=entry",
    );
    render(<DataModelViewer result={readyFixture()} />);
    expect(
      await screen.findByRole("button", { name: /^Esquema$/ }, { timeout: 10_000 }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Entry")).toHaveAttribute("open");
  });

  it("AC-25-011.1: expanded paste restores the inline viewer without opening a modal or native fullscreen", async () => {
    const showDescriptor = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal",
    );
    const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
    const request = vi.fn(async () => {});
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: request,
    });
    try {
      window.history.replaceState({}, "", "/portfolio/second/architecture?expanded=1&entity=entry");
      const viewer = render(<DataModelViewer result={readyFixture()} />);
      expect(
        await screen.findByRole("button", { name: /^Diagrama$/ }, { timeout: 10_000 }),
      ).toBeVisible();
      expect(request).not.toHaveBeenCalled();
      expect.soft(showModal).not.toHaveBeenCalled();
      expect.soft(screen.queryByRole("dialog")).not.toBeInTheDocument();
      viewer.unmount();
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, "requestFullscreen", descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
      if (showDescriptor)
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", showDescriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      if (closeDescriptor)
        Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });
});
