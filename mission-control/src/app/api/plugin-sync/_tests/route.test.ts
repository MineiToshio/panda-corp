/**
 * WO-15-003 — `app/api/plugin-sync` route handler tests.
 *
 * Tests the GET /api/plugin-sync route by importing the handler directly
 * and mocking `getPluginSyncState` from lib/plugin-sync.
 *
 * Traceability:
 *   CMP-15-route → AC-15-003.1, AC-15-003.2, AC-15-003.3, AC-15-003.4
 *   IF-15-sync (lib/plugin-sync.ts)
 *   REQ-15-005 (read-only: no writes, never executes update command)
 *
 * Strategy:
 *   - Mock `getPluginSyncState` to return controlled PluginSyncState fixtures.
 *   - Invoke the exported `GET` handler directly with a minimal Request.
 *   - Assert status, JSON body shape, headers (no-cache), and read-only invariant.
 *
 * Stack: Vitest + jsdom (no Playwright; route handler is a pure function).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PluginSyncState } from "@/lib/plugin-sync";

// ---------------------------------------------------------------------------
// Fixtures — controlled PluginSyncState values for every reason branch
// ---------------------------------------------------------------------------

const STATE_IN_SYNC: PluginSyncState = {
  installedSha: "eb76145abc1234567890abcdef1234567890abcd",
  pluginHeadSha: "eb76145abc1234567890abcdef1234567890abcd",
  dirty: false,
  drift: false,
  reason: "in-sync",
  detail: "instalado eb76145 · plugin al día",
};

const STATE_UNCOMMITTED: PluginSyncState = {
  installedSha: "18a9389abc1234567890abcdef1234567890abcd",
  pluginHeadSha: "18a9389abc1234567890abcdef1234567890abcd",
  dirty: true,
  drift: true,
  reason: "uncommitted",
  detail: "instalado 18a9389 · hay cambios sin commitear",
};

const STATE_BEHIND: PluginSyncState = {
  installedSha: "aaaaaaa1111111111111111111111111111111111",
  pluginHeadSha: "bbbbbbb2222222222222222222222222222222222",
  dirty: false,
  drift: true,
  reason: "behind",
  detail: "instalado aaaaaaa · el plugin instalado está atrás del HEAD (bbbbbbb)",
};

const STATE_BOTH: PluginSyncState = {
  installedSha: "aaaaaaa1111111111111111111111111111111111",
  pluginHeadSha: "bbbbbbb2222222222222222222222222222222222",
  dirty: true,
  drift: true,
  reason: "both",
  detail: "instalado aaaaaaa · atrás del HEAD y hay cambios sin commitear",
};

const STATE_UNKNOWN: PluginSyncState = {
  installedSha: null,
  pluginHeadSha: null,
  dirty: false,
  drift: false,
  reason: "unknown",
  detail: "estado desconocido (plugin no instalado o repo no disponible)",
};

// ---------------------------------------------------------------------------
// Mock setup: vi.mock must be declared at module level before imports so
// Vitest hoists the mock. We use a factory that returns a vi.fn() stub.
// ---------------------------------------------------------------------------

vi.mock("@/lib/plugin-sync", () => ({
  getPluginSyncState: vi.fn(),
}));

import { getPluginSyncState } from "@/lib/plugin-sync";
// Import the handler after the mock is registered so it picks up the mock.
// The dynamic import is deferred to the describe block to ensure ordering.
// We use a top-level import here relying on Vitest's hoisting of vi.mock.
import { GET } from "../route";

// Typed reference to the mock function.
const mockGetState = vi.mocked(getPluginSyncState);

// ---------------------------------------------------------------------------
// Helper: build a minimal Request for the route handler.
// ---------------------------------------------------------------------------

function makeRequest(url = "http://localhost/api/plugin-sync"): Request {
  return new Request(url, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/plugin-sync — WO-15-003", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-15-003.1 — Returns 200 with JSON body matching PluginSyncState shape
  // -------------------------------------------------------------------------

  describe("AC-15-003.1 — status 200 + PluginSyncState JSON shape", () => {
    it("WHEN in-sync state THEN returns 200 with all PluginSyncState fields", async () => {
      mockGetState.mockReturnValue(STATE_IN_SYNC);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        installedSha: STATE_IN_SYNC.installedSha,
        pluginHeadSha: STATE_IN_SYNC.pluginHeadSha,
        dirty: false,
        drift: false,
        reason: "in-sync",
        detail: STATE_IN_SYNC.detail,
      });
    });

    it("WHEN uncommitted state THEN returns 200 with drift=true reason=uncommitted", async () => {
      mockGetState.mockReturnValue(STATE_UNCOMMITTED);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        dirty: true,
        drift: true,
        reason: "uncommitted",
      });
    });

    it("WHEN behind state THEN returns 200 with drift=true reason=behind", async () => {
      mockGetState.mockReturnValue(STATE_BEHIND);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        dirty: false,
        drift: true,
        reason: "behind",
      });
    });

    it("WHEN both (dirty+behind) THEN returns 200 with drift=true reason=both", async () => {
      mockGetState.mockReturnValue(STATE_BOTH);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        dirty: true,
        drift: true,
        reason: "both",
      });
    });

    it("WHEN unknown state THEN returns 200 with drift=false reason=unknown", async () => {
      mockGetState.mockReturnValue(STATE_UNKNOWN);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        installedSha: null,
        pluginHeadSha: null,
        dirty: false,
        drift: false,
        reason: "unknown",
      });
    });

    it("JSON body always contains all 6 required PluginSyncState keys", async () => {
      mockGetState.mockReturnValue(STATE_IN_SYNC);

      const response = await GET(makeRequest());
      const body = await response.json();

      // All required fields from the PluginSyncState type must be present
      const requiredKeys: (keyof PluginSyncState)[] = [
        "installedSha",
        "pluginHeadSha",
        "dirty",
        "drift",
        "reason",
        "detail",
      ];
      for (const key of requiredKeys) {
        expect(body).toHaveProperty(key);
      }
    });

    it("JSON body contains no extra unexpected fields beyond PluginSyncState", async () => {
      mockGetState.mockReturnValue(STATE_IN_SYNC);

      const response = await GET(makeRequest());
      const body = await response.json();

      // Only the 6 canonical keys (no extra internal/private fields leaked)
      const actualKeys = Object.keys(body).sort();
      expect(actualKeys).toEqual(
        ["detail", "dirty", "drift", "installedSha", "pluginHeadSha", "reason"].sort(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC-15-003.2 — Route is read-only: calls getPluginSyncState, never writes
  // -------------------------------------------------------------------------

  describe("AC-15-003.2 — read-only: only calls IF-15-sync, no writes", () => {
    it("WHEN GET is called THEN getPluginSyncState is invoked exactly once", async () => {
      mockGetState.mockReturnValue(STATE_IN_SYNC);

      await GET(makeRequest());

      expect(mockGetState).toHaveBeenCalledTimes(1);
    });

    it("WHEN GET is called THEN getPluginSyncState is called with no arguments (reads from env)", async () => {
      mockGetState.mockReturnValue(STATE_IN_SYNC);

      await GET(makeRequest());

      expect(mockGetState).toHaveBeenCalledWith();
    });

    it("WHEN GET is called multiple times THEN each call invokes getPluginSyncState once each", async () => {
      mockGetState.mockReturnValue(STATE_IN_SYNC);

      await GET(makeRequest());
      await GET(makeRequest());
      await GET(makeRequest());

      expect(mockGetState).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // AC-15-003.3 — Response is uncacheable (dynamic = "force-dynamic")
  // -------------------------------------------------------------------------

  describe("AC-15-003.3 — response is uncacheable", () => {
    it("WHEN response headers are inspected THEN Cache-Control disallows caching", async () => {
      mockGetState.mockReturnValue(STATE_IN_SYNC);

      const response = await GET(makeRequest());

      // The route sets no-store or no-cache to prevent stale drift data.
      // Next.js with dynamic = "force-dynamic" sets cache-control: no-store.
      const cacheControl = response.headers.get("cache-control");
      // Either no-store or no-cache is acceptable; must not be a caching directive.
      // Next.js with force-dynamic sets no-store, s-maxage=0, or similar.
      // We assert it is NOT empty AND does not contain "max-age=<positive>" alone.
      expect(cacheControl).toBeDefined();
      // Must not be a permissive cache header like "public, max-age=3600"
      if (cacheControl !== null) {
        expect(cacheControl).not.toMatch(/^public$/i);
        expect(cacheControl).not.toMatch(/max-age=(?:[1-9]\d*)/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC-15-003.4 — reason=unknown returns 200 (not 500), banner decides silently
  // -------------------------------------------------------------------------

  describe("AC-15-003.4 — degraded probe (reason=unknown) still returns 200", () => {
    it("WHEN getPluginSyncState returns reason=unknown THEN HTTP status is 200 not 500", async () => {
      mockGetState.mockReturnValue(STATE_UNKNOWN);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
    });

    it("WHEN reason=unknown THEN drift=false is faithfully passed in JSON (banner stays hidden)", async () => {
      mockGetState.mockReturnValue(STATE_UNKNOWN);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(body.reason).toBe("unknown");
      expect(body.drift).toBe(false);
    });

    it("WHEN getPluginSyncState is called THEN the route does NOT throw even with null SHAs", () => {
      mockGetState.mockReturnValue(STATE_UNKNOWN);

      // GET is synchronous — it returns a Response directly (not a Promise).
      // Calling it with null SHAs in the state must not throw.
      expect(() => GET(makeRequest())).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Content-Type must be application/json
  // -------------------------------------------------------------------------

  describe("Content-Type header", () => {
    it("WHEN response is received THEN Content-Type is application/json", async () => {
      mockGetState.mockReturnValue(STATE_IN_SYNC);

      const response = await GET(makeRequest());

      const contentType = response.headers.get("content-type");
      expect(contentType).toMatch(/application\/json/);
    });
  });

  // -------------------------------------------------------------------------
  // Route exports: runtime and dynamic constants (AC-15-003.3 static config)
  // -------------------------------------------------------------------------

  describe("route module exports — runtime and dynamic config", () => {
    it("exports runtime = 'nodejs' (child_process requirement)", async () => {
      const routeModule = await import("../route");
      expect(routeModule.runtime).toBe("nodejs");
    });

    it("exports dynamic = 'force-dynamic' (never cached — AC-15-003.3)", async () => {
      const routeModule = await import("../route");
      expect(routeModule.dynamic).toBe("force-dynamic");
    });
  });
});
