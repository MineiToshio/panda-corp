import { describe, expect, it } from "vitest";
import { AGENT_ROLES, AGENT_STATES, type AgentState, STATE_BADGE } from "../tokens";

describe("frd-13 AC-13-007.1 / IF-13-state-vocab: STATE_BADGE covers all 6 states", () => {
  it("frd-13: AGENT_STATES must enumerate the 6 canonical states from blueprint IF-13-state-vocab", () => {
    const expected: AgentState[] = [
      "working",
      "idle",
      "failed",
      "completed",
      "blocked",
      "reviewing",
    ];
    expect(AGENT_STATES).toEqual(expect.arrayContaining(expected));
    expect(AGENT_STATES).toHaveLength(expected.length);
  });

  it("frd-13: STATE_BADGE is defined for every state in AGENT_STATES", () => {
    for (const state of AGENT_STATES) {
      expect(
        STATE_BADGE[state],
        `STATE_BADGE is missing an entry for state "${state}"`,
      ).toBeDefined();
    }
  });

  it("frd-13: WHEN state is 'working' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    const badge = STATE_BADGE.working;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'idle' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    const badge = STATE_BADGE.idle;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'failed' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    const badge = STATE_BADGE.failed;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'completed' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    const badge = STATE_BADGE.completed;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'blocked' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    // Regression: FRD-13 body lists only 4 states; blueprint IF-13-state-vocab adds 'blocked'
    // and 'reviewing'. Both must be in the vocab or FRD-06/Party will have to hard-code them.
    const badge = STATE_BADGE.blocked;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: WHEN state is 'reviewing' THEN STATE_BADGE has a non-empty icon and a Spanish label", () => {
    // Regression: same reasoning as 'blocked' above.
    const badge = STATE_BADGE.reviewing;
    expect(badge.icon.length).toBeGreaterThan(0);
    expect(badge.label.length).toBeGreaterThan(0);
  });

  it("frd-13: every STATE_BADGE entry has both icon AND label — no state is color-only", () => {
    for (const state of AGENT_STATES) {
      const badge = STATE_BADGE[state];
      expect(badge, `STATE_BADGE["${state}"] is undefined`).toBeDefined();
      expect(badge.icon.length, `STATE_BADGE["${state}"].icon must be non-empty`).toBeGreaterThan(
        0,
      );
      expect(badge.label.length, `STATE_BADGE["${state}"].label must be non-empty`).toBeGreaterThan(
        0,
      );
    }
  });

  it("frd-13: STATE_BADGE contains no extra states beyond AGENT_STATES (closed vocabulary)", () => {
    const keys = Object.keys(STATE_BADGE) as AgentState[];
    expect(keys).toHaveLength(AGENT_STATES.length);
    for (const key of keys) {
      expect(AGENT_STATES).toContain(key);
    }
  });

  it("frd-13: all STATE_BADGE labels are distinct (no two states share the same label)", () => {
    const labels = AGENT_STATES.map((s) => STATE_BADGE[s].label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});
describe("frd-13 IF-13-state-vocab: STATE_BADGE icon identifier format", () => {
  it("frd-13: each STATE_BADGE icon is a kebab-case string (valid Lucide icon identifier)", () => {
    // lucide-react resolves icons by kebab-case name (e.g. 'loader-circle').
    // An icon containing spaces, uppercase letters, or special chars would fail at render time
    // with no TypeScript error — only caught here.
    const kebabPattern = /^[a-z][a-z0-9-]*$/;
    for (const state of AGENT_STATES) {
      const { icon } = STATE_BADGE[state];
      expect(
        kebabPattern.test(icon),
        `STATE_BADGE["${state}"].icon "${icon}" must be a kebab-case Lucide identifier`,
      ).toBe(true);
    }
  });

  it("frd-13: each STATE_BADGE label contains only printable characters (no control chars or lone emoji)", () => {
    // Guards against copy-paste accidents that introduce zero-width spaces or control
    // characters into the Spanish label, which would silently display wrong in aria-label.
    // eslint-disable-next-line no-control-regex
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-character test
    const controlCharPattern = /[\x00-\x1F\x7F]/;
    for (const state of AGENT_STATES) {
      const { label } = STATE_BADGE[state];
      expect(
        controlCharPattern.test(label),
        `STATE_BADGE["${state}"].label "${label}" must not contain control characters`,
      ).toBe(false);
    }
  });
});
it("keeps the thirteen canonical sprite roles without a role palette", () => {
  expect(AGENT_ROLES).toHaveLength(13);
  expect(new Set(AGENT_ROLES).size).toBe(13);
});
