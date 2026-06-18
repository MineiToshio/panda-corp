/**
 * WO-16-003 — `app/api/orphans` route handler tests.
 *
 * Tests the GET /api/orphans route by importing the handler directly
 * and mocking `getOrphans` from lib/orphans.
 *
 * Traceability:
 *   CMP-16-route → AC-16-003.1, AC-16-003.2, AC-16-003.3, AC-16-003.4
 *   IF-16-scan   → lib/orphans.ts :: getOrphans()
 *   REQ-16-005   (read-only: no writes, never runs adopt/git/portfolio write)
 *
 * Strategy:
 *   - Mock `getOrphans` to return controlled Candidate[] fixtures.
 *   - Invoke the exported `GET` handler directly with a minimal Request.
 *   - Assert status, JSON body shape, empty-state tolerance, degraded-scan tolerance.
 *
 * Stack: Vitest + jsdom (no Playwright; route handler is a pure function).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Candidate } from "@/lib/orphans";

// ---------------------------------------------------------------------------
// Fixtures — controlled Candidate arrays for each scenario
// ---------------------------------------------------------------------------

const CANDIDATE_ORPHAN: Candidate = {
  name: "cool-project",
  path: "/Users/owner/Projects/cool-project",
  kind: "orphan",
  hasMarker: false,
  inPortfolio: false,
};

const CANDIDATE_UNLISTED: Candidate = {
  name: "factory-project",
  path: "/Users/owner/Projects/factory-project",
  kind: "unlisted",
  hasMarker: true,
  inPortfolio: false,
};

const CANDIDATE_MULTI: Candidate[] = [CANDIDATE_ORPHAN, CANDIDATE_UNLISTED];

// ---------------------------------------------------------------------------
// Mock setup: vi.mock must be declared at module level before imports so
// Vitest hoists the mock.
// ---------------------------------------------------------------------------

vi.mock("@/lib/orphans", () => ({
  getOrphans: vi.fn(),
}));

import { getOrphans } from "@/lib/orphans";
// Import the handler after the mock is registered.
import { GET } from "../route";

const mockGetOrphans = vi.mocked(getOrphans);

// ---------------------------------------------------------------------------
// Helper: build a minimal Request for the route handler.
// ---------------------------------------------------------------------------

function makeRequest(url = "http://localhost/api/orphans"): Request {
  return new Request(url, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/orphans — WO-16-003", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-16-003.1 — Returns 200 with JSON array of Candidate
  // -------------------------------------------------------------------------

  describe("AC-16-003.1 — status 200 with JSON array of Candidate", () => {
    it("WHEN orphan candidates exist THEN returns 200 with an array", async () => {
      mockGetOrphans.mockReturnValue([CANDIDATE_ORPHAN]);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it("WHEN a single orphan candidate exists THEN body contains its full shape", async () => {
      mockGetOrphans.mockReturnValue([CANDIDATE_ORPHAN]);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        name: CANDIDATE_ORPHAN.name,
        path: CANDIDATE_ORPHAN.path,
        kind: "orphan",
        hasMarker: false,
        inPortfolio: false,
      });
    });

    it("WHEN an unlisted candidate exists THEN body contains kind=unlisted", async () => {
      mockGetOrphans.mockReturnValue([CANDIDATE_UNLISTED]);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        name: CANDIDATE_UNLISTED.name,
        path: CANDIDATE_UNLISTED.path,
        kind: "unlisted",
        hasMarker: true,
        inPortfolio: false,
      });
    });

    it("WHEN multiple candidates exist THEN body array contains all of them", async () => {
      mockGetOrphans.mockReturnValue(CANDIDATE_MULTI);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(body).toHaveLength(2);
      expect(body[0].kind).toBe("orphan");
      expect(body[1].kind).toBe("unlisted");
    });

    it("JSON body is a plain array (not an object with an array field)", async () => {
      mockGetOrphans.mockReturnValue([CANDIDATE_ORPHAN]);

      const response = await GET(makeRequest());
      const body = await response.json();

      // The contract is a bare array, not { candidates: [...] }
      expect(Array.isArray(body)).toBe(true);
      expect(body).not.toHaveProperty("candidates");
    });

    it("each Candidate entry contains all 5 required keys", async () => {
      mockGetOrphans.mockReturnValue([CANDIDATE_ORPHAN]);

      const response = await GET(makeRequest());
      const body = await response.json();

      const requiredKeys: (keyof Candidate)[] = [
        "name",
        "path",
        "kind",
        "hasMarker",
        "inPortfolio",
      ];
      for (const key of requiredKeys) {
        expect(body[0]).toHaveProperty(key);
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC-16-003.2 — Handler is read-only: only calls getOrphans, no writes
  // -------------------------------------------------------------------------

  describe("AC-16-003.2 — read-only: only calls IF-16-scan, no writes (REQ-16-005)", () => {
    it("WHEN GET is called THEN getOrphans is invoked exactly once", async () => {
      mockGetOrphans.mockReturnValue([]);

      await GET(makeRequest());

      expect(mockGetOrphans).toHaveBeenCalledTimes(1);
    });

    it("WHEN GET is called multiple times THEN each call invokes getOrphans once each", async () => {
      mockGetOrphans.mockReturnValue([]);

      await GET(makeRequest());
      await GET(makeRequest());
      await GET(makeRequest());

      expect(mockGetOrphans).toHaveBeenCalledTimes(3);
    });

    it("WHEN GET is called THEN getOrphans is called with the factory root (not no-arg)", async () => {
      mockGetOrphans.mockReturnValue([]);

      await GET(makeRequest());

      // The route passes the resolved factory root; must be called with exactly one string arg.
      expect(mockGetOrphans).toHaveBeenCalledOnce();
      const callArgs = mockGetOrphans.mock.calls[0] ?? [];
      expect(callArgs).toHaveLength(1);
      expect(typeof callArgs[0]).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // AC-16-003.3 — WHEN no candidates THEN returns 200 with [] (not 404/500)
  // -------------------------------------------------------------------------

  describe("AC-16-003.3 — empty list returns 200 with [] (not 404 or 500)", () => {
    it("WHEN no orphan candidates THEN status is 200", async () => {
      mockGetOrphans.mockReturnValue([]);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
    });

    it("WHEN no orphan candidates THEN body is empty array", async () => {
      mockGetOrphans.mockReturnValue([]);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(body).toEqual([]);
    });

    it("WHEN no orphan candidates THEN body is NOT null or undefined", async () => {
      mockGetOrphans.mockReturnValue([]);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(body).not.toBeNull();
      expect(body).not.toBeUndefined();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // AC-16-003.4 — Degraded scan returns 200 with [] (not 500)
  // -------------------------------------------------------------------------

  describe("AC-16-003.4 — degraded scan (unreadable projects path) returns 200 with []", () => {
    it("WHEN getOrphans returns [] (defensive empty-list on error) THEN status is 200", async () => {
      // getOrphans is already defensive (returns [] on any error — WO-16-002).
      // The route must propagate that [] as 200 not 500.
      mockGetOrphans.mockReturnValue([]);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual([]);
    });

    it("WHEN getOrphans throws unexpectedly THEN handler catches it and returns 200 with []", async () => {
      // Even if the underlying lib breaks its own defensive contract, the route must not 500.
      mockGetOrphans.mockImplementation(() => {
        throw new Error("Unexpected fs error");
      });

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual([]);
    });

    it("WHEN GET is called after a throw THEN it does NOT throw at the route level", () => {
      mockGetOrphans.mockImplementation(() => {
        throw new Error("Unreadable projects path");
      });

      // Must not throw — error boundary inside the route handler.
      expect(() => GET(makeRequest())).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Content-Type must be application/json
  // -------------------------------------------------------------------------

  describe("Content-Type header", () => {
    it("WHEN response is received THEN Content-Type is application/json", async () => {
      mockGetOrphans.mockReturnValue([CANDIDATE_ORPHAN]);

      const response = await GET(makeRequest());

      const contentType = response.headers.get("content-type");
      expect(contentType).toMatch(/application\/json/);
    });
  });

  // -------------------------------------------------------------------------
  // Cache-Control must disallow caching (force-dynamic — live filesystem state)
  // -------------------------------------------------------------------------

  describe("Cache-Control header — live filesystem state must not be cached", () => {
    it("WHEN response headers are inspected THEN Cache-Control disallows caching", async () => {
      mockGetOrphans.mockReturnValue([]);

      const response = await GET(makeRequest());

      const cacheControl = response.headers.get("cache-control");
      expect(cacheControl).toBeDefined();
      if (cacheControl !== null) {
        // Must not allow positive max-age caching
        expect(cacheControl).not.toMatch(/^public$/i);
        expect(cacheControl).not.toMatch(/max-age=(?:[1-9]\d*)/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Route module exports: runtime and dynamic constants
  // -------------------------------------------------------------------------

  describe("route module exports — runtime and dynamic config", () => {
    it("exports runtime = 'nodejs' (fs.readdir + fs.accessSync need Node)", async () => {
      const routeModule = await import("../route");
      expect(routeModule.runtime).toBe("nodejs");
    });

    it("exports dynamic = 'force-dynamic' (live filesystem state, never cached)", async () => {
      const routeModule = await import("../route");
      expect(routeModule.dynamic).toBe("force-dynamic");
    });
  });
});
